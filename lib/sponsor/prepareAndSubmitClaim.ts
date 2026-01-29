/**
 * Prepare and Submit Claim - Split flow for claim link creation
 *
 * Create claim link flow:
 * 1. Sender deposits to PrivacyCash (deposit_tx_hash)
 * 2. Withdraw from PrivacyCash to burner wallet (tx_hash) - breaks the link
 * 3. Encrypt burner secret key with passphrase (for receiver)
 * 4. Encrypt burner secret key with session signature (for sender reclaim)
 * 5. Return claim link + passphrase
 *
 * Claim flow (receiver):
 * - Decrypt burner key with passphrase
 * - Simple transfer from burner to receiver (claim_tx_hash)
 *
 * Reclaim flow (sender):
 * - Decrypt burner key with session signature
 * - Simple transfer from burner back to sender (claim_tx_hash)
 */

import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  SystemProgram,
  VersionedTransaction,
  TransactionMessage,
} from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  createTransferInstruction,
  createAssociatedTokenAccountInstruction,
  getAccount,
  TokenAccountNotFoundError,
} from "@solana/spl-token";
import * as path from "path";
import { LocalStorage } from "node-localstorage";
import { WasmFactory } from "@lightprotocol/hasher.rs";
import { EncryptionService } from "privacycash/dist/utils/encryption.js";
import { RELAYER_API_URL } from "privacycash/dist/utils/constants.js";
import { withdrawSPL } from "privacycash/dist/withdrawSPL.js";

import { buildDepositSPLTransaction } from "./depositBuilder";
import { TOKEN_MINTS, TokenType } from "../privacycash/tokens";
import {
  createActivity,
  getActivity,
  updateActivityStatus,
  Activity,
} from "../database";
import {
  generatePassphrase,
  encryptWithPassphrase,
  decryptWithPassphrase,
  encryptWithSessionSignature,
  decryptWithSessionSignature,
  serializeKeypair,
  deserializeKeypair,
  PassphraseEncryptedPayload,
} from "../crypto";

// Constants
const RENT_LAMPORTS = 953520 * 2;
const SDK_MINIMUM = 2_000_000;
const TOTAL_PREFUND = RENT_LAMPORTS + SDK_MINIMUM;

// Storage for UTXO cache
const storage = new LocalStorage(path.join(process.cwd(), "cache"));

// ============================================================================
// PREPARE PHASE - Build unsigned transactions for sender to sign
// ============================================================================

export interface PrepareClaimParams {
  connection: Connection;
  senderPublicKey: PublicKey;
  sponsorKeypair: Keypair;
  sessionSignature: Uint8Array;
  amount: number;
  token: TokenType;
  message?: string;
}

export interface PrepareClaimResult {
  activityId: string;
  unsignedDepositTx: string;
  unsignedSweepTx: string;
  fundTx: string | null;
  sweepAmount: number;
  lastValidBlockHeight: number;
  passphrase: string; // Return passphrase immediately so user can share it
  burnerAddress: string;
}

/**
 * Prepare claim link transactions for sender to sign.
 */
export async function prepareClaim(
  params: PrepareClaimParams
): Promise<PrepareClaimResult> {
  const {
    connection,
    senderPublicKey,
    sponsorKeypair,
    sessionSignature,
    amount,
    token,
    message,
  } = params;

  const baseUnits = Math.floor(amount * 1_000_000);

  console.log("=== Prepare Claim Link ===");
  console.log("Sender:", senderPublicKey.toBase58());
  console.log("Amount:", amount, token);

  // Generate burner keypair for this claim link
  const burnerKeypair = Keypair.generate();
  console.log("Burner address:", burnerKeypair.publicKey.toBase58());

  // Generate passphrase for receiver
  const passphrase = generatePassphrase();
  console.log("Passphrase generated");

  // Encrypt burner secret key for receiver (passphrase)
  const burnerSecretKey = burnerKeypair.secretKey;
  const encryptedForReceiver = encryptWithPassphrase(burnerSecretKey, passphrase);

  // Encrypt burner secret key for sender (session signature)
  const encryptedForSender = encryptWithSessionSignature(burnerSecretKey, sessionSignature);

  // Create activity record with encrypted keys
  console.log("\n[1/5] Creating activity record...");
  const activity = await createActivity({
    type: "send_claim",
    sender_address: senderPublicKey.toBase58(),
    receiver_address: null, // Unknown until claimed
    amount,
    token_address: TOKEN_MINTS[token].toBase58(),
    status: "open",
    message: message || null,
    tx_hash: null,
    burner_address: burnerKeypair.publicKey.toBase58(),
    encrypted_for_receiver: encryptedForReceiver,
    encrypted_for_sender: encryptedForSender,
  });
  console.log("Activity created:", activity.id);

  // Step 2: Pre-fund sender with SOL
  console.log("\n[2/5] Pre-funding sender with SOL...");
  const senderBalance = await connection.getBalance(senderPublicKey);

  let fundTx: string | null = null;
  if (senderBalance < TOTAL_PREFUND) {
    const needed = TOTAL_PREFUND - senderBalance;
    const fundTransaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: sponsorKeypair.publicKey,
        toPubkey: senderPublicKey,
        lamports: needed,
      })
    );
    fundTx = await connection.sendTransaction(fundTransaction, [sponsorKeypair]);
    await connection.confirmTransaction(fundTx, "confirmed");
    console.log("Fund tx:", fundTx);
  } else {
    console.log("Sender already has enough SOL");
  }

  // Step 3: Build deposit transaction (unsigned)
  console.log("\n[3/5] Building deposit transaction...");

  const { transaction: depositTx, lastValidBlockHeight: depositLastValidBlockHeight } =
    await buildDepositSPLTransaction({
      connection,
      userPublicKey: senderPublicKey,
      sessionSignature,
      baseUnits,
      token,
      storage,
    });

  console.log("Deposit tx built (unsigned)");

  // Step 4: Simulate deposit to get post-balance
  console.log("\n[4/5] Simulating deposit to get exact remaining...");

  const simulation = await connection.simulateTransaction(depositTx, {
    sigVerify: false,
    replaceRecentBlockhash: true,
  });

  if (simulation.value.err) {
    await updateActivityStatus(activity.id, "cancelled");
    throw new Error(`Simulation failed: ${JSON.stringify(simulation.value.err)}`);
  }

  const postBalance = simulation.value.accounts?.[0]?.lamports;
  const currentBalance = await connection.getBalance(senderPublicKey);
  const exactRemaining = postBalance ?? (currentBalance - RENT_LAMPORTS - 5000);

  console.log("Exact remaining after deposit:", exactRemaining, "lamports");

  // Step 5: Build sweep transaction
  console.log("\n[5/5] Building sweep transaction...");

  const { blockhash: sweepBlockhash, lastValidBlockHeight: sweepLastValidBlockHeight } =
    await connection.getLatestBlockhash("confirmed");

  const sweepMessage = new TransactionMessage({
    payerKey: sponsorKeypair.publicKey,
    recentBlockhash: sweepBlockhash,
    instructions: [
      SystemProgram.transfer({
        fromPubkey: senderPublicKey,
        toPubkey: sponsorKeypair.publicKey,
        lamports: exactRemaining,
      }),
    ],
  }).compileToV0Message();

  const sweepTx = new VersionedTransaction(sweepMessage);
  sweepTx.sign([sponsorKeypair]);

  console.log("Sweep amount:", exactRemaining, "lamports");

  // Serialize transactions
  const unsignedDepositTx = Buffer.from(depositTx.serialize()).toString("base64");
  const unsignedSweepTx = Buffer.from(sweepTx.serialize()).toString("base64");

  const lastValidBlockHeight = Math.min(depositLastValidBlockHeight, sweepLastValidBlockHeight);

  return {
    activityId: activity.id,
    unsignedDepositTx,
    unsignedSweepTx,
    fundTx,
    sweepAmount: exactRemaining,
    lastValidBlockHeight,
    passphrase, // User shares this with receiver out-of-band
    burnerAddress: burnerKeypair.publicKey.toBase58(),
  };
}

// ============================================================================
// SUBMIT PHASE - Execute signed transactions and withdraw to burner
// ============================================================================

export interface SubmitClaimParams {
  connection: Connection;
  signedDepositTx: string;
  signedSweepTx: string;
  sessionSignature: Uint8Array;
  activityId: string;
  senderPublicKey: PublicKey;
  lastValidBlockHeight?: number;
}

export interface SubmitClaimResult {
  activityId: string;
  depositTx: string;
  sweepTx: string;
  withdrawTx: string; // Withdraw to burner (breaks the link)
  claimLink: string;
  burnerAddress: string;
  finalBalance: number;
}

/**
 * Relay signed deposit transaction to indexer
 */
async function relayDepositToIndexer(
  signedTransaction: string,
  senderAddress: string,
  mintAddress: string
): Promise<string> {
  const response = await fetch(`${RELAYER_API_URL}/deposit/spl`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      signedTransaction,
      senderAddress,
      mintAddress,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Relay failed: ${text}`);
  }

  const result = (await response.json()) as { signature: string };
  return result.signature;
}

/**
 * Submit signed transactions and complete claim link creation.
 * Deposits to PrivacyCash, then withdraws to burner wallet (breaking the link).
 */
export async function submitClaim(
  params: SubmitClaimParams
): Promise<SubmitClaimResult> {
  const {
    connection,
    signedDepositTx,
    signedSweepTx,
    sessionSignature,
    activityId,
    senderPublicKey,
    lastValidBlockHeight,
  } = params;

  console.log("=== Submit Claim Link ===");
  console.log("Activity:", activityId);
  console.log("Sender:", senderPublicKey.toBase58());

  // Check if transaction is still valid
  if (lastValidBlockHeight) {
    const currentBlockHeight = await connection.getBlockHeight("confirmed");
    if (currentBlockHeight > lastValidBlockHeight) {
      throw new Error("Transaction expired. Please prepare again.");
    }
    console.log(`Block height check: ${currentBlockHeight} <= ${lastValidBlockHeight} ✓`);
  }

  // Fetch activity to get burner address and other details
  const activity = await getActivity(activityId);
  if (!activity) {
    throw new Error("Activity not found");
  }

  if (activity.type !== "send_claim") {
    throw new Error("Not a claim link activity");
  }

  if (activity.status !== "open") {
    throw new Error("Claim link already processed");
  }

  if (!activity.burner_address || !activity.encrypted_for_sender) {
    throw new Error("Activity missing burner data");
  }

  // Verify sender
  if (activity.sender_address !== senderPublicKey.toBase58()) {
    throw new Error("Not authorized to submit this claim link");
  }

  const burnerAddress = new PublicKey(activity.burner_address);
  const amount = activity.amount;
  const baseUnits = Math.floor(amount * 1_000_000);

  // Determine token
  let token: TokenType = "USDC";
  if (activity.token_address === TOKEN_MINTS.SOL.toBase58()) {
    token = "SOL";
  } else if (activity.token_address === TOKEN_MINTS.USDT.toBase58()) {
    token = "USDT";
  }

  const mintAddress = TOKEN_MINTS[token];

  try {
    // Step 1: Submit deposit to relayer
    console.log("\n[1/4] Submitting deposit to relayer...");

    const depositSig = await relayDepositToIndexer(
      signedDepositTx,
      senderPublicKey.toBase58(),
      mintAddress.toBase58()
    );
    console.log("Deposit tx:", depositSig);

    // Step 2: Submit sweep to network
    console.log("\n[2/4] Submitting sweep to network...");

    const sweepTxBytes = Buffer.from(signedSweepTx, "base64");
    const sweepTransaction = VersionedTransaction.deserialize(sweepTxBytes);

    const sweepSig = await connection.sendRawTransaction(sweepTransaction.serialize());
    await connection.confirmTransaction(sweepSig, "confirmed");
    console.log("Sweep tx:", sweepSig);

    const finalBalance = await connection.getBalance(senderPublicKey);
    console.log("Final sender balance:", finalBalance, "lamports");

    // Step 3: Wait for indexer
    console.log("\n[3/4] Waiting for indexer (15s)...");
    await new Promise((r) => setTimeout(r, 15000));

    // Step 4: Withdraw to burner wallet (this breaks the link!)
    console.log("\n[4/4] Withdrawing to burner wallet...");

    // Derive encryption keys from session signature
    const encryptionService = new EncryptionService();
    encryptionService.deriveEncryptionKeyFromSignature(sessionSignature);

    const lightWasm = await WasmFactory.getInstance();

    const withdrawResult = await withdrawSPL({
      mintAddress,
      lightWasm,
      base_units: baseUnits,
      connection,
      encryptionService,
      publicKey: senderPublicKey,
      recipient: burnerAddress, // Withdraw to burner, not receiver
      keyBasePath: path.join(process.cwd(), "node_modules/privacycash/circuit2/transaction2"),
      storage,
    });

    const withdrawTx = withdrawResult.tx;
    console.log("Withdraw to burner tx:", withdrawTx);

    // Update activity with deposit tx hash
    // Note: tx_hash stores the withdraw to burner tx
    // deposit_tx_hash stores the original deposit
    await updateActivityStatus(activity.id, "open", {
      tx_hash: withdrawTx,
    });

    // Also update deposit_tx_hash separately (need to use supabase directly for this)
    // For now, we'll keep status as open - it becomes settled when claimed

    console.log("Claim link created successfully");

    // Build claim link URL
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const claimLink = `${appUrl}/claim/${activityId}`;

    return {
      activityId,
      depositTx: depositSig,
      sweepTx: sweepSig,
      withdrawTx,
      claimLink,
      burnerAddress: burnerAddress.toBase58(),
      finalBalance,
    };
  } catch (error) {
    console.error("Submit claim failed:", error);
    await updateActivityStatus(activityId, "cancelled");
    throw error;
  }
}

// ============================================================================
// CLAIM - Receiver claims with passphrase
// ============================================================================

export interface ClaimWithPassphraseParams {
  connection: Connection;
  activityId: string;
  passphrase: string;
  receiverAddress: string;
  sponsorKeypair: Keypair;
}

export interface ClaimWithPassphraseResult {
  activityId: string;
  claimTx: string;
  amountReceived: number;
  token: TokenType;
}

/**
 * Receiver claims the funds using passphrase.
 */
export async function claimWithPassphrase(
  params: ClaimWithPassphraseParams
): Promise<ClaimWithPassphraseResult> {
  const { connection, activityId, passphrase, receiverAddress, sponsorKeypair } = params;

  console.log("=== Claim with Passphrase ===");
  console.log("Activity:", activityId);
  console.log("Receiver:", receiverAddress);

  // Fetch activity
  const activity = await getActivity(activityId);
  if (!activity) {
    throw new Error("Claim link not found");
  }

  if (activity.type !== "send_claim") {
    throw new Error("Not a claim link");
  }

  if (activity.status !== "open") {
    throw new Error("Claim link already used or cancelled");
  }

  if (!activity.encrypted_for_receiver || !activity.burner_address) {
    throw new Error("Invalid claim link data");
  }

  // Decrypt burner secret key with passphrase
  let burnerSecretKey: Uint8Array;
  try {
    burnerSecretKey = decryptWithPassphrase(
      activity.encrypted_for_receiver as PassphraseEncryptedPayload,
      passphrase
    );
  } catch (error) {
    throw new Error("Invalid passphrase");
  }

  const burnerKeypair = Keypair.fromSecretKey(burnerSecretKey);

  // Verify burner address matches
  if (burnerKeypair.publicKey.toBase58() !== activity.burner_address) {
    throw new Error("Burner key mismatch - invalid passphrase");
  }

  // Determine token
  let token: TokenType = "USDC";
  if (activity.token_address === TOKEN_MINTS.SOL.toBase58()) {
    token = "SOL";
  } else if (activity.token_address === TOKEN_MINTS.USDT.toBase58()) {
    token = "USDT";
  }

  const mintAddress = TOKEN_MINTS[token];

  // Transfer from burner to receiver
  console.log("Transferring from burner to receiver...");

  const receiverPubkey = new PublicKey(receiverAddress);
  const burnerTokenAccount = await getAssociatedTokenAddress(mintAddress, burnerKeypair.publicKey);
  const receiverTokenAccount = await getAssociatedTokenAddress(mintAddress, receiverPubkey);

  // Get actual balance in burner's token account (may be less than expected due to fees)
  let actualBalance: bigint;
  try {
    const burnerAccount = await getAccount(connection, burnerTokenAccount);
    actualBalance = burnerAccount.amount;
    console.log("Burner token balance:", actualBalance.toString(), "base units");
  } catch (error) {
    if (error instanceof TokenAccountNotFoundError) {
      throw new Error("Burner has no token account - claim link may not be ready");
    }
    throw error;
  }

  if (actualBalance === BigInt(0)) {
    throw new Error("Burner has no tokens - claim link may not be ready");
  }

  // Check if receiver has token account
  const instructions = [];
  try {
    await getAccount(connection, receiverTokenAccount);
  } catch (error) {
    if (error instanceof TokenAccountNotFoundError) {
      // Create ATA for receiver
      instructions.push(
        createAssociatedTokenAccountInstruction(
          sponsorKeypair.publicKey, // payer
          receiverTokenAccount,
          receiverPubkey,
          mintAddress
        )
      );
    } else {
      throw error;
    }
  }

  // Add transfer instruction (transfer full balance)
  instructions.push(
    createTransferInstruction(
      burnerTokenAccount,
      receiverTokenAccount,
      burnerKeypair.publicKey,
      actualBalance
    )
  );

  // Build and send transaction
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");

  const message = new TransactionMessage({
    payerKey: sponsorKeypair.publicKey, // Sponsor pays gas
    recentBlockhash: blockhash,
    instructions,
  }).compileToV0Message();

  const tx = new VersionedTransaction(message);
  tx.sign([sponsorKeypair, burnerKeypair]);

  const signature = await connection.sendRawTransaction(tx.serialize());
  await connection.confirmTransaction(
    { signature, blockhash, lastValidBlockHeight },
    "confirmed"
  );

  console.log("Claim tx:", signature);

  // Update activity
  await updateActivityStatus(activity.id, "settled", {
    claim_tx_hash: signature,
    receiver_address: receiverAddress,
  });

  console.log("Activity updated: settled");

  return {
    activityId,
    claimTx: signature,
    amountReceived: Number(actualBalance) / 1_000_000,
    token,
  };
}

// ============================================================================
// RECLAIM - Sender reclaims with session signature
// ============================================================================

export interface ReclaimWithSignatureParams {
  connection: Connection;
  activityId: string;
  sessionSignature: Uint8Array;
  senderPublicKey: PublicKey;
  sponsorKeypair: Keypair;
}

export interface ReclaimWithSignatureResult {
  activityId: string;
  reclaimTx: string;
  amountReclaimed: number;
  token: TokenType;
}

/**
 * Sender reclaims the funds using session signature.
 */
export async function reclaimWithSignature(
  params: ReclaimWithSignatureParams
): Promise<ReclaimWithSignatureResult> {
  const { connection, activityId, sessionSignature, senderPublicKey, sponsorKeypair } = params;

  console.log("=== Reclaim with Signature ===");
  console.log("Activity:", activityId);
  console.log("Sender:", senderPublicKey.toBase58());

  // Fetch activity
  const activity = await getActivity(activityId);
  if (!activity) {
    throw new Error("Claim link not found");
  }

  if (activity.type !== "send_claim") {
    throw new Error("Not a claim link");
  }

  if (activity.status !== "open") {
    throw new Error("Claim link already used or cancelled");
  }

  // Verify sender
  if (activity.sender_address !== senderPublicKey.toBase58()) {
    throw new Error("Not authorized to reclaim this link");
  }

  if (!activity.encrypted_for_sender || !activity.burner_address) {
    throw new Error("Invalid claim link data");
  }

  // Decrypt burner secret key with session signature
  let burnerSecretKey: Uint8Array;
  try {
    burnerSecretKey = decryptWithSessionSignature(
      activity.encrypted_for_sender as PassphraseEncryptedPayload,
      sessionSignature
    );
  } catch (error) {
    throw new Error("Invalid session signature");
  }

  const burnerKeypair = Keypair.fromSecretKey(burnerSecretKey);

  // Verify burner address matches
  if (burnerKeypair.publicKey.toBase58() !== activity.burner_address) {
    throw new Error("Burner key mismatch - invalid signature");
  }

  // Determine token
  let token: TokenType = "USDC";
  if (activity.token_address === TOKEN_MINTS.SOL.toBase58()) {
    token = "SOL";
  } else if (activity.token_address === TOKEN_MINTS.USDT.toBase58()) {
    token = "USDT";
  }

  const mintAddress = TOKEN_MINTS[token];

  // Transfer from burner back to sender
  console.log("Transferring from burner to sender...");

  const burnerTokenAccount = await getAssociatedTokenAddress(mintAddress, burnerKeypair.publicKey);
  const senderTokenAccount = await getAssociatedTokenAddress(mintAddress, senderPublicKey);

  // Get actual balance in burner's token account (may be less than expected due to fees)
  let actualBalance: bigint;
  try {
    const burnerAccount = await getAccount(connection, burnerTokenAccount);
    actualBalance = burnerAccount.amount;
    console.log("Burner token balance:", actualBalance.toString(), "base units");
  } catch (error) {
    if (error instanceof TokenAccountNotFoundError) {
      throw new Error("Burner has no token account - claim link may not be ready");
    }
    throw error;
  }

  if (actualBalance === BigInt(0)) {
    throw new Error("Burner has no tokens - claim link may not be ready");
  }

  // Check if sender has token account (they should, since they sent)
  const instructions = [];
  try {
    await getAccount(connection, senderTokenAccount);
  } catch (error) {
    if (error instanceof TokenAccountNotFoundError) {
      instructions.push(
        createAssociatedTokenAccountInstruction(
          sponsorKeypair.publicKey,
          senderTokenAccount,
          senderPublicKey,
          mintAddress
        )
      );
    } else {
      throw error;
    }
  }

  // Add transfer instruction (transfer full balance)
  instructions.push(
    createTransferInstruction(
      burnerTokenAccount,
      senderTokenAccount,
      burnerKeypair.publicKey,
      actualBalance
    )
  );

  // Build and send transaction
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");

  const message = new TransactionMessage({
    payerKey: sponsorKeypair.publicKey,
    recentBlockhash: blockhash,
    instructions,
  }).compileToV0Message();

  const tx = new VersionedTransaction(message);
  tx.sign([sponsorKeypair, burnerKeypair]);

  const signature = await connection.sendRawTransaction(tx.serialize());
  await connection.confirmTransaction(
    { signature, blockhash, lastValidBlockHeight },
    "confirmed"
  );

  console.log("Reclaim tx:", signature);

  // Update activity - cancelled since sender took it back
  await updateActivityStatus(activity.id, "cancelled", {
    claim_tx_hash: signature,
  });

  console.log("Activity updated: cancelled (reclaimed)");

  return {
    activityId,
    reclaimTx: signature,
    amountReclaimed: Number(actualBalance) / 1_000_000,
    token,
  };
}
