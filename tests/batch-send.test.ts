/**
 * Test batch sponsored send - user signs once
 */
import "dotenv/config";
import { Connection, Keypair } from "@solana/web3.js";
import bs58 from "bs58";

import {
  batchSponsoredSend,
  createTestSigner,
} from "../lib/sponsor/batchSponsoredSend";

const RECEIVER = "3ePJcbZTNca4utt78bXXqvAZQtboU7VumKdD7jWXwy9g";

async function main() {
  if (!process.env.TEST_PRIVATE_KEY) throw new Error("TEST_PRIVATE_KEY not set");
  if (!process.env.SPONSOR_PRIVATE_KEY) throw new Error("SPONSOR_PRIVATE_KEY not set");
  if (!process.env.RPC_URL) throw new Error("RPC_URL not set");

  const user = Keypair.fromSecretKey(bs58.decode(process.env.TEST_PRIVATE_KEY));
  const sponsor = Keypair.fromSecretKey(bs58.decode(process.env.SPONSOR_PRIVATE_KEY));
  const connection = new Connection(process.env.RPC_URL, "confirmed");

  console.log("=== Batch Sponsored Send Test ===");
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

  console.log("\n--- Starting batch send ---");
  console.log("User will sign ONCE for both deposit and sweep\n");

  const result = await batchSponsoredSend({
    connection,
    userKeypair: user,
    sponsorKeypair: sponsor,
    receiverAddress: RECEIVER,
    amount: 1.5,
    token: "USDC",
    signAllTransactions,
  });

  console.log("\n=== Result ===");
  console.log("Fund tx:", result.fundTx || "(not needed)");
  console.log("Deposit tx (includes sweep):", result.depositTx);

  // Show final balances
  const finalUserSol = await connection.getBalance(user.publicKey);
  const finalSponsorSol = await connection.getBalance(sponsor.publicKey);
  console.log("\nFinal user SOL:", finalUserSol / 1e9);
  console.log("Final sponsor SOL:", finalSponsorSol / 1e9);
  console.log("Sponsor SOL spent:", (sponsorSol - finalSponsorSol) / 1e9);
}

main().catch((err) => {
  console.error("TEST FAILED:", err);
  process.exit(1);
});
