import { NextRequest, NextResponse } from "next/server";
import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";

import { createClaimLink } from "@/lib/operations/claim";
import { TokenType } from "@/lib/privacycash/tokens";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      senderPrivateKey,
      amount,
      token,
      message,
    }: {
      senderPrivateKey: string;
      amount: number;
      token: TokenType;
      message?: string;
    } = body;

    // Validation
    if (!senderPrivateKey || !amount || !token) {
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

    // Create claim link
    const result = await createClaimLink({
      senderKeypair,
      amount,
      token,
      message,
    });

    return NextResponse.json({
      activityId: result.activityId,
      claimLink: result.claimLink,
      passphrase: result.passphrase, // IMPORTANT: Send this via separate channel!
      depositTx: result.depositTx,
    });
  } catch (error: any) {
    console.error("Create claim link error:", error);

    return NextResponse.json(
      { error: error.message ?? "Failed to create claim link" },
      { status: 500 }
    );
  }
}
