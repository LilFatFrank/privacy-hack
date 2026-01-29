/**
 * Test: Prepare/Submit Claim Link Flow via API
 *
 * Simulates the UI flow for claim links:
 * 1. Sender signs session message and creates a claim link (prepare + sign + submit)
 * 2. Receiver gets claim link info (public details)
 * 3. Receiver claims with passphrase
 *
 * Also tests sender reclaim flow:
 * 1. Sender creates claim link
 * 2. Sender reclaims before anyone claims
 */

import { describe, test, expect, beforeAll } from "bun:test";
import { Keypair, VersionedTransaction } from "@solana/web3.js";
import bs58 from "bs58";
import nacl from "tweetnacl";

import { SESSION_MESSAGE } from "../lib/sponsor/prepareAndSubmitSend";

// Test configuration
const API_BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
const TEST_PRIVATE_KEY = process.env.TEST_PRIVATE_KEY!;
const TEST_RECEIVER_PRIVATE_KEY = process.env.TEST_REQUESTOR_PRIVATE_KEY!; // Reusing requestor key as receiver

// Sanity check
if (!TEST_PRIVATE_KEY) {
  throw new Error("Missing environment variable: TEST_PRIVATE_KEY");
}
if (!TEST_RECEIVER_PRIVATE_KEY) {
  throw new Error("Missing environment variable: TEST_REQUESTOR_PRIVATE_KEY (used as receiver)");
}

describe("Prepare/Submit Claim Link Flow via API", () => {
  let senderKeypair: Keypair;
  let receiverKeypair: Keypair;
  let senderSessionSignature: string; // base64 encoded
  let receiverSessionSignature: string; // base64 encoded

  beforeAll(() => {
    senderKeypair = Keypair.fromSecretKey(bs58.decode(TEST_PRIVATE_KEY));
    receiverKeypair = Keypair.fromSecretKey(bs58.decode(TEST_RECEIVER_PRIVATE_KEY));

    const messageBytes = Buffer.from(SESSION_MESSAGE);

    // Sender signs session message
    const senderSigBytes = nacl.sign.detached(messageBytes, senderKeypair.secretKey);
    senderSessionSignature = Buffer.from(senderSigBytes).toString("base64");

    // Receiver signs session message (for potential reclaim scenarios)
    const receiverSigBytes = nacl.sign.detached(messageBytes, receiverKeypair.secretKey);
    receiverSessionSignature = Buffer.from(receiverSigBytes).toString("base64");

    console.log("=== Test Setup ===");
    console.log("API Base URL:", API_BASE_URL);
    console.log("Sender:", senderKeypair.publicKey.toBase58());
    console.log("Receiver:", receiverKeypair.publicKey.toBase58());
  });

  test("should create claim link and receiver claims with passphrase", async () => {
    // Skip if not mainnet test
    if (process.env.CONFIRM_MAINNET_TEST !== "true") {
      console.log("Skipping mainnet test. Set CONFIRM_MAINNET_TEST=true to run.");
      return;
    }

    const amount = 2; // 2 USDC
    const token = "USDC";

    // Step 1: Prepare claim link
    console.log("\n=== Step 1: POST /api/send_claim/prepare ===");

    const prepareRes = await fetch(`${API_BASE_URL}/api/send_claim/prepare`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Session-Signature": senderSessionSignature,
      },
      body: JSON.stringify({
        senderPublicKey: senderKeypair.publicKey.toBase58(),
        amount,
        token,
        message: "Test claim link",
      }),
    });

    if (!prepareRes.ok) {
      const error = await prepareRes.text();
      throw new Error(`Prepare failed: ${error}`);
    }

    const prepareResult = await prepareRes.json();

    console.log("Prepare result:");
    console.log("  Activity ID:", prepareResult.activityId);
    console.log("  Passphrase:", prepareResult.passphrase);
    console.log("  Burner Address:", prepareResult.burnerAddress);
    console.log("  Last valid block height:", prepareResult.lastValidBlockHeight);

    expect(prepareResult.activityId).toBeDefined();
    expect(prepareResult.passphrase).toBeDefined();
    expect(prepareResult.burnerAddress).toBeDefined();
    expect(prepareResult.unsignedDepositTx).toBeDefined();
    expect(prepareResult.unsignedSweepTx).toBeDefined();

    const activityId = prepareResult.activityId;
    const passphrase = prepareResult.passphrase;

    // Step 2: Sign transactions
    console.log("\n=== Step 2: Sign Transactions (simulated wallet) ===");

    const depositTxBytes = Buffer.from(prepareResult.unsignedDepositTx, "base64");
    const sweepTxBytes = Buffer.from(prepareResult.unsignedSweepTx, "base64");

    const depositTx = VersionedTransaction.deserialize(depositTxBytes);
    const sweepTx = VersionedTransaction.deserialize(sweepTxBytes);

    // Sender signs both transactions
    depositTx.sign([senderKeypair]);
    sweepTx.sign([senderKeypair]);

    const signedDepositTx = Buffer.from(depositTx.serialize()).toString("base64");
    const signedSweepTx = Buffer.from(sweepTx.serialize()).toString("base64");

    console.log("Transactions signed");

    // Step 3: Submit claim link creation
    console.log("\n=== Step 3: POST /api/send_claim/submit ===");

    const submitRes = await fetch(`${API_BASE_URL}/api/send_claim/submit`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Session-Signature": senderSessionSignature,
      },
      body: JSON.stringify({
        signedDepositTx,
        signedSweepTx,
        activityId,
        senderPublicKey: senderKeypair.publicKey.toBase58(),
        lastValidBlockHeight: prepareResult.lastValidBlockHeight,
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
    console.log("  Claim Link:", submitResult.claimLink);
    console.log("  Burner Address:", submitResult.burnerAddress);

    expect(submitResult.depositTx).toBeDefined();
    expect(submitResult.sweepTx).toBeDefined();
    expect(submitResult.withdrawTx).toBeDefined();
    expect(submitResult.claimLink).toContain("/claim/");

    // Step 4: Get claim link info (as receiver would see it)
    console.log("\n=== Step 4: GET /api/send_claim/[id] ===");

    const getRes = await fetch(`${API_BASE_URL}/api/send_claim/${activityId}`);

    if (!getRes.ok) {
      const error = await getRes.text();
      throw new Error(`Get claim link failed: ${error}`);
    }

    const getResult = await getRes.json();

    console.log("Claim link details:");
    console.log("  Amount:", getResult.amount);
    console.log("  Token:", getResult.token);
    console.log("  Status:", getResult.status);
    console.log("  Message:", getResult.message);

    expect(getResult.amount).toBe(amount);
    expect(getResult.status).toBe("open");

    // Step 5: Receiver claims with passphrase
    console.log("\n=== Step 5: POST /api/send_claim/claim ===");

    const claimRes = await fetch(`${API_BASE_URL}/api/send_claim/claim`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        activityId,
        passphrase,
        receiverAddress: receiverKeypair.publicKey.toBase58(),
      }),
    });

    if (!claimRes.ok) {
      const error = await claimRes.text();
      throw new Error(`Claim failed: ${error}`);
    }

    const claimResult = await claimRes.json();

    console.log("Claim result:");
    console.log("  Claim TX:", claimResult.claimTx);
    console.log("  Amount Received:", claimResult.amountReceived);
    console.log("  Token:", claimResult.token);

    expect(claimResult.claimTx).toBeDefined();
    expect(claimResult.amountReceived).toBeGreaterThan(0);
    expect(claimResult.amountReceived).toBeLessThanOrEqual(amount);
    console.log("  Fee paid:", (amount - claimResult.amountReceived).toFixed(6), "USDC");

    // Step 6: Verify claim link is now settled
    console.log("\n=== Step 6: Verify claim link status ===");

    const verifyRes = await fetch(`${API_BASE_URL}/api/send_claim/${activityId}`);
    const verifyResult = await verifyRes.json();

    console.log("Final status:", verifyResult.status);
    expect(verifyResult.status).toBe("settled");

    console.log("\n=== Test Complete ===");
    console.log("Receiver received:", claimResult.amountReceived, "USDC");
  }, 300000); // 5 minute timeout for API calls

  test("should create claim link and sender reclaims", async () => {
    // Skip if not mainnet test
    if (process.env.CONFIRM_MAINNET_TEST !== "true") {
      console.log("Skipping mainnet test. Set CONFIRM_MAINNET_TEST=true to run.");
      return;
    }

    const amount = 2; // 2 USDC
    const token = "USDC";

    // Step 1: Prepare claim link
    console.log("\n=== Reclaim Test: Step 1: POST /api/send_claim/prepare ===");

    const prepareRes = await fetch(`${API_BASE_URL}/api/send_claim/prepare`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Session-Signature": senderSessionSignature,
      },
      body: JSON.stringify({
        senderPublicKey: senderKeypair.publicKey.toBase58(),
        amount,
        token,
        message: "Test reclaim",
      }),
    });

    if (!prepareRes.ok) {
      const error = await prepareRes.text();
      throw new Error(`Prepare failed: ${error}`);
    }

    const prepareResult = await prepareRes.json();
    const activityId = prepareResult.activityId;

    console.log("Activity ID:", activityId);
    console.log("Passphrase:", prepareResult.passphrase);

    // Step 2: Sign and submit
    const depositTxBytes = Buffer.from(prepareResult.unsignedDepositTx, "base64");
    const sweepTxBytes = Buffer.from(prepareResult.unsignedSweepTx, "base64");

    const depositTx = VersionedTransaction.deserialize(depositTxBytes);
    const sweepTx = VersionedTransaction.deserialize(sweepTxBytes);

    depositTx.sign([senderKeypair]);
    sweepTx.sign([senderKeypair]);

    const signedDepositTx = Buffer.from(depositTx.serialize()).toString("base64");
    const signedSweepTx = Buffer.from(sweepTx.serialize()).toString("base64");

    console.log("\n=== Reclaim Test: Step 2: POST /api/send_claim/submit ===");

    const submitRes = await fetch(`${API_BASE_URL}/api/send_claim/submit`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Session-Signature": senderSessionSignature,
      },
      body: JSON.stringify({
        signedDepositTx,
        signedSweepTx,
        activityId,
        senderPublicKey: senderKeypair.publicKey.toBase58(),
        lastValidBlockHeight: prepareResult.lastValidBlockHeight,
      }),
    });

    if (!submitRes.ok) {
      const error = await submitRes.text();
      throw new Error(`Submit failed: ${error}`);
    }

    const submitResult = await submitRes.json();
    console.log("Claim link created:", submitResult.claimLink);

    // Step 3: Sender reclaims (before anyone claims)
    console.log("\n=== Reclaim Test: Step 3: POST /api/send_claim/reclaim ===");

    const reclaimRes = await fetch(`${API_BASE_URL}/api/send_claim/reclaim`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Session-Signature": senderSessionSignature,
      },
      body: JSON.stringify({
        activityId,
        senderPublicKey: senderKeypair.publicKey.toBase58(),
      }),
    });

    if (!reclaimRes.ok) {
      const error = await reclaimRes.text();
      throw new Error(`Reclaim failed: ${error}`);
    }

    const reclaimResult = await reclaimRes.json();

    console.log("Reclaim result:");
    console.log("  Reclaim TX:", reclaimResult.reclaimTx);
    console.log("  Amount Reclaimed:", reclaimResult.amountReclaimed);

    expect(reclaimResult.reclaimTx).toBeDefined();
    expect(reclaimResult.amountReclaimed).toBeGreaterThan(0);
    expect(reclaimResult.amountReclaimed).toBeLessThanOrEqual(amount);
    console.log("  Fee paid:", (amount - reclaimResult.amountReclaimed).toFixed(6), "USDC");

    // Step 4: Verify claim link is cancelled
    console.log("\n=== Reclaim Test: Step 4: Verify status ===");

    const verifyRes = await fetch(`${API_BASE_URL}/api/send_claim/${activityId}`);
    const verifyResult = await verifyRes.json();

    console.log("Final status:", verifyResult.status);
    expect(verifyResult.status).toBe("cancelled");

    console.log("\n=== Reclaim Test Complete ===");
  }, 300000);

  test("session message is correct", () => {
    expect(SESSION_MESSAGE).toBe("Privacy Money account sign in");
  });

  test("sender session signature is valid base64", () => {
    const decoded = Buffer.from(senderSessionSignature, "base64");
    expect(decoded.length).toBe(64);
  });
});
