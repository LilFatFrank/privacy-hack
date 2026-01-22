import { NextRequest, NextResponse } from "next/server";
import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";

import { createPayment } from "@/lib/payment-flow";
import { TokenType } from "@/lib/privacycash/tokens";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      senderPrivateKey,
      recipientAddress,
      amount,
      token,
    }: {
      senderPrivateKey: string;
      recipientAddress: string;
      amount: number;
      token: TokenType;
    } = body;

    // Validation
    if (!senderPrivateKey || !recipientAddress || !amount || !token) {
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

    // Create Payment
    const result = await createPayment(
      senderKeypair,
      recipientAddress,
      amount,
      token
    );

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Create payment error:", error);

    return NextResponse.json(
      { error: error.message ?? "Failed to create payment" },
      { status: 500 }
    );
  }
}
