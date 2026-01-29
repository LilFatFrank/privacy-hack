import { NextRequest, NextResponse } from "next/server";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import bs58 from "bs58";
import nacl from "tweetnacl";

import { prepareFulfill } from "@/lib/sponsor/prepareAndSubmitFulfill";
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
      activityId,
      payerPublicKey,
    }: {
      activityId: string;
      payerPublicKey: string;
    } = body;

    // Validation
    if (!activityId || !payerPublicKey) {
      return NextResponse.json(
        { error: "Missing required fields: activityId, payerPublicKey" },
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
    const result = await prepareFulfill({
      connection,
      activityId,
      payerPublicKey: payerPubKey,
      sponsorKeypair,
      sessionSignature: sessionSigBytes,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Prepare fulfill error:", error);

    if (error.message === "Request not found") {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }

    if (error.message === "Not a payment request") {
      return NextResponse.json({ error: "Not a payment request" }, { status: 400 });
    }

    if (error.message === "Request already fulfilled or cancelled") {
      return NextResponse.json(
        { error: "Request already fulfilled or cancelled" },
        { status: 410 }
      );
    }

    if (error.message === "Not authorized to fulfill this request") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    return NextResponse.json(
      { error: error.message ?? "Failed to prepare fulfill" },
      { status: 500 }
    );
  }
}
