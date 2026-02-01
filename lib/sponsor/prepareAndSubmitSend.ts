/**
 * Prepare and Submit Send - Split flow for UI integration
 *
 * Prepare phase:
 * 1. Sponsor pre-funds user with SOL
 * 2. Build unsigned deposit tx (using session signature for encryption)
 * 3. Simulate to get exact remaining balance
 * 4. Build unsigned sweep tx
 * 5. Return unsigned txs for user to sign
 *
 * Submit phase:
 * 1. Receive signed txs
 * 2. Submit deposit to relayer
 * 3. Submit sweep to network
 * 4. Wait for indexer, withdraw to receiver
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
  updateActivityStatus,
} from "../database";
import { getCircuitBasePathCached } from "../utils/circuitPath";

// Constants
const RENT_LAMPORTS = 953520 * 2;
const SDK_MINIMUM = 2_000_000;
const TOTAL_PREFUND = RENT_LAMPORTS + SDK_MINIMUM;

// Session message that user signs to derive encryption keys
export const SESSION_MESSAGE = "Privacy Money account sign in";

// Storage for UTXO cache
const storage = new LocalStorage(path.join(process.cwd(), "cache"));

// ============================================================================
// PREPARE PHASE
// ============================================================================

export interface PrepareSendParams {
  connection: Connection;
  senderPublicKey: PublicKey;
  sponsorKeypair: Keypair;
  sessionSignature: Uint8Array; // 64-byte signature
  receiverAddress: string;
  amount: number;
  token: TokenType;
  message?: string;
}

export interface PrepareSendResult {
  activityId: string;
  unsignedDepositTx: string; // base64 serialized
  unsignedSweepTx: string; // base64 serialized
  fundTx: string | null;
  sweepAmount: number;
  lastValidBlockHeight: number; // For checking if tx is still valid
}

/**
 * Prepare send transactions for user to sign.
 * Returns unsigned deposit and sweep transactions.
 */
export async function prepareSend(
  params: PrepareSendParams
): Promise<PrepareSendResult> {
  const {
    connection,
    senderPublicKey,
    sponsorKeypair,
    sessionSignature,
    receiverAddress,
    amount,
    token,
    message,
  } = params;

  const baseUnits = Math.floor(amount * 1_000_000);

  console.log("=== Prepare Send ===");
  console.log("Sender:", senderPublicKey.toBase58());
  console.log("Receiver:", receiverAddress);
  console.log("Amount:", amount, token);

  // Create activity record
  console.log("\n[1/5] Creating activity record...");
  const activity = await createActivity({
    type: "send",
    sender_address: senderPublicKey.toBase58(),
    receiver_address: receiverAddress,
    amount,
    token_address: TOKEN_MINTS[token].toBase58(),
    status: "open",
    message: message || null,
    tx_hash: null,
  });
  console.log("Activity created:", activity.id);

  // Step 1: Pre-fund user with SOL
  console.log("\n[2/5] Pre-funding user with SOL...");
  const userBalance = await connection.getBalance(senderPublicKey);

  let fundTx: string | null = null;
  if (userBalance < TOTAL_PREFUND) {
    const needed = TOTAL_PREFUND - userBalance;
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
    console.log("User already has enough SOL");
  }

  // Step 2: Build deposit transaction (unsigned)
  console.log("\n[3/5] Building deposit transaction...");

  const { transaction: depositTx, mintAddress, lastValidBlockHeight: depositLastValidBlockHeight } = await buildDepositSPLTransaction({
    connection,
    userPublicKey: senderPublicKey,
    sessionSignature,
    baseUnits,
    token,
    storage,
  });

  console.log("Deposit tx built (unsigned)");

  // Step 3: Simulate deposit to get post-balance
  console.log("\n[4/5] Simulating deposit to get exact remaining...");

  const simulation = await connection.simulateTransaction(depositTx, {
    sigVerify: false,
    replaceRecentBlockhash: true,
  });

  if (simulation.value.err) {
    // Clean up activity on failure
    await updateActivityStatus(activity.id, "cancelled");
    throw new Error(`Simulation failed: ${JSON.stringify(simulation.value.err)}`);
  }

  // Find user's post-balance from simulation
  const postBalance = simulation.value.accounts?.[0]?.lamports;
  const currentBalance = await connection.getBalance(senderPublicKey);
  const exactRemaining = postBalance ?? (currentBalance - RENT_LAMPORTS - 5000);

  console.log("Exact remaining after deposit:", exactRemaining, "lamports");

  // Step 4: Build sweep transaction with exact amount
  console.log("\n[5/5] Building sweep transaction...");

  const { blockhash: sweepBlockhash, lastValidBlockHeight: sweepLastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");

  const sweepMessage = new TransactionMessage({
    payerKey: sponsorKeypair.publicKey, // Sponsor pays sweep fee
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

  // Sponsor signs the sweep tx (as fee payer)
  sweepTx.sign([sponsorKeypair]);

  console.log("Sweep amount:", exactRemaining, "lamports");

  // Serialize transactions for frontend
  const unsignedDepositTx = Buffer.from(depositTx.serialize()).toString("base64");
  const unsignedSweepTx = Buffer.from(sweepTx.serialize()).toString("base64");

  // Use the earlier expiration to be safe
  const lastValidBlockHeight = Math.min(depositLastValidBlockHeight, sweepLastValidBlockHeight);

  return {
    activityId: activity.id,
    unsignedDepositTx,
    unsignedSweepTx,
    fundTx,
    sweepAmount: exactRemaining,
    lastValidBlockHeight,
  };
}

// ============================================================================
// SUBMIT PHASE
// ============================================================================

export interface SubmitSendParams {
  connection: Connection;
  signedDepositTx: string; // base64 serialized
  signedSweepTx: string; // base64 serialized
  sessionSignature: Uint8Array; // 64-byte signature for deriving keys
  activityId: string;
  senderPublicKey: PublicKey;
  receiverAddress: string;
  amount: number;
  token: TokenType;
  lastValidBlockHeight?: number; // Optional: for checking tx validity
}

export interface SubmitSendResult {
  activityId: string;
  depositTx: string;
  sweepTx: string;
  withdrawTx: string;
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
 * Submit signed transactions and complete the send flow.
 */
export async function submitSend(
  params: SubmitSendParams
): Promise<SubmitSendResult> {
  const {
    connection,
    signedDepositTx,
    signedSweepTx,
    sessionSignature,
    activityId,
    senderPublicKey,
    receiverAddress,
    amount,
    token,
    lastValidBlockHeight,
  } = params;

  const baseUnits = Math.floor(amount * 1_000_000);
  const mintAddress = TOKEN_MINTS[token];

  console.log("=== Submit Send ===");
  console.log("Activity:", activityId);
  console.log("Sender:", senderPublicKey.toBase58());

  // Check if transaction is still valid (if lastValidBlockHeight provided)
  if (lastValidBlockHeight) {
    const currentBlockHeight = await connection.getBlockHeight("confirmed");
    if (currentBlockHeight > lastValidBlockHeight) {
      throw new Error("Transaction expired. Please prepare again.");
    }
    console.log(`Block height check: ${currentBlockHeight} <= ${lastValidBlockHeight} ✓`);
  }

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
    console.log("Final balance:", finalBalance, "lamports");

    // Step 3: Wait for indexer
    console.log("\n[3/4] Waiting for indexer (15s)...");
    await new Promise((r) => setTimeout(r, 15000));

    // Step 4: Withdraw to receiver
    console.log("\n[4/4] Withdrawing to receiver...");

    // Derive encryption keys from session signature
    const encryptionService = new EncryptionService();
    encryptionService.deriveEncryptionKeyFromSignature(sessionSignature);

    // Get LightWasm instance
    const lightWasm = await WasmFactory.getInstance();

    // Withdraw to receiver using the derived keys
    const withdrawResult = await withdrawSPL({
      mintAddress,
      lightWasm,
      base_units: baseUnits,
      connection,
      encryptionService,
      publicKey: senderPublicKey,
      recipient: new PublicKey(receiverAddress),
      keyBasePath: getCircuitBasePathCached(),
      storage,
    });

    const withdrawTx = withdrawResult.tx;
    console.log("Withdraw tx:", withdrawTx);

    // Update activity status
    await updateActivityStatus(activityId, "settled", {
      tx_hash: withdrawTx,
    });
    console.log("Activity updated: settled");

    return {
      activityId,
      depositTx: depositSig,
      sweepTx: sweepSig,
      withdrawTx,
      finalBalance,
    };
  } catch (error) {
    // Mark activity as failed
    await updateActivityStatus(activityId, "cancelled");
    console.error("Submit failed:", error);
    throw error;
  }
}
