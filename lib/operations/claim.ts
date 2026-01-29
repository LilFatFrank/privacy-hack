/**
 * Claim Link Operation
 *
 * Creates claimable payment links with passphrase protection.
 * - Receiver needs passphrase to claim (sent via separate channel)
 * - Sender can reclaim anytime using their Solana keypair
 * - No expiration
 */

import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import bs58 from "bs58";

import {
  createActivity,
  getActivity,
  updateActivityStatus,
} from "../database";
import {
  generatePassphrase,
  encryptWithPassphrase,
  decryptWithPassphrase,
  encryptForRecipient,
  decryptWithPrivateKey,
  PassphraseEncryptedPayload,
  EncryptedPayload,
} from "../crypto";
import { TokenType, TOKEN_MINTS } from "../privacycash/tokens";
import { sponsoredSend } from "../sponsor/sponsoredSend";
import { PrivacyCash } from "privacycash";

export interface CreateClaimLinkParams {
  senderKeypair: Keypair;
  amount: number;
  token: TokenType;
  message?: string;
}

export interface CreateClaimLinkResult {
  activityId: string;
  claimLink: string;
  passphrase: string; // Send this via separate channel (SMS, email)
  depositTx: string;
}

export interface ClaimParams {
  activityId: string;
  passphrase: string;
  receiverAddress: string;
}

export interface ReclaimParams {
  activityId: string;
  senderKeypair: Keypair;
}

/**
 * Create a claim link.
 *
 * Flow:
 * 1. Generate burner wallet
 * 2. Deposit to PrivacyCash (sponsor pays gas)
 * 3. Generate passphrase
 * 4. Encrypt burner key for receiver (passphrase) and sender (keypair)
 * 5. Store in database
 */
export async function createClaimLink(
  params: CreateClaimLinkParams
): Promise<CreateClaimLinkResult> {
  const { senderKeypair, amount, token, message } = params;

  // Get sponsor keypair from env
  const sponsorKey = process.env.SPONSOR_PRIVATE_KEY;
  if (!sponsorKey) {
    throw new Error("SPONSOR_PRIVATE_KEY not configured");
  }
  const sponsorKeypair = Keypair.fromSecretKey(bs58.decode(sponsorKey));

  // Get connection
  const rpcUrl = process.env.RPC_URL;
  if (!rpcUrl) {
    throw new Error("RPC_URL not configured");
  }
  const connection = new Connection(rpcUrl, "confirmed");

  // Generate burner wallet
  const burnerKeypair = Keypair.generate();

  // Generate passphrase for receiver
  const passphrase = generatePassphrase();

  // Encrypt burner key for receiver (using passphrase)
  const encryptedForReceiver = encryptWithPassphrase(
    burnerKeypair.secretKey,
    passphrase
  );

  // Encrypt burner key for sender (using their keypair - for reclaim)
  const encryptedForSender = encryptForRecipient(
    burnerKeypair.secretKey,
    senderKeypair.publicKey
  );

  // Create activity record
  const activity = await createActivity({
    type: "claim",
    sender_address: senderKeypair.publicKey.toBase58(),
    receiver_address: null, // Unknown until claimed
    amount,
    token_address: TOKEN_MINTS[token].toBase58(),
    status: "open",
    message: message || null,
    tx_hash: null,
    burner_address: burnerKeypair.publicKey.toBase58(),
    encrypted_for_receiver: encryptedForReceiver as any,
    encrypted_for_sender: encryptedForSender as any,
    deposit_tx_hash: null,
    claim_tx_hash: null,
  });

  // Execute deposit using sponsored send to the burner
  // Burner deposits, sponsor pays gas
  const baseUnits = Math.floor(amount * 1_000_000);

  // First transfer tokens to burner
  const {
    getAssociatedTokenAddress,
    createTransferInstruction,
    createAssociatedTokenAccountInstruction,
    getAccount,
  } = await import("@solana/spl-token");
  const { Transaction, SystemProgram } = await import("@solana/web3.js");

  const mintAddress = TOKEN_MINTS[token];

  // Get sender's and burner's token accounts
  const senderAta = await getAssociatedTokenAddress(
    mintAddress,
    senderKeypair.publicKey
  );
  const burnerAta = await getAssociatedTokenAddress(
    mintAddress,
    burnerKeypair.publicKey
  );

  // Create burner's ATA and transfer tokens
  const transferTx = new Transaction();

  // Create ATA for burner
  transferTx.add(
    createAssociatedTokenAccountInstruction(
      senderKeypair.publicKey, // payer
      burnerAta, // ata
      burnerKeypair.publicKey, // owner
      mintAddress // mint
    )
  );

  // Transfer tokens
  transferTx.add(
    createTransferInstruction(
      senderAta,
      burnerAta,
      senderKeypair.publicKey,
      baseUnits
    )
  );

  const transferSig = await connection.sendTransaction(transferTx, [
    senderKeypair,
  ]);
  await connection.confirmTransaction(transferSig, "confirmed");

  // Now do the deposit through the privacy pool
  // Pre-fund burner for rent
  const RENT_LAMPORTS = 953520 * 2 + 2_000_000; // Rent for 2 PDAs + SDK minimum
  const fundTx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: sponsorKeypair.publicKey,
      toPubkey: burnerKeypair.publicKey,
      lamports: RENT_LAMPORTS,
    })
  );
  const fundSig = await connection.sendTransaction(fundTx, [sponsorKeypair]);
  await connection.confirmTransaction(fundSig, "confirmed");

  // Deposit using burner
  const client = new PrivacyCash({
    RPC_url: rpcUrl,
    owner: burnerKeypair.secretKey,
  });

  const depositResult = await client.depositSPL({
    mintAddress: mintAddress.toBase58(),
    base_units: baseUnits,
  });

  // Update activity with deposit tx
  await updateActivityStatus(activity.id, "open", {
    tx_hash: depositResult.tx,
  });

  // Sweep remaining SOL back to sponsor
  const remainingBalance = await connection.getBalance(burnerKeypair.publicKey);
  if (remainingBalance > 0) {
    const { blockhash } = await connection.getLatestBlockhash();
    const sweepTx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: burnerKeypair.publicKey,
        toPubkey: sponsorKeypair.publicKey,
        lamports: remainingBalance,
      })
    );
    sweepTx.feePayer = sponsorKeypair.publicKey;
    sweepTx.recentBlockhash = blockhash;
    sweepTx.sign(burnerKeypair, sponsorKeypair);
    await connection.sendRawTransaction(sweepTx.serialize());
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  return {
    activityId: activity.id,
    claimLink: `${appUrl}/claim/${activity.id}`,
    passphrase,
    depositTx: depositResult.tx,
  };
}

/**
 * Claim a payment link (receiver).
 *
 * Flow:
 * 1. Fetch activity from database
 * 2. Decrypt burner key using passphrase
 * 3. Withdraw to receiver's address
 * 4. Update activity status
 */
export async function claimPayment(
  params: ClaimParams
): Promise<{ withdrawTx: string }> {
  const { activityId, passphrase, receiverAddress } = params;

  // Get activity
  const activity = await getActivity(activityId);
  if (!activity) {
    throw new Error("Claim link not found");
  }

  if (activity.type !== "claim") {
    throw new Error("Not a claim link");
  }

  if (activity.status !== "open") {
    throw new Error("Claim link already used or cancelled");
  }

  if (!activity.encrypted_for_receiver) {
    throw new Error("Missing encrypted data");
  }

  // Decrypt burner key using passphrase
  // The database stores this as JSONB, so we cast through unknown
  const encryptedPayload =
    activity.encrypted_for_receiver as unknown as PassphraseEncryptedPayload;
  let burnerSecret: Uint8Array;
  try {
    burnerSecret = decryptWithPassphrase(encryptedPayload, passphrase);
  } catch {
    throw new Error("Invalid passphrase");
  }

  // Get RPC URL
  const rpcUrl = process.env.RPC_URL;
  if (!rpcUrl) {
    throw new Error("RPC_URL not configured");
  }

  // Withdraw to receiver
  const client = new PrivacyCash({
    RPC_url: rpcUrl,
    owner: burnerSecret,
  });

  const baseUnits = Math.floor(activity.amount * 1_000_000);
  const withdrawResult = await client.withdrawUSDC({
    base_units: baseUnits,
    recipientAddress: receiverAddress,
  });

  // Update activity
  await updateActivityStatus(activity.id, "settled", {
    receiver_address: receiverAddress,
    claim_tx_hash: withdrawResult.tx,
  });

  return { withdrawTx: withdrawResult.tx };
}

/**
 * Reclaim a payment link (sender).
 *
 * Flow:
 * 1. Fetch activity from database
 * 2. Verify sender
 * 3. Decrypt burner key using sender's keypair
 * 4. Withdraw back to sender
 * 5. Update activity status
 */
export async function reclaimPayment(
  params: ReclaimParams
): Promise<{ withdrawTx: string }> {
  const { activityId, senderKeypair } = params;

  // Get activity
  const activity = await getActivity(activityId);
  if (!activity) {
    throw new Error("Claim link not found");
  }

  if (activity.type !== "claim") {
    throw new Error("Not a claim link");
  }

  if (activity.status !== "open") {
    throw new Error("Claim link already used or cancelled");
  }

  // Verify sender
  if (activity.sender_address !== senderKeypair.publicKey.toBase58()) {
    throw new Error("Not the sender of this claim link");
  }

  if (!activity.encrypted_for_sender) {
    throw new Error("Missing encrypted data for sender");
  }

  // Decrypt burner key using sender's keypair
  const encryptedPayload = activity.encrypted_for_sender as EncryptedPayload;
  const burnerSecret = decryptWithPrivateKey(
    encryptedPayload.ciphertext,
    encryptedPayload.nonce,
    encryptedPayload.ephemeralPublicKey,
    senderKeypair.secretKey
  );

  // Get RPC URL
  const rpcUrl = process.env.RPC_URL;
  if (!rpcUrl) {
    throw new Error("RPC_URL not configured");
  }

  // Withdraw back to sender
  const client = new PrivacyCash({
    RPC_url: rpcUrl,
    owner: burnerSecret,
  });

  const baseUnits = Math.floor(activity.amount * 1_000_000);
  const withdrawResult = await client.withdrawUSDC({
    base_units: baseUnits,
    recipientAddress: senderKeypair.publicKey.toBase58(),
  });

  // Update activity as cancelled (reclaimed)
  await updateActivityStatus(activity.id, "cancelled", {
    claim_tx_hash: withdrawResult.tx,
  });

  return { withdrawTx: withdrawResult.tx };
}
