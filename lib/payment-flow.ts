import { Keypair, PublicKey, Connection } from "@solana/web3.js";
import { v4 as uuidv4 } from "uuid";

import { createBurnerWallet } from "./burner-wallet";

import {
  createPrivacyCashClient,
  withdrawFromPrivacyCash,
} from "./privacycash";

import {
  storePayment,
  getPayment,
  updatePaymentStatus,
  Payment,
} from "./database";

import { decryptWithPrivateKey, EncryptedPayload } from "./crypto";
import { TokenType, TOKEN_MINTS } from "./privacycash/tokens";
import {
  atomicSponsoredDeposit,
  atomicSponsoredSolDeposit,
} from "./sponsor/atomicSponsor";

// Internal helper
async function withdrawUsingEncryptedBurner(
  encryptedKey: EncryptedPayload,
  decryptingKeypair: Keypair,
  recipientAddress: string,
  amount: number,
  token: TokenType
): Promise<string> {
  const burnerSecret = decryptWithPrivateKey(
    encryptedKey.ciphertext,
    encryptedKey.nonce,
    encryptedKey.ephemeralPublicKey,
    decryptingKeypair.secretKey
  );

  const client = createPrivacyCashClient(process.env.RPC_URL!, burnerSecret);

  const result = await withdrawFromPrivacyCash(
    client,
    amount,
    recipientAddress,
    token
  );
  return result.tx;
}

// Create Payment
// Uses atomic sponsorship - the sender sponsors the burner's transaction fee
// This ensures the deposit cannot fail after gas has been funded
export async function createPayment(
  senderKeypair: Keypair,
  recipientPublicKey: string,
  amount: number,
  token: TokenType
) {
  const { burnerKeypair, encryptedData } = await createBurnerWallet(
    new PublicKey(recipientPublicKey),
    senderKeypair.publicKey
  );

  const connection = new Connection(process.env.RPC_URL!);

  let depositRes: { tx: string };

  if (token === "SOL") {
    // For SOL: sender sponsors the deposit, burner deposits SOL from sender's funding
    // First, fund the burner with SOL to deposit (this is the deposit amount, not gas)
    const lamports = amount * 1_000_000_000;

    // Transfer SOL to burner for the actual deposit
    const { Transaction, SystemProgram } = await import("@solana/web3.js");
    const fundTx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: senderKeypair.publicKey,
        toPubkey: burnerKeypair.publicKey,
        lamports: lamports,
      })
    );
    const fundSig = await connection.sendTransaction(fundTx, [senderKeypair]);
    await connection.confirmTransaction(fundSig, "confirmed");

    // Now do atomic sponsored deposit (sender pays tx fee, burner deposits)
    depositRes = await atomicSponsoredSolDeposit({
      connection,
      userKeypair: burnerKeypair,
      sponsorKeypair: senderKeypair,
      lamports,
    });
  } else {
    // For SPL tokens: sender needs to transfer tokens to burner first
    // Then sponsor the deposit transaction fee
    const { getAssociatedTokenAddress, createTransferInstruction } =
      await import("@solana/spl-token");
    const { Transaction } = await import("@solana/web3.js");

    const mintAddress = TOKEN_MINTS[token];

    // Get sender's and burner's token accounts
    const senderAta = await getAssociatedTokenAddress(
      mintAddress,
      senderKeypair.publicKey
    );
    const burnerAta = await getAssociatedTokenAddress(
      mintAddress,
      burnerKeypair.publicKey
    );

    // Create burner's ATA if needed, then transfer tokens
    const { createAssociatedTokenAccountInstruction, getAccount } =
      await import("@solana/spl-token");

    const transferTx = new Transaction();

    // Check if burner ATA exists
    try {
      await getAccount(connection, burnerAta);
    } catch {
      // Create ATA for burner
      transferTx.add(
        createAssociatedTokenAccountInstruction(
          senderKeypair.publicKey, // payer
          burnerAta, // ata
          burnerKeypair.publicKey, // owner
          mintAddress // mint
        )
      );
    }

    // Get token decimals (USDC = 6)
    const baseUnits = Math.floor(amount * 1_000_000);

    // Add token transfer
    transferTx.add(
      createTransferInstruction(
        senderAta, // from
        burnerAta, // to
        senderKeypair.publicKey, // owner
        baseUnits // amount
      )
    );

    // Send token transfer
    const transferSig = await connection.sendTransaction(transferTx, [
      senderKeypair,
    ]);
    await connection.confirmTransaction(transferSig, "confirmed");

    // Now do atomic sponsored deposit
    depositRes = await atomicSponsoredDeposit({
      connection,
      userKeypair: burnerKeypair,
      sponsorKeypair: senderKeypair,
      mintAddress,
      baseUnits,
    });
  }

  const paymentId = uuidv4();

  const payment: Payment = {
    id: paymentId,
    burnerPublicKey: encryptedData.publicKey,

    encryptedKeyForRecipient: encryptedData.encryptedForRecipient,
    encryptedKeyForSender: encryptedData.encryptedForSender,

    sender: senderKeypair.publicKey.toString(),
    recipient: recipientPublicKey,

    amount,
    token,

    status: "pending",
    createdAt: Date.now(),

    depositTxSignature: depositRes?.tx ?? "",
  };

  await storePayment(payment);

  return {
    paymentId,
    paymentLink: `${process.env.NEXT_PUBLIC_APP_URL}/claim/${paymentId}`,
  };
}

// Claim Payment
export async function claimPayment(
  recipientKeypair: Keypair,
  paymentId: string
) {
  const payment = await getPayment(paymentId);
  if (!payment) throw new Error("Payment not found");

  if (payment.status !== "pending") {
    throw new Error("Payment already processed");
  }

  if (payment.recipient !== recipientKeypair.publicKey.toString()) {
    throw new Error("Not payment recipient");
  }

  const signature = await withdrawUsingEncryptedBurner(
    payment.encryptedKeyForRecipient,
    recipientKeypair,
    recipientKeypair.publicKey.toString(),
    payment.amount,
    payment.token
  );

  await updatePaymentStatus(paymentId, "claimed", Date.now());

  return { success: true, signature };
}

// Reclaim Payment
export async function reclaimPayment(
  senderKeypair: Keypair,
  paymentId: string
) {
  const payment = await getPayment(paymentId);
  if (!payment) throw new Error("Payment not found");

  if (payment.status !== "pending") {
    throw new Error("Payment already processed");
  }

  if (payment.sender !== senderKeypair.publicKey.toString()) {
    throw new Error("Not payment sender");
  }

  const signature = await withdrawUsingEncryptedBurner(
    payment.encryptedKeyForSender,
    senderKeypair,
    senderKeypair.publicKey.toString(),
    payment.amount,
    payment.token
  );

  await updatePaymentStatus(paymentId, "reclaimed", Date.now());

  return { success: true, signature };
}
