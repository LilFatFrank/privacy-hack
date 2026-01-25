/**
 * Batch Sponsored Send - User signs once for deposit + sweep
 *
 * Flow:
 * 1. Sponsor pre-funds user with SOL (sponsor signs alone)
 * 2. User signs ONE transaction containing:
 *    - Deposit to PrivacyCash
 *    - Sweep remaining SOL back to sponsor
 * 3. Transaction submitted to relayer
 *
 * User signs only ONCE. Deposit and sweep are atomic.
 */

import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  SystemProgram,
  VersionedTransaction,
  TransactionInstruction,
} from "@solana/web3.js";
import * as path from "path";
import { LocalStorage } from "node-localstorage";
import { WasmFactory } from "@lightprotocol/hasher.rs";
import { EncryptionService } from "privacycash/dist/utils/encryption.js";

import { sponsoredDepositSPL } from "../privacycash/sponsoredDeposit";
import { TOKEN_MINTS, TokenType } from "../privacycash/tokens";

// Rent for 2 nullifier PDAs + SDK minimum
const RENT_LAMPORTS = 953520 * 2;
const SDK_MINIMUM = 2_000_000;
const TOTAL_PREFUND = RENT_LAMPORTS + SDK_MINIMUM;

// Storage for UTXO cache
const storage = new LocalStorage(path.join(process.cwd(), "cache"));

export interface BatchSponsoredSendParams {
  connection: Connection;
  userKeypair: Keypair;
  sponsorKeypair: Keypair;
  receiverAddress: string;
  amount: number;
  token: TokenType;
  // Wallet adapter's signAllTransactions function
  // In production, this comes from wallet adapter
  // In tests, we simulate it with the keypair
  signAllTransactions: (txs: VersionedTransaction[]) => Promise<VersionedTransaction[]>;
}

export interface BatchSponsoredSendResult {
  fundTx: string;
  depositTx: string; // This tx includes the sweep instruction
}

/**
 * Performs a sponsored send with batch signing.
 * User signs only once (deposit + sweep in same transaction).
 */
export async function batchSponsoredSend(
  params: BatchSponsoredSendParams
): Promise<BatchSponsoredSendResult> {
  const {
    connection,
    userKeypair,
    sponsorKeypair,
    receiverAddress,
    amount,
    token,
    signAllTransactions,
  } = params;

  const userPublicKey = userKeypair.publicKey;
  const baseUnits = Math.floor(amount * 1_000_000);

  console.log("=== Batch Sponsored Send ===");
  console.log("User:", userPublicKey.toBase58());
  console.log("Sponsor:", sponsorKeypair.publicKey.toBase58());
  console.log("Receiver:", receiverAddress);
  console.log("Amount:", amount, token);

  // Step 1: Pre-fund user with SOL (sponsor signs alone)
  console.log("\n[1/2] Pre-funding user with SOL...");
  const userBalance = await connection.getBalance(userPublicKey);

  let fundTx = "";
  if (userBalance < TOTAL_PREFUND) {
    const needed = TOTAL_PREFUND - userBalance;
    const fundTransaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: sponsorKeypair.publicKey,
        toPubkey: userPublicKey,
        lamports: needed,
      })
    );
    fundTx = await connection.sendTransaction(fundTransaction, [sponsorKeypair]);
    await connection.confirmTransaction(fundTx, "confirmed");
    console.log("Fund tx:", fundTx);
    console.log("Funded:", needed, "lamports");
  } else {
    console.log("User already has enough SOL");
  }

  // Step 2: Deposit with sweep instruction included
  console.log("\n[2/2] Depositing (with sweep instruction)...");
  console.log("User will sign ONE transaction for deposit + sweep");

  // Initialize SDK components
  const lightWasm = await WasmFactory.getInstance();
  const encryptionService = new EncryptionService();
  encryptionService.deriveEncryptionKeyFromWallet(userKeypair);

  // Calculate sweep amount based on current balance
  // User's current balance - (PDA rent + tx fee) = remaining after deposit
  // Must leave rent-exempt minimum (~890K) OR sweep everything (can't calculate exactly)
  // We choose to leave rent-exempt minimum to ensure tx succeeds
  const currentBalance = await connection.getBalance(userPublicKey);
  const pdaRent = RENT_LAMPORTS; // 1,907,040 lamports for 2 PDAs
  const txFeeEstimate = 6000; // Conservative tx fee estimate
  const rentExemptMin = 890880; // Minimum for a basic account
  const estimatedRemaining = currentBalance - pdaRent - txFeeEstimate;
  const sweepAmount = Math.max(0, estimatedRemaining - rentExemptMin);

  console.log("Current balance:", currentBalance, "lamports");
  console.log("Estimated remaining after deposit:", estimatedRemaining, "lamports");
  console.log("Sweep amount:", sweepAmount, "lamports");
  console.log("Will leave ~", rentExemptMin, "lamports for rent");

  const sweepInstruction = SystemProgram.transfer({
    fromPubkey: userPublicKey,
    toPubkey: sponsorKeypair.publicKey,
    lamports: sweepAmount,
  });

  // Transaction signer that uses wallet's signAllTransactions
  // Since we're putting everything in one tx, we just sign that one tx
  const transactionSigner = async (tx: VersionedTransaction) => {
    const [signedTx] = await signAllTransactions([tx]);
    return signedTx;
  };

  // Call sponsoredDepositSPL with sweep as additional instruction
  const depositResult = await sponsoredDepositSPL({
    lightWasm,
    storage,
    keyBasePath: path.join(
      process.cwd(),
      "node_modules",
      "privacycash",
      "circuit2",
      "transaction2"
    ),
    publicKey: userPublicKey,
    connection,
    base_units: baseUnits,
    encryptionService,
    transactionSigner,
    mintAddress: TOKEN_MINTS[token],
    signer: userPublicKey,
    // User pays gas (from pre-funded SOL), NOT sponsor
    // This keeps tx size under limit
    feePayer: undefined, // undefined = signer pays
    additionalInstructions: [sweepInstruction],
  });

  console.log("Deposit tx (includes sweep):", depositResult.tx);

  // Verify final balance
  const finalBalance = await connection.getBalance(userPublicKey);
  console.log("Final user balance:", finalBalance, "lamports");

  return {
    fundTx,
    depositTx: depositResult.tx,
  };
}

/**
 * Test helper: Simulates wallet.signAllTransactions using a keypair
 */
export function createTestSigner(keypair: Keypair) {
  return async (txs: VersionedTransaction[]): Promise<VersionedTransaction[]> => {
    return txs.map((tx) => {
      tx.sign([keypair]);
      return tx;
    });
  };
}
