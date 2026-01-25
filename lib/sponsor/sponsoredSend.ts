/**
 * Sponsored Send - Clean flow with no dust
 *
 * Flow:
 * 1. Sponsor pre-funds sender with exact rent for nullifier PDAs
 * 2. Sender deposits to PrivacyCash (using own SOL for rent + gas)
 * 3. Sponsor sweeps remaining SOL from sender (sponsor pays gas)
 *
 * This ensures sender doesn't need SOL and sponsor doesn't lose dust.
 */

import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  SystemProgram,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import { PrivacyCash } from "privacycash";
import { TOKEN_MINTS, TokenType } from "../privacycash/tokens";

// SDK requires minimum 0.002 SOL + rent for 2 nullifier PDAs
const SDK_MINIMUM = 2_000_000; // 0.002 SOL
const RENT_PER_PDA = 953520;
const NUM_PDAS = 2;
const TOTAL_PREFUND = SDK_MINIMUM + (RENT_PER_PDA * NUM_PDAS);

export interface SponsoredSendParams {
  connection: Connection;
  senderKeypair: Keypair;
  sponsorKeypair: Keypair;
  receiverAddress: string;
  amount: number; // In token units (e.g., 1.5 for $1.50 USDC)
  token: TokenType;
}

export interface SponsoredSendResult {
  fundTx: string;
  depositTx: string;
  withdrawTx: string;
  sweepTx: string | null;
  amountSent: number;
  feesPaid: number;
}

/**
 * Performs a sponsored send with automatic dust recovery.
 */
export async function sponsoredSend(
  params: SponsoredSendParams
): Promise<SponsoredSendResult> {
  const {
    connection,
    senderKeypair,
    sponsorKeypair,
    receiverAddress,
    amount,
    token,
  } = params;

  const baseUnits = Math.floor(amount * 1_000_000); // Assuming 6 decimals

  console.log("=== Sponsored Send ===");
  console.log("Sender:", senderKeypair.publicKey.toBase58());
  console.log("Sponsor:", sponsorKeypair.publicKey.toBase58());
  console.log("Receiver:", receiverAddress);
  console.log("Amount:", amount, token);

  // Step 1: Pre-fund sender with rent + gas buffer
  console.log("\n[1/4] Pre-funding sender with rent...");
  const senderBalance = await connection.getBalance(senderKeypair.publicKey);
  let fundTx = "";

  if (senderBalance < TOTAL_PREFUND) {
    const needed = TOTAL_PREFUND - senderBalance;
    const fundTransaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: sponsorKeypair.publicKey,
        toPubkey: senderKeypair.publicKey,
        lamports: needed,
      })
    );
    fundTx = await connection.sendTransaction(fundTransaction, [sponsorKeypair]);
    await connection.confirmTransaction(fundTx, "confirmed");
    console.log("Fund tx:", fundTx);
    console.log("Funded:", needed, "lamports");
  } else {
    console.log("Sender already has enough SOL");
  }

  // Step 2: Deposit to PrivacyCash
  console.log("\n[2/4] Depositing to PrivacyCash...");
  const client = new PrivacyCash({
    RPC_url: process.env.RPC_URL!,
    owner: senderKeypair.secretKey,
  });

  const depositResult = await client.depositSPL({
    mintAddress: TOKEN_MINTS[token],
    base_units: baseUnits,
  });
  console.log("Deposit tx:", depositResult.tx);

  // Step 3: Wait for indexer
  console.log("\n[3/4] Waiting for indexer (15s)...");
  await new Promise((r) => setTimeout(r, 15000));

  // Check private balance
  const privateBalance = await client.getPrivateBalanceUSDC();
  console.log("Private balance:", privateBalance.base_units / 1_000_000, token);

  // Step 4: Withdraw to receiver
  console.log("\n[4/4] Withdrawing to receiver...");
  const withdrawResult = await client.withdrawUSDC({
    base_units: baseUnits,
    recipientAddress: receiverAddress,
  });
  console.log("Withdraw tx:", withdrawResult.tx);

  // Step 5: Sweep ALL remaining SOL back to sponsor (closes the account)
  console.log("\n[5/5] Sweeping remaining SOL to sponsor...");
  let sweepTx: string | null = null;
  const remainingBalance = await connection.getBalance(senderKeypair.publicKey);
  console.log("Remaining balance:", remainingBalance, "lamports");

  if (remainingBalance > 0) {
    // Transfer ALL remaining SOL to close the account
    // Sponsor pays gas, so sender can send everything
    const { blockhash } = await connection.getLatestBlockhash();

    const sweepTransaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: senderKeypair.publicKey,
        toPubkey: sponsorKeypair.publicKey,
        lamports: remainingBalance, // ALL of it
      })
    );

    // Set sponsor as fee payer
    sweepTransaction.feePayer = sponsorKeypair.publicKey;
    sweepTransaction.recentBlockhash = blockhash;

    // Both sign: sender authorizes transfer, sponsor pays fee
    sweepTransaction.sign(senderKeypair, sponsorKeypair);

    sweepTx = await connection.sendRawTransaction(sweepTransaction.serialize());
    await connection.confirmTransaction(sweepTx, "confirmed");
    console.log("Sweep tx:", sweepTx);
    console.log("Swept:", remainingBalance, "lamports back to sponsor");
  } else {
    console.log("No balance to sweep");
  }

  // Final balance check
  const finalBalance = await connection.getBalance(senderKeypair.publicKey);
  console.log("Final sender balance:", finalBalance, "lamports");

  return {
    fundTx,
    depositTx: depositResult.tx,
    withdrawTx: withdrawResult.tx || String(withdrawResult),
    sweepTx,
    amountSent: (withdrawResult as any).base_units / 1_000_000,
    feesPaid: ((withdrawResult as any).fee_base_units || 0) / 1_000_000,
  };
}
