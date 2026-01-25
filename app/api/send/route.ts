import { NextRequest, NextResponse } from "next/server";
import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";

import { directSend } from "@/lib/operations/send";
import { TokenType } from "@/lib/privacycash/tokens";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      senderPrivateKey,
      receiverAddress,
      amount,
      token,
      message,
    }: {
      senderPrivateKey: string;
      receiverAddress: string;
      amount: number;
      token: TokenType;
      message?: string;
    } = body;

    // Validation
    if (!senderPrivateKey || !receiverAddress || !amount || !token) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    if (amount <= 0) {
      return NextResponse.json(
        { error: "Amount must be greater than zero" },
        { status: 400 }
      );
    }

    // Keypair
    const senderKeypair = Keypair.fromSecretKey(bs58.decode(senderPrivateKey));

    // Execute direct send
    const result = await directSend({
      senderKeypair,
      receiverAddress,
      amount,
      token,
      message,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Direct send error:", error);

    return NextResponse.json(
      { error: error.message ?? "Failed to send" },
      { status: 500 }
    );
  }
}
