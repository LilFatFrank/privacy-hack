/**
 * Test: Prepare/Submit Send Flow via API
 *
 * Simulates the UI flow:
 * 1. Sign session message (once per session)
 * 2. Call /api/send/prepare to get unsigned transactions
 * 3. Sign transactions (simulated wallet)
 * 4. Call /api/send/submit to complete the send
 */

import { describe, test, expect, beforeAll } from "bun:test";
import { Keypair, VersionedTransaction } from "@solana/web3.js";
import bs58 from "bs58";
import nacl from "tweetnacl";

import { SESSION_MESSAGE } from "../lib/sponsor/prepareAndSubmitSend";

// Test configuration
const API_BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
const TEST_PRIVATE_KEY = process.env.TEST_PRIVATE_KEY!;

// Sanity check
if (!TEST_PRIVATE_KEY) {
  throw new Error("Missing environment variable: TEST_PRIVATE_KEY");
}

describe("Prepare/Submit Send Flow via API", () => {
  let userKeypair: Keypair;
  let sessionSignature: string; // base64 encoded

  beforeAll(() => {
    userKeypair = Keypair.fromSecretKey(bs58.decode(TEST_PRIVATE_KEY));

    // Simulate: User signs session message when connecting wallet
    const messageBytes = Buffer.from(SESSION_MESSAGE);
    const sigBytes = nacl.sign.detached(messageBytes, userKeypair.secretKey);
    sessionSignature = Buffer.from(sigBytes).toString("base64");

    console.log("=== Test Setup ===");
    console.log("API Base URL:", API_BASE_URL);
    console.log("User:", userKeypair.publicKey.toBase58());
    console.log("Session signature:", sessionSignature.slice(0, 20) + "...");
  });

  test("should prepare and submit via API", async () => {
    // Skip if not mainnet test
    if (process.env.CONFIRM_MAINNET_TEST !== "true") {
      console.log("Skipping mainnet test. Set CONFIRM_MAINNET_TEST=true to run.");
      return;
    }

    const receiverAddress = "3ePJcbZTNca4utt78bXXqvAZQtboU7VumKdD7jWXwy9g";
    const amount = 2; // 2 USDC
    const token = "USDC";

    // Step 1: Call /api/send/prepare
    console.log("\n=== Step 1: POST /api/send/prepare ===");

    const prepareRes = await fetch(`${API_BASE_URL}/api/send/prepare`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Session-Signature": sessionSignature,
      },
      body: JSON.stringify({
        senderPublicKey: userKeypair.publicKey.toBase58(),
        receiverAddress,
        amount,
        token,
      }),
    });

    if (!prepareRes.ok) {
      const error = await prepareRes.text();
      throw new Error(`Prepare failed: ${error}`);
    }

    const prepareResult = await prepareRes.json();

    console.log("Prepare result:");
    console.log("  Activity ID:", prepareResult.activityId);
    console.log("  Fund TX:", prepareResult.fundTx || "(not needed)");
    console.log("  Sweep amount:", prepareResult.sweepAmount, "lamports");

    expect(prepareResult.activityId).toBeDefined();
    expect(prepareResult.unsignedDepositTx).toBeDefined();
    expect(prepareResult.unsignedSweepTx).toBeDefined();

    // Step 2: Sign transactions (simulating wallet.signAllTransactions)
    console.log("\n=== Step 2: Sign Transactions (simulated wallet) ===");

    const depositTxBytes = Buffer.from(prepareResult.unsignedDepositTx, "base64");
    const sweepTxBytes = Buffer.from(prepareResult.unsignedSweepTx, "base64");

    const depositTx = VersionedTransaction.deserialize(depositTxBytes);
    const sweepTx = VersionedTransaction.deserialize(sweepTxBytes);

    // User signs both transactions (ONE wallet popup in real UI)
    depositTx.sign([userKeypair]);
    sweepTx.sign([userKeypair]);

    const signedDepositTx = Buffer.from(depositTx.serialize()).toString("base64");
    const signedSweepTx = Buffer.from(sweepTx.serialize()).toString("base64");

    console.log("Transactions signed (would be 1 popup in real wallet)");

    // Step 3: Call /api/send/submit
    console.log("\n=== Step 3: POST /api/send/submit ===");

    const submitRes = await fetch(`${API_BASE_URL}/api/send/submit`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Session-Signature": sessionSignature,
      },
      body: JSON.stringify({
        signedDepositTx,
        signedSweepTx,
        activityId: prepareResult.activityId,
        senderPublicKey: userKeypair.publicKey.toBase58(),
        receiverAddress,
        amount,
        token,
      }),
    });

    if (!submitRes.ok) {
      const error = await submitRes.text();
      throw new Error(`Submit failed: ${error}`);
    }

    const submitResult = await submitRes.json();

    console.log("Submit result:");
    console.log("  Deposit TX:", submitResult.depositTx);
    console.log("  Sweep TX:", submitResult.sweepTx);
    console.log("  Withdraw TX:", submitResult.withdrawTx);
    console.log("  Final balance:", submitResult.finalBalance, "lamports");

    expect(submitResult.depositTx).toBeDefined();
    expect(submitResult.sweepTx).toBeDefined();
    expect(submitResult.withdrawTx).toBeDefined();
    expect(submitResult.finalBalance).toBe(0);

    console.log("\n=== Test Complete ===");
  }, 180000); // 3 minute timeout for API calls

  test("session message is correct", () => {
    expect(SESSION_MESSAGE).toBe("Privacy Money account sign in");
  });

  test("session signature is valid base64", () => {
    const decoded = Buffer.from(sessionSignature, "base64");
    expect(decoded.length).toBe(64);
  });
});
