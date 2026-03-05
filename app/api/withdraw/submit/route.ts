import { NextRequest, NextResponse } from "next/server";
import { Connection, VersionedTransaction } from "@solana/web3.js";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      signedTransaction,
      blockhash,
      lastValidBlockHeight,
    }: {
      signedTransaction: string;
      blockhash: string;
      lastValidBlockHeight: number;
    } = body;

    if (!signedTransaction || !blockhash || !lastValidBlockHeight) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const rpcUrl = process.env.RPC_URL;
    if (!rpcUrl) {
      return NextResponse.json(
        { error: "RPC_URL not configured" },
        { status: 500 }
      );
    }

    const connection = new Connection(rpcUrl, "confirmed");

    // Deserialize and send
    const txBytes = Buffer.from(signedTransaction, "base64");
    const tx = VersionedTransaction.deserialize(txBytes);

    const signature = await connection.sendRawTransaction(tx.serialize());
    await connection.confirmTransaction(
      { signature, blockhash, lastValidBlockHeight },
      "confirmed"
    );

    return NextResponse.json({ signature });
  } catch (error: any) {
    console.error("Withdraw submit error:", error);
    return NextResponse.json(
      { error: error.message ?? "Failed to submit withdraw" },
      { status: 500 }
    );
  }
}
