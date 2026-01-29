import { NextRequest, NextResponse } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";

import { submitSend } from "@/lib/sponsor/prepareAndSubmitSend";
import { TokenType } from "@/lib/privacycash/tokens";

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
      senderPublicKey,
      receiverAddress,
      amount,
      token,
    }: {
      signedDepositTx: string;
      signedSweepTx: string;
      activityId: string;
      senderPublicKey: string;
      receiverAddress: string;
      amount: number;
      token: TokenType;
    } = body;

    // Validation
    if (!signedDepositTx || !signedSweepTx || !activityId || !senderPublicKey || !receiverAddress || !amount || !token) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Parse inputs
    const senderPubKey = new PublicKey(senderPublicKey);

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
    const result = await submitSend({
      connection,
      signedDepositTx,
      signedSweepTx,
      sessionSignature: sessionSigBytes,
      activityId,
      senderPublicKey: senderPubKey,
      receiverAddress,
      amount,
      token,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Submit send error:", error);

    return NextResponse.json(
      { error: error.message ?? "Failed to submit send" },
      { status: 500 }
    );
  }
}
