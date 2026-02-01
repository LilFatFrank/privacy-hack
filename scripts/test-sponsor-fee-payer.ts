/**
 * Test: Can sponsor be the fee payer for deposit?
 *
 * Builds two deposit transactions:
 * 1. User as fee payer (current)
 * 2. Sponsor as fee payer (new)
 *
 * Simulates both to verify sponsor payment works.
 *
 * Run: bun scripts/test-sponsor-fee-payer.ts
 */

import { Connection, Keypair } from "@solana/web3.js";
import bs58 from "bs58";
import nacl from "tweetnacl";
import dotenv from "dotenv";
import * as path from "path";
import { LocalStorage } from "node-localstorage";

dotenv.config();

import { buildDepositSPLTransaction } from "../lib/sponsor/depositBuilder";
import { SESSION_MESSAGE } from "../lib/sponsor/prepareAndSubmitSend";

const storage = new LocalStorage(path.join(process.cwd(), "cache"));

async function testSponsorFeePayer() {
  console.log("=== Testing Sponsor as Fee Payer for Deposit ===\n");

  const rpcUrl = process.env.RPC_URL;
  const sponsorKey = process.env.SPONSOR_PRIVATE_KEY;
  const testUserKey = process.env.TEST_PRIVATE_KEY;

  if (!rpcUrl || !sponsorKey || !testUserKey) {
    throw new Error("Missing RPC_URL, SPONSOR_PRIVATE_KEY, or TEST_PRIVATE_KEY in .env");
  }

  const connection = new Connection(rpcUrl, "confirmed");
  const sponsorKeypair = Keypair.fromSecretKey(bs58.decode(sponsorKey));
  const userKeypair = Keypair.fromSecretKey(bs58.decode(testUserKey));

  console.log("Sponsor:", sponsorKeypair.publicKey.toBase58());
  console.log("User:", userKeypair.publicKey.toBase58());

  const sponsorBalance = await connection.getBalance(sponsorKeypair.publicKey);
  const userBalance = await connection.getBalance(userKeypair.publicKey);
  console.log("\nSponsor SOL:", sponsorBalance / 1e9);
  console.log("User SOL:", userBalance / 1e9);

  // Session signature
  const messageBytes = Buffer.from(SESSION_MESSAGE);
  const sessionSignature = nacl.sign.detached(messageBytes, userKeypair.secretKey);

  // ============================================
  // Test 1: User as fee payer (current behavior)
  // ============================================
  console.log("\n" + "=".repeat(50));
  console.log("TEST 1: User as fee payer (current)");
  console.log("=".repeat(50));

  const userPayerResult = await buildDepositSPLTransaction({
    connection,
    userPublicKey: userKeypair.publicKey,
    sessionSignature,
    baseUnits: 1_000_000, // 1 USDC
    token: "USDC",
    storage,
    // No sponsorPublicKey = user pays
  });

  const userPayerTx = userPayerResult.transaction;
  console.log("Fee payer:", userPayerTx.message.staticAccountKeys[0].toBase58());
  console.log("Expected:", userKeypair.publicKey.toBase58());
  console.log("Match:", userPayerTx.message.staticAccountKeys[0].equals(userKeypair.publicKey) ? "✅" : "❌");

  // User signs
  userPayerTx.sign([userKeypair]);

  const sim1 = await connection.simulateTransaction(userPayerTx, {
    sigVerify: false,
    replaceRecentBlockhash: true,
  });

  if (sim1.value.err) {
    console.log("\n❌ Simulation FAILED:");
    console.log("Error:", JSON.stringify(sim1.value.err));
    console.log("Logs:", sim1.value.logs?.slice(-5));
  } else {
    console.log("\n✅ Simulation PASSED");
    console.log("Units consumed:", sim1.value.unitsConsumed);
  }

  // ============================================
  // Test 2: Sponsor as fee payer (new behavior)
  // ============================================
  console.log("\n" + "=".repeat(50));
  console.log("TEST 2: Sponsor as fee payer (NEW)");
  console.log("=".repeat(50));

  const sponsorPayerResult = await buildDepositSPLTransaction({
    connection,
    userPublicKey: userKeypair.publicKey,
    sessionSignature,
    baseUnits: 1_000_000, // 1 USDC
    token: "USDC",
    storage,
    sponsorPublicKey: sponsorKeypair.publicKey, // Sponsor pays!
  });

  const sponsorPayerTx = sponsorPayerResult.transaction;
  console.log("Fee payer:", sponsorPayerTx.message.staticAccountKeys[0].toBase58());
  console.log("Expected:", sponsorKeypair.publicKey.toBase58());
  console.log("Match:", sponsorPayerTx.message.staticAccountKeys[0].equals(sponsorKeypair.publicKey) ? "✅" : "❌");

  // Both sponsor AND user sign
  sponsorPayerTx.sign([sponsorKeypair, userKeypair]);

  const sim2 = await connection.simulateTransaction(sponsorPayerTx, {
    sigVerify: false,
    replaceRecentBlockhash: true,
  });

  if (sim2.value.err) {
    console.log("\n❌ Simulation FAILED:");
    console.log("Error:", JSON.stringify(sim2.value.err));
    console.log("Logs:", sim2.value.logs?.slice(-5));
  } else {
    console.log("\n✅ Simulation PASSED");
    console.log("Units consumed:", sim2.value.unitsConsumed);
  }

  // ============================================
  // Summary
  // ============================================
  console.log("\n" + "=".repeat(50));
  console.log("SUMMARY");
  console.log("=".repeat(50));

  const test1Passed = !sim1.value.err;
  const test2Passed = !sim2.value.err;

  console.log("User as payer:", test1Passed ? "✅ WORKS" : "❌ FAILED");
  console.log("Sponsor as payer:", test2Passed ? "✅ WORKS" : "❌ FAILED");

  if (test2Passed) {
    console.log("\n🎉 SPONSOR AS FEE PAYER WORKS!");
    console.log("We can simplify the flow - no need for fund/sweep!");
  } else {
    console.log("\n⚠️ Sponsor as fee payer doesn't work.");
    console.log("Need to keep the current fund/sweep flow.");
  }
}

testSponsorFeePayer().catch(console.error);
