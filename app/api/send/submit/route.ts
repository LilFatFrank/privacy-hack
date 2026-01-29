import { NextRequest, NextResponse } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";
import nacl from "tweetnacl";

import { submitSend, SESSION_MESSAGE } from "@/lib/sponsor/prepareAndSubmitSend";
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
      lastValidBlockHeight,
    }: {
      signedDepositTx: string;
      signedSweepTx: string;
      activityId: string;
      senderPublicKey: string;
      receiverAddress: string;
      amount: number;
      token: TokenType;
      lastValidBlockHeight?: number;
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

    // Verify session signature proves ownership of senderPublicKey
    const messageBytes = Buffer.from(SESSION_MESSAGE);
    const isValid = nacl.sign.detached.verify(
      messageBytes,
      sessionSigBytes,
      senderPubKey.toBytes()
    );

    if (!isValid) {
      return NextResponse.json(
        { error: "Invalid session signature for sender address" },
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
      lastValidBlockHeight,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Submit send error:", error);

    if (error.message === "Transaction expired. Please prepare again.") {
      return NextResponse.json(
        { error: "Transaction expired. Please prepare again." },
        { status: 408 } // Request Timeout
      );
    }

    return NextResponse.json(
      { error: error.message ?? "Failed to submit send" },
      { status: 500 }
    );
  }
}
