import { NextRequest, NextResponse } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";

import { submitFulfill } from "@/lib/sponsor/prepareAndSubmitFulfill";

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
    }: {
      signedDepositTx: string;
      signedSweepTx: string;
      activityId: string;
      payerPublicKey: string;
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

    return NextResponse.json(
      { error: error.message ?? "Failed to submit fulfill" },
      { status: 500 }
    );
  }
}
