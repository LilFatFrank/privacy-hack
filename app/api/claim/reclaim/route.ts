import { NextRequest, NextResponse } from "next/server";
import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";

import { reclaimPayment } from "@/lib/operations/claim";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      activityId,
      senderPrivateKey,
    }: {
      activityId: string;
      senderPrivateKey: string;
    } = body;

    // Validation
    if (!activityId || !senderPrivateKey) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Keypair
    const senderKeypair = Keypair.fromSecretKey(bs58.decode(senderPrivateKey));

    // Reclaim payment
    const result = await reclaimPayment({
      activityId,
      senderKeypair,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Reclaim payment error:", error);

    if (error.message === "Claim link not found") {
      return NextResponse.json({ error: "Claim link not found" }, { status: 404 });
    }

    if (error.message === "Not the sender of this claim link") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    if (error.message === "Claim link already used or cancelled") {
      return NextResponse.json(
        { error: "Claim link already used or cancelled" },
        { status: 410 }
      );
    }

    return NextResponse.json(
      { error: error.message ?? "Failed to reclaim" },
      { status: 500 }
    );
  }
}
