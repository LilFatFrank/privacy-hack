/**
 * Prepare and Submit Fulfill - Split flow for request fulfillment
 *
 * Similar to send flow, but:
 * - Gets receiver address and amount from existing activity
 * - Updates existing activity instead of creating new one
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
  getActivity,
  updateActivityStatus,
  hashAddress,
} from "../database";

// Constants
const RENT_LAMPORTS = 953520 * 2;
const SDK_MINIMUM = 2_000_000;
const TOTAL_PREFUND = RENT_LAMPORTS + SDK_MINIMUM;

// Storage for UTXO cache
const storage = new LocalStorage(path.join(process.cwd(), "cache"));

// ============================================================================
// PREPARE PHASE
// ============================================================================

export interface PrepareFulfillParams {
  connection: Connection;
  activityId: string;
  payerPublicKey: PublicKey;
  sponsorKeypair: Keypair;
  sessionSignature: Uint8Array;
}

export interface PrepareFulfillResult {
  activityId: string;
  unsignedDepositTx: string;
  unsignedSweepTx: string;
  fundTx: string | null;
  sweepAmount: number;
  // Request details for UI confirmation
  amount: number;
  token: TokenType;
  receiverAddress: string;
}

/**
 * Prepare fulfill transactions for user to sign.
 */
export async function prepareFulfill(
  params: PrepareFulfillParams
): Promise<PrepareFulfillResult> {
  const {
    connection,
    activityId,
    payerPublicKey,
    sponsorKeypair,
    sessionSignature,
  } = params;

  console.log("=== Prepare Fulfill ===");
  console.log("Activity:", activityId);
  console.log("Payer:", payerPublicKey.toBase58());

  // Fetch activity from database
  const activity = await getActivity(activityId);
  if (!activity) {
    throw new Error("Request not found");
  }

  if (activity.type !== "request") {
    throw new Error("Not a payment request");
  }

  if (activity.status !== "open") {
    throw new Error("Request already fulfilled or cancelled");
  }

  // Verify payer if restricted
  if (activity.sender_hash) {
    const payerHash = hashAddress(payerPublicKey.toBase58());
    if (activity.sender_hash !== payerHash) {
      throw new Error("Not authorized to fulfill this request");
    }
  }

  // Get request details
  // For requests, receiver_hash contains the actual address (not hashed)
  if (!activity.receiver_hash) {
    throw new Error("Request missing receiver address");
  }

  const receiverAddress = activity.receiver_hash;
  const amount = activity.amount;

  // Determine token
  let token: TokenType = "USDC";
  if (activity.token_address === TOKEN_MINTS.SOL.toBase58()) {
    token = "SOL";
  } else if (activity.token_address === TOKEN_MINTS.USDT.toBase58()) {
    token = "USDT";
  }

  const baseUnits = Math.floor(amount * 1_000_000);

  console.log("Receiver:", receiverAddress);
  console.log("Amount:", amount, token);

  // Step 1: Pre-fund payer with SOL
  console.log("\n[1/4] Pre-funding payer with SOL...");
  const payerBalance = await connection.getBalance(payerPublicKey);

  let fundTx: string | null = null;
  if (payerBalance < TOTAL_PREFUND) {
    const needed = TOTAL_PREFUND - payerBalance;
    const fundTransaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: sponsorKeypair.publicKey,
        toPubkey: payerPublicKey,
        lamports: needed,
      })
    );
    fundTx = await connection.sendTransaction(fundTransaction, [sponsorKeypair]);
    await connection.confirmTransaction(fundTx, "confirmed");
    console.log("Fund tx:", fundTx);
  } else {
    console.log("Payer already has enough SOL");
  }

  // Step 2: Build deposit transaction
  console.log("\n[2/4] Building deposit transaction...");

  const { transaction: depositTx, mintAddress } = await buildDepositSPLTransaction({
    connection,
    userPublicKey: payerPublicKey,
    sessionSignature,
    baseUnits,
    token,
    storage,
  });

  console.log("Deposit tx built (unsigned)");

  // Step 3: Simulate deposit to get post-balance
  console.log("\n[3/4] Simulating deposit...");

  const simulation = await connection.simulateTransaction(depositTx, {
    sigVerify: false,
    replaceRecentBlockhash: true,
  });

  if (simulation.value.err) {
    throw new Error(`Simulation failed: ${JSON.stringify(simulation.value.err)}`);
  }

  const postBalance = simulation.value.accounts?.[0]?.lamports;
  const currentBalance = await connection.getBalance(payerPublicKey);
  const exactRemaining = postBalance ?? (currentBalance - RENT_LAMPORTS - 5000);

  console.log("Exact remaining after deposit:", exactRemaining, "lamports");

  // Step 4: Build sweep transaction
  console.log("\n[4/4] Building sweep transaction...");

  const { blockhash: sweepBlockhash } = await connection.getLatestBlockhash();

  const sweepMessage = new TransactionMessage({
    payerKey: sponsorKeypair.publicKey,
    recentBlockhash: sweepBlockhash,
    instructions: [
      SystemProgram.transfer({
        fromPubkey: payerPublicKey,
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

  return {
    activityId,
    unsignedDepositTx,
    unsignedSweepTx,
    fundTx,
    sweepAmount: exactRemaining,
    amount,
    token,
    receiverAddress,
  };
}

// ============================================================================
// SUBMIT PHASE
// ============================================================================

export interface SubmitFulfillParams {
  connection: Connection;
  signedDepositTx: string;
  signedSweepTx: string;
  sessionSignature: Uint8Array;
  activityId: string;
  payerPublicKey: PublicKey;
}

export interface SubmitFulfillResult {
  activityId: string;
  depositTx: string;
  sweepTx: string;
  withdrawTx: string;
  finalBalance: number;
  amountReceived: number;
  feesPaid: number;
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
 * Submit signed transactions and complete the fulfill flow.
 */
export async function submitFulfill(
  params: SubmitFulfillParams
): Promise<SubmitFulfillResult> {
  const {
    connection,
    signedDepositTx,
    signedSweepTx,
    sessionSignature,
    activityId,
    payerPublicKey,
  } = params;

  console.log("=== Submit Fulfill ===");
  console.log("Activity:", activityId);
  console.log("Payer:", payerPublicKey.toBase58());

  // Fetch activity to get details
  const activity = await getActivity(activityId);
  if (!activity) {
    throw new Error("Request not found");
  }

  if (activity.status !== "open") {
    throw new Error("Request already fulfilled or cancelled");
  }

  // For requests, receiver_hash contains the actual address (not hashed)
  if (!activity.receiver_hash) {
    throw new Error("Request missing receiver address");
  }

  const receiverAddress = activity.receiver_hash;
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
      payerPublicKey.toBase58(),
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

    const finalBalance = await connection.getBalance(payerPublicKey);
    console.log("Final balance:", finalBalance, "lamports");

    // Step 3: Wait for indexer
    console.log("\n[3/4] Waiting for indexer (15s)...");
    await new Promise((r) => setTimeout(r, 15000));

    // Step 4: Withdraw to receiver (requester)
    console.log("\n[4/4] Withdrawing to receiver...");

    const encryptionService = new EncryptionService();
    encryptionService.deriveEncryptionKeyFromSignature(sessionSignature);

    const lightWasm = await WasmFactory.getInstance();

    const withdrawResult = await withdrawSPL({
      mintAddress,
      lightWasm,
      base_units: baseUnits,
      connection,
      encryptionService,
      publicKey: payerPublicKey,
      recipient: new PublicKey(receiverAddress),
      keyBasePath: path.join(process.cwd(), "node_modules/privacycash/circuit2/transaction2"),
      storage,
    });

    const withdrawTx = withdrawResult.tx;
    console.log("Withdraw tx:", withdrawTx);

    // Update activity status and add sender_hash
    await updateActivityStatus(activity.id, "settled", {
      tx_hash: withdrawTx,
      sender_hash: hashAddress(payerPublicKey.toBase58()),
    });

    console.log("Activity updated: settled");

    return {
      activityId,
      depositTx: depositSig,
      sweepTx: sweepSig,
      withdrawTx,
      finalBalance,
      amountReceived: withdrawResult.base_units / 1_000_000,
      feesPaid: withdrawResult.fee_base_units / 1_000_000,
    };
  } catch (error) {
    console.error("Submit fulfill failed:", error);
    throw error;
  }
}
