import { NextRequest, NextResponse } from "next/server";
import {
  Connection,
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  createTransferInstruction,
  createAssociatedTokenAccountInstruction,
  getAccount,
  TokenAccountNotFoundError,
} from "@solana/spl-token";
import nacl from "tweetnacl";

import { TOKEN_MINTS } from "@/lib/privacycash/tokens";
import { loadSponsorWallet } from "@/lib/sponsor/sponsorWallet";

const SESSION_MESSAGE = "Privacy Money account sign in";
const USDC_DECIMALS = 6;

export async function POST(request: NextRequest) {
  try {
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
    }: {
      senderPublicKey: string;
      receiverAddress: string;
      amount: number;
    } = body;

    if (!senderPublicKey || !receiverAddress || !amount) {
      return NextResponse.json(
        { error: "Missing required fields: senderPublicKey, receiverAddress, amount" },
        { status: 400 }
      );
    }

    if (amount <= 0) {
      return NextResponse.json(
        { error: "Amount must be greater than zero" },
        { status: 400 }
      );
    }

    const senderPubKey = new PublicKey(senderPublicKey);
    const receiverPubKey = new PublicKey(receiverAddress);

    // Verify session signature
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

    const rpcUrl = process.env.RPC_URL;
    if (!rpcUrl) {
      return NextResponse.json(
        { error: "RPC_URL not configured" },
        { status: 500 }
      );
    }

    const connection = new Connection(rpcUrl, "confirmed");
    const sponsorKeypair = loadSponsorWallet();
    const mintAddress = TOKEN_MINTS.USDC;
    const baseUnits = BigInt(Math.floor(amount * 10 ** USDC_DECIMALS));

    // Get token accounts
    const senderTokenAccount = await getAssociatedTokenAddress(mintAddress, senderPubKey);
    const receiverTokenAccount = await getAssociatedTokenAddress(mintAddress, receiverPubKey);

    // Verify sender has enough USDC
    let senderBalance: bigint;
    try {
      const account = await getAccount(connection, senderTokenAccount);
      senderBalance = account.amount;
    } catch (error) {
      if (error instanceof TokenAccountNotFoundError) {
        return NextResponse.json(
          { error: "No USDC token account found" },
          { status: 400 }
        );
      }
      throw error;
    }

    if (senderBalance < baseUnits) {
      return NextResponse.json(
        { error: `Insufficient USDC balance. Have ${Number(senderBalance) / 10 ** USDC_DECIMALS}, need ${amount}` },
        { status: 400 }
      );
    }

    // Build instructions
    const instructions = [];

    // Create receiver ATA if needed
    try {
      await getAccount(connection, receiverTokenAccount);
    } catch (error) {
      if (error instanceof TokenAccountNotFoundError) {
        instructions.push(
          createAssociatedTokenAccountInstruction(
            sponsorKeypair.publicKey,
            receiverTokenAccount,
            receiverPubKey,
            mintAddress
          )
        );
      } else {
        throw error;
      }
    }

    // Transfer USDC
    instructions.push(
      createTransferInstruction(
        senderTokenAccount,
        receiverTokenAccount,
        senderPubKey,
        baseUnits
      )
    );

    // Build transaction with sponsor as fee payer
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");

    const message = new TransactionMessage({
      payerKey: sponsorKeypair.publicKey,
      recentBlockhash: blockhash,
      instructions,
    }).compileToV0Message();

    const tx = new VersionedTransaction(message);

    // Sponsor partial-signs (pays gas)
    tx.sign([sponsorKeypair]);

    // Return partially signed tx for client to co-sign
    const serializedTx = Buffer.from(tx.serialize()).toString("base64");

    return NextResponse.json({
      transaction: serializedTx,
      blockhash,
      lastValidBlockHeight,
    });
  } catch (error: any) {
    console.error("Withdraw prepare error:", error);
    return NextResponse.json(
      { error: error.message ?? "Failed to prepare withdraw" },
      { status: 500 }
    );
  }
}
