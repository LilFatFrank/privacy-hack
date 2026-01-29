import { NextRequest, NextResponse } from "next/server";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import bs58 from "bs58";

import { prepareSend, SESSION_MESSAGE } from "@/lib/sponsor/prepareAndSubmitSend";
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
      senderPublicKey,
      receiverAddress,
      amount,
      token,
      message,
    }: {
      senderPublicKey: string;
      receiverAddress: string;
      amount: number;
      token: TokenType;
      message?: string;
    } = body;

    // Validation
    if (!senderPublicKey || !receiverAddress || !amount || !token) {
      return NextResponse.json(
        { error: "Missing required fields: senderPublicKey, receiverAddress, amount, token" },
        { status: 400 }
      );
    }

    if (amount <= 0) {
      return NextResponse.json(
        { error: "Amount must be greater than zero" },
        { status: 400 }
      );
    }

    // Parse inputs
    const senderPubKey = new PublicKey(senderPublicKey);

    // Get sponsor keypair
    const sponsorKey = process.env.SPONSOR_PRIVATE_KEY;
    if (!sponsorKey) {
      return NextResponse.json(
        { error: "SPONSOR_PRIVATE_KEY not configured" },
        { status: 500 }
      );
    }
    const sponsorKeypair = Keypair.fromSecretKey(bs58.decode(sponsorKey));

    // Get connection
    const rpcUrl = process.env.RPC_URL;
    if (!rpcUrl) {
      return NextResponse.json(
        { error: "RPC_URL not configured" },
        { status: 500 }
      );
    }
    const connection = new Connection(rpcUrl, "confirmed");

    // Execute prepare
    const result = await prepareSend({
      connection,
      senderPublicKey: senderPubKey,
      sponsorKeypair,
      sessionSignature: sessionSigBytes,
      receiverAddress,
      amount,
      token,
      message,
    });

    return NextResponse.json({
      ...result,
      sessionMessage: SESSION_MESSAGE,
    });
  } catch (error: any) {
    console.error("Prepare send error:", error);

    return NextResponse.json(
      { error: error.message ?? "Failed to prepare send" },
      { status: 500 }
    );
  }
}
