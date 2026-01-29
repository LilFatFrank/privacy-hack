/**
 * Test: Prepare/Submit Request Fulfill Flow via API
 *
 * Simulates the UI flow for payment requests:
 * 1. Requester signs session message and creates a payment request
 * 2. Payer sees the request details
 * 3. Payer signs session message (once per session)
 * 4. Payer calls /api/request/fulfill/prepare to get unsigned transactions
 * 5. Payer signs transactions (simulated wallet)
 * 6. Payer calls /api/request/fulfill/submit to complete the payment
 */

import { describe, test, expect, beforeAll } from "bun:test";
import { Keypair, VersionedTransaction } from "@solana/web3.js";
import bs58 from "bs58";
import nacl from "tweetnacl";

import { SESSION_MESSAGE } from "../lib/sponsor/prepareAndSubmitSend";

// Test configuration
const API_BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
const TEST_PRIVATE_KEY = process.env.TEST_PRIVATE_KEY!;
const TEST_REQUESTOR_PRIVATE_KEY = process.env.TEST_REQUESTOR_PRIVATE_KEY!;

// Sanity check
if (!TEST_PRIVATE_KEY) {
  throw new Error("Missing environment variable: TEST_PRIVATE_KEY");
}
if (!TEST_REQUESTOR_PRIVATE_KEY) {
  throw new Error("Missing environment variable: TEST_REQUESTOR_PRIVATE_KEY");
}

describe("Prepare/Submit Request Fulfill Flow via API", () => {
  let payerKeypair: Keypair;
  let requestorKeypair: Keypair;
  let payerSessionSignature: string; // base64 encoded
  let requestorSessionSignature: string; // base64 encoded

  beforeAll(() => {
    payerKeypair = Keypair.fromSecretKey(bs58.decode(TEST_PRIVATE_KEY));
    requestorKeypair = Keypair.fromSecretKey(bs58.decode(TEST_REQUESTOR_PRIVATE_KEY));

    const messageBytes = Buffer.from(SESSION_MESSAGE);

    // Requestor signs session message (to create request)
    const requestorSigBytes = nacl.sign.detached(messageBytes, requestorKeypair.secretKey);
    requestorSessionSignature = Buffer.from(requestorSigBytes).toString("base64");

    // Payer signs session message (to fulfill request)
    const payerSigBytes = nacl.sign.detached(messageBytes, payerKeypair.secretKey);
    payerSessionSignature = Buffer.from(payerSigBytes).toString("base64");

    console.log("=== Test Setup ===");
    console.log("API Base URL:", API_BASE_URL);
    console.log("Requestor (receives funds):", requestorKeypair.publicKey.toBase58());
    console.log("Payer (sends funds):", payerKeypair.publicKey.toBase58());
  });

  test("should create, fetch, and fulfill request via API", async () => {
    // Skip if not mainnet test
    if (process.env.CONFIRM_MAINNET_TEST !== "true") {
      console.log("Skipping mainnet test. Set CONFIRM_MAINNET_TEST=true to run.");
      return;
    }

    const amount = 2; // 2 USDC
    const token = "USDC";

    // Step 1: Create a payment request (requestor must be logged in)
    console.log("\n=== Step 1: POST /api/request/create ===");

    const createRes = await fetch(`${API_BASE_URL}/api/request/create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Session-Signature": requestorSessionSignature,
      },
      body: JSON.stringify({
        requesterAddress: requestorKeypair.publicKey.toBase58(),
        amount,
        token,
        message: "Test request payment",
      }),
    });

    if (!createRes.ok) {
      const error = await createRes.text();
      throw new Error(`Create request failed: ${error}`);
    }

    const createResult = await createRes.json();

    console.log("Create result:");
    console.log("  Activity ID:", createResult.activityId);
    console.log("  Request Link:", createResult.requestLink);

    expect(createResult.activityId).toBeDefined();
    expect(createResult.requestLink).toContain("/pay/");

    const activityId = createResult.activityId;

    // Step 2: Fetch request details (as payer would see it)
    console.log("\n=== Step 2: GET /api/request/[id] ===");

    const getRes = await fetch(`${API_BASE_URL}/api/request/${activityId}`);

    if (!getRes.ok) {
      const error = await getRes.text();
      throw new Error(`Get request failed: ${error}`);
    }

    const getResult = await getRes.json();

    console.log("Request details:");
    console.log("  Amount:", getResult.amount);
    console.log("  Token:", getResult.token);
    console.log("  Status:", getResult.status);
    console.log("  Message:", getResult.message);
    console.log("  Receiver:", getResult.receiverAddress);

    expect(getResult.amount).toBe(amount);
    expect(getResult.status).toBe("open");
    expect(getResult.receiverAddress).toBe(requestorKeypair.publicKey.toBase58());

    // Step 3: Prepare fulfill (payer prepares to pay)
    console.log("\n=== Step 3: POST /api/request/fulfill/prepare ===");

    const prepareRes = await fetch(`${API_BASE_URL}/api/request/fulfill/prepare`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Session-Signature": payerSessionSignature,
      },
      body: JSON.stringify({
        activityId,
        payerPublicKey: payerKeypair.publicKey.toBase58(),
      }),
    });

    if (!prepareRes.ok) {
      const error = await prepareRes.text();
      throw new Error(`Prepare fulfill failed: ${error}`);
    }

    const prepareResult = await prepareRes.json();

    console.log("Prepare result:");
    console.log("  Activity ID:", prepareResult.activityId);
    console.log("  Fund TX:", prepareResult.fundTx || "(not needed)");
    console.log("  Sweep amount:", prepareResult.sweepAmount, "lamports");
    console.log("  Last valid block height:", prepareResult.lastValidBlockHeight);
    console.log("  Amount:", prepareResult.amount, prepareResult.token);
    console.log("  Receiver:", prepareResult.receiverAddress);

    expect(prepareResult.activityId).toBe(activityId);
    expect(prepareResult.unsignedDepositTx).toBeDefined();
    expect(prepareResult.unsignedSweepTx).toBeDefined();
    expect(prepareResult.lastValidBlockHeight).toBeDefined();
    expect(prepareResult.amount).toBe(amount);
    expect(prepareResult.receiverAddress).toBe(requestorKeypair.publicKey.toBase58());

    // Step 4: Sign transactions (simulating wallet.signAllTransactions)
    console.log("\n=== Step 4: Sign Transactions (simulated wallet) ===");

    const depositTxBytes = Buffer.from(prepareResult.unsignedDepositTx, "base64");
    const sweepTxBytes = Buffer.from(prepareResult.unsignedSweepTx, "base64");

    const depositTx = VersionedTransaction.deserialize(depositTxBytes);
    const sweepTx = VersionedTransaction.deserialize(sweepTxBytes);

    // Payer signs both transactions (ONE wallet popup in real UI)
    depositTx.sign([payerKeypair]);
    sweepTx.sign([payerKeypair]);

    const signedDepositTx = Buffer.from(depositTx.serialize()).toString("base64");
    const signedSweepTx = Buffer.from(sweepTx.serialize()).toString("base64");

    console.log("Transactions signed (would be 1 popup in real wallet)");

    // Step 5: Submit fulfill
    console.log("\n=== Step 5: POST /api/request/fulfill/submit ===");

    const submitRes = await fetch(`${API_BASE_URL}/api/request/fulfill/submit`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Session-Signature": payerSessionSignature,
      },
      body: JSON.stringify({
        signedDepositTx,
        signedSweepTx,
        activityId,
        payerPublicKey: payerKeypair.publicKey.toBase58(),
        lastValidBlockHeight: prepareResult.lastValidBlockHeight,
      }),
    });

    if (!submitRes.ok) {
      const error = await submitRes.text();
      throw new Error(`Submit fulfill failed: ${error}`);
    }

    const submitResult = await submitRes.json();

    console.log("Submit result:");
    console.log("  Deposit TX:", submitResult.depositTx);
    console.log("  Sweep TX:", submitResult.sweepTx);
    console.log("  Withdraw TX:", submitResult.withdrawTx);
    console.log("  Final balance:", submitResult.finalBalance, "lamports");
    console.log("  Amount received:", submitResult.amountReceived);
    console.log("  Fees paid:", submitResult.feesPaid);

    expect(submitResult.depositTx).toBeDefined();
    expect(submitResult.sweepTx).toBeDefined();
    expect(submitResult.withdrawTx).toBeDefined();
    expect(submitResult.finalBalance).toBe(0);

    // Step 6: Verify request is now settled
    console.log("\n=== Step 6: Verify request status ===");

    const verifyRes = await fetch(`${API_BASE_URL}/api/request/${activityId}`);
    const verifyResult = await verifyRes.json();

    console.log("Final status:", verifyResult.status);
    expect(verifyResult.status).toBe("settled");

    console.log("\n=== Test Complete ===");
    console.log("Requester received:", submitResult.amountReceived, "USDC");
    console.log("Fees (paid by requester):", submitResult.feesPaid, "USDC");
  }, 180000); // 3 minute timeout for API calls

  test("session message is correct", () => {
    expect(SESSION_MESSAGE).toBe("Privacy Money account sign in");
  });

  test("payer session signature is valid base64", () => {
    const decoded = Buffer.from(payerSessionSignature, "base64");
    expect(decoded.length).toBe(64);
  });

  test("requestor session signature is valid base64", () => {
    const decoded = Buffer.from(requestorSessionSignature, "base64");
    expect(decoded.length).toBe(64);
  });
});
