/**
 * Test simulated batch send - zero dust, one signature
 */
import "dotenv/config";
import { Connection, Keypair } from "@solana/web3.js";
import bs58 from "bs58";

import {
  simulatedBatchSend,
  createTestSigner,
} from "../lib/sponsor/simulatedBatchSend";

const RECEIVER = "3ePJcbZTNca4utt78bXXqvAZQtboU7VumKdD7jWXwy9g";

async function main() {
  if (!process.env.TEST_PRIVATE_KEY) throw new Error("TEST_PRIVATE_KEY not set");
  if (!process.env.SPONSOR_PRIVATE_KEY) throw new Error("SPONSOR_PRIVATE_KEY not set");
  if (!process.env.RPC_URL) throw new Error("RPC_URL not set");

  const user = Keypair.fromSecretKey(bs58.decode(process.env.TEST_PRIVATE_KEY));
  const sponsor = Keypair.fromSecretKey(bs58.decode(process.env.SPONSOR_PRIVATE_KEY));
  const connection = new Connection(process.env.RPC_URL, "confirmed");

  console.log("=== Simulated Batch Send Test (Zero Dust) ===");
  console.log("User:", user.publicKey.toBase58());
  console.log("Sponsor:", sponsor.publicKey.toBase58());
  console.log("Receiver:", RECEIVER);

  // Show initial balances
  const userSol = await connection.getBalance(user.publicKey);
  const sponsorSol = await connection.getBalance(sponsor.publicKey);
  console.log("\nInitial user SOL:", userSol / 1e9);
  console.log("Initial sponsor SOL:", sponsorSol / 1e9);

  // Create test signer (simulates wallet.signAllTransactions)
  const signAllTransactions = createTestSigner(user);

  console.log("\n--- Starting simulated batch send ---");
  console.log("Flow:");
  console.log("1. Pre-fund user with SOL");
  console.log("2. Build deposit tx (don't submit)");
  console.log("3. Simulate deposit to get exact remaining");
  console.log("4. Build sweep tx with exact amount");
  console.log("5. Batch sign BOTH (ONE wallet popup)");
  console.log("6. Submit deposit to relayer, sweep to network");
  console.log("");

  const result = await simulatedBatchSend({
    connection,
    userKeypair: user,
    sponsorKeypair: sponsor,
    receiverAddress: RECEIVER,
    amount: 1.5,
    token: "USDC",
    signAllTransactions,
  });

  console.log("\n=== Result ===");
  console.log("Activity ID:", result.activityId);
  console.log("Fund tx:", result.fundTx || "(not needed)");
  console.log("Deposit tx:", result.depositTx);
  console.log("Withdraw tx:", result.withdrawTx);
  console.log("Sweep tx:", result.sweepTx);
  console.log("Final balance:", result.finalBalance, "lamports");

  // Show final balances
  const finalUserSol = await connection.getBalance(user.publicKey);
  const finalSponsorSol = await connection.getBalance(sponsor.publicKey);
  console.log("\nFinal user SOL:", finalUserSol / 1e9);
  console.log("Final sponsor SOL:", finalSponsorSol / 1e9);
  console.log("Sponsor SOL spent:", (sponsorSol - finalSponsorSol) / 1e9);

  if (finalUserSol === 0) {
    console.log("\n✅ SUCCESS: Zero dust! User's SOL balance is exactly 0");
  } else {
    console.log("\n⚠️  DUST REMAINING:", finalUserSol, "lamports (~$" + (finalUserSol / 1e9 * 150).toFixed(4) + ")");
  }
}

main().catch((err) => {
  console.error("TEST FAILED:", err);
  process.exit(1);
});
