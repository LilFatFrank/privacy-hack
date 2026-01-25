import "dotenv/config";
import { Connection, Keypair, Transaction, SystemProgram } from "@solana/web3.js";
import bs58 from "bs58";
import { PrivacyCash } from "privacycash";

import { TOKEN_MINTS } from "../lib/privacycash/tokens";
import { atomicSponsoredDeposit } from "../lib/sponsor/atomicSponsor";

const RECEIVER = "3ePJcbZTNca4utt78bXXqvAZQtboU7VumKdD7jWXwy9g";
const USDC_AMOUNT = 1.5;
const USDC_BASE_UNITS = USDC_AMOUNT * 1_000_000;
const RENT_LAMPORTS = 953520 * 2; // Rent for 2 nullifier PDAs

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  if (!process.env.TEST_PRIVATE_KEY) throw new Error("TEST_PRIVATE_KEY not set");
  if (!process.env.SPONSOR_PRIVATE_KEY) throw new Error("SPONSOR_PRIVATE_KEY not set");
  if (!process.env.RPC_URL) throw new Error("RPC_URL not set");

  const sender = Keypair.fromSecretKey(bs58.decode(process.env.TEST_PRIVATE_KEY));
  const sponsor = Keypair.fromSecretKey(bs58.decode(process.env.SPONSOR_PRIVATE_KEY));
  const connection = new Connection(process.env.RPC_URL, "confirmed");

  console.log("=== Atomic Sponsored Send Test ===");
  console.log("Sender:", sender.publicKey.toBase58());
  console.log("Sponsor:", sponsor.publicKey.toBase58());
  console.log("Receiver:", RECEIVER);
  console.log("Amount:", USDC_AMOUNT, "USDC");

  let senderSol = await connection.getBalance(sender.publicKey);
  const sponsorSol = await connection.getBalance(sponsor.publicKey);
  console.log("\nSender SOL:", senderSol / 1e9);
  console.log("Sponsor SOL:", sponsorSol / 1e9);

  // Step 1: Fund sender with exact rent amount
  console.log("\n--- Step 1: Fund Sender with Rent ---");
  if (senderSol < RENT_LAMPORTS) {
    console.log("Transferring", RENT_LAMPORTS, "lamports for rent...");
    const fundTx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: sponsor.publicKey,
        toPubkey: sender.publicKey,
        lamports: RENT_LAMPORTS,
      })
    );
    const fundSig = await connection.sendTransaction(fundTx, [sponsor]);
    await connection.confirmTransaction(fundSig, "confirmed");
    console.log("Fund tx:", fundSig);
    senderSol = await connection.getBalance(sender.publicKey);
    console.log("Sender SOL now:", senderSol, "lamports");
  } else {
    console.log("Sender already has enough for rent");
  }

  // Step 2: Atomic sponsored deposit (sponsor pays gas, sender has rent)
  console.log("\n--- Step 2: Atomic Sponsored Deposit ---");
  console.log("Sender signs + provides rent, sponsor pays gas");

  const depositResult = await atomicSponsoredDeposit({
    connection,
    userKeypair: sender,
    sponsorKeypair: sponsor,
    mintAddress: TOKEN_MINTS.USDC,
    baseUnits: USDC_BASE_UNITS,
  });

  console.log("Deposit tx:", depositResult.tx);

  // Check sender balance after deposit (should be ~0)
  const senderSolAfter = await connection.getBalance(sender.publicKey);
  console.log("Sender SOL after deposit:", senderSolAfter, "lamports (dust)");

  // Step 3: Wait for indexer
  console.log("\n--- Step 3: Waiting for Indexer ---");
  await sleep(15_000);

  // Step 4: Withdraw
  console.log("\n--- Step 4: Withdraw to Receiver ---");
  const client = new PrivacyCash({
    RPC_url: process.env.RPC_URL,
    owner: sender.secretKey,
  });

  const withdrawResult = await client.withdrawUSDC({
    base_units: USDC_BASE_UNITS,
    recipientAddress: RECEIVER,
  });

  console.log("Withdraw:", withdrawResult);
  console.log("\n=== Atomic Send Complete ===");
}

main().catch((err) => {
  console.error("TEST FAILED:", err);
  process.exit(1);
});
