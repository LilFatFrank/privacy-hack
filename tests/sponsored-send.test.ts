import "dotenv/config";
import { Connection, Keypair } from "@solana/web3.js";
import bs58 from "bs58";

import { sponsoredSend } from "../lib/sponsor/sponsoredSend";

const RECEIVER = "3ePJcbZTNca4utt78bXXqvAZQtboU7VumKdD7jWXwy9g";

async function main() {
  if (!process.env.TEST_PRIVATE_KEY) throw new Error("TEST_PRIVATE_KEY not set");
  if (!process.env.SPONSOR_PRIVATE_KEY) throw new Error("SPONSOR_PRIVATE_KEY not set");
  if (!process.env.RPC_URL) throw new Error("RPC_URL not set");

  const sender = Keypair.fromSecretKey(bs58.decode(process.env.TEST_PRIVATE_KEY));
  const sponsor = Keypair.fromSecretKey(bs58.decode(process.env.SPONSOR_PRIVATE_KEY));
  const connection = new Connection(process.env.RPC_URL, "confirmed");

  // Show initial balances
  const senderSol = await connection.getBalance(sender.publicKey);
  const sponsorSol = await connection.getBalance(sponsor.publicKey);
  console.log("Initial sender SOL:", senderSol / 1e9);
  console.log("Initial sponsor SOL:", sponsorSol / 1e9);

  const result = await sponsoredSend({
    connection,
    senderKeypair: sender,
    sponsorKeypair: sponsor,
    receiverAddress: RECEIVER,
    amount: 1.5,
    token: "USDC",
  });

  console.log("\n=== Result ===");
  console.log("Fund tx:", result.fundTx || "(not needed)");
  console.log("Deposit tx:", result.depositTx);
  console.log("Withdraw tx:", result.withdrawTx);
  console.log("Sweep tx:", result.sweepTx || "(not needed)");
  console.log("Amount sent:", result.amountSent, "USDC");
  console.log("Fees paid:", result.feesPaid, "USDC");

  // Show final balances
  const finalSenderSol = await connection.getBalance(sender.publicKey);
  const finalSponsorSol = await connection.getBalance(sponsor.publicKey);
  console.log("\nFinal sender SOL:", finalSenderSol / 1e9);
  console.log("Final sponsor SOL:", finalSponsorSol / 1e9);
  console.log("Sponsor SOL spent:", (sponsorSol - finalSponsorSol) / 1e9);
}

main().catch((err) => {
  console.error("TEST FAILED:", err);
  process.exit(1);
});
