import { NextRequest, NextResponse } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";
import nacl from "tweetnacl";

import { submitFulfill } from "@/lib/sponsor/prepareAndSubmitFulfill";
import { SESSION_MESSAGE } from "@/lib/sponsor/prepareAndSubmitSend";

export async function POST(request: NextRequest) {
  try {
    // Get session signature from header
    const sessionSignature = request.headers.get("X-Session-Signature");
    if (!sessionSignature) {
      return NextResponse.json(
        { error: "Missing X-Session-Signature header" },
        { status: 401 }
      );
    }

    const sessionSigBytes = Buffer.from(sessionSignature, "base64");
    if (sessionSigBytes.length !== 64) {
      return NextResponse.json(
        { error: "Session signature must be 64 bytes" },
        { status: 401 }
      );
    }

    const body = await request.json();

    const {
      signedDepositTx,
      signedSweepTx,
      activityId,
      payerPublicKey,
      lastValidBlockHeight,
    }: {
      signedDepositTx: string;
      signedSweepTx: string;
      activityId: string;
      payerPublicKey: string;
      lastValidBlockHeight?: number;
    } = body;

    // Validation
    if (!signedDepositTx || !signedSweepTx || !activityId || !payerPublicKey) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Parse inputs
    const payerPubKey = new PublicKey(payerPublicKey);

    // Verify session signature proves ownership of payerPublicKey
    const messageBytes = Buffer.from(SESSION_MESSAGE);
    const isValid = nacl.sign.detached.verify(
      messageBytes,
      sessionSigBytes,
      payerPubKey.toBytes()
    );

    if (!isValid) {
      return NextResponse.json(
        { error: "Invalid session signature for payer address" },
        { status: 401 }
      );
    }

    // Get connection
    const rpcUrl = process.env.RPC_URL;
    if (!rpcUrl) {
      return NextResponse.json(
        { error: "RPC_URL not configured" },
        { status: 500 }
      );
    }
    const connection = new Connection(rpcUrl, "confirmed");

    // Execute submit
    const result = await submitFulfill({
      connection,
      signedDepositTx,
      signedSweepTx,
      sessionSignature: sessionSigBytes,
      activityId,
      payerPublicKey: payerPubKey,
      lastValidBlockHeight,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Submit fulfill error:", error);

    if (error.message === "Request not found") {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }

    if (error.message === "Request already fulfilled or cancelled") {
      return NextResponse.json(
        { error: "Request already fulfilled or cancelled" },
        { status: 410 }
      );
    }

    if (error.message === "Transaction expired. Please prepare again.") {
      return NextResponse.json(
        { error: "Transaction expired. Please prepare again." },
        { status: 408 } // Request Timeout
      );
    }

    return NextResponse.json(
      { error: error.message ?? "Failed to submit fulfill" },
      { status: 500 }
    );
  }
}
