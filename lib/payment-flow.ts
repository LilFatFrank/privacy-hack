import { Keypair, PublicKey, Connection } from "@solana/web3.js";
import { v4 as uuidv4 } from "uuid";

import { createBurnerWallet, fundBurnerWallet } from "./burner-wallet";

import {
  createPrivacyCashClient,
  depositToPrivacyCash,
  withdrawFromPrivacyCash,
} from "./privacycash";

import {
  storePayment,
  getPayment,
  updatePaymentStatus,
  Payment,
} from "./database";

import { decryptWithPrivateKey, EncryptedPayload } from "./crypto";
import { TokenType } from "./privacycash/tokens";

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
  await fundBurnerWallet(
    connection,
    senderKeypair,
    burnerKeypair.publicKey,
    0.01
  );

  const client = createPrivacyCashClient(
    process.env.RPC_URL!,
    burnerKeypair.secretKey
  );

  const depositRes = await depositToPrivacyCash(client, amount, token);

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
