import { NextRequest, NextResponse } from "next/server";
import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";

import { fulfillRequest } from "@/lib/operations/request";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      activityId,
      payerPrivateKey,
    }: {
      activityId: string;
      payerPrivateKey: string;
    } = body;

    // Validation
    if (!activityId || !payerPrivateKey) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Keypair
    const payerKeypair = Keypair.fromSecretKey(bs58.decode(payerPrivateKey));

    // Fulfill request
    const result = await fulfillRequest({
      activityId,
      payerKeypair,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Fulfill request error:", error);

    if (error.message === "Request not found") {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }

    if (error.message === "Not authorized to fulfill this request") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    if (error.message === "Request already fulfilled or cancelled") {
      return NextResponse.json(
        { error: "Request already fulfilled or cancelled" },
        { status: 410 }
      );
    }

    return NextResponse.json(
      { error: error.message ?? "Failed to fulfill request" },
      { status: 500 }
    );
  }
}
