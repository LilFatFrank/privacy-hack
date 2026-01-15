import {
  Keypair,
  Connection,
  PublicKey,
  LAMPORTS_PER_SOL,
  Transaction,
  SystemProgram,
} from "@solana/web3.js";
import { encryptForRecipient, serializeKeypair } from "./crypto";

export interface BurnerWalletData {
  publicKey: string;
  encryptedForRecipient: {
    ciphertext: string;
    nonce: string;
    ephemeralPublicKey: string;
  };
  encryptedForSender: {
    ciphertext: string;
    nonce: string;
    ephemeralPublicKey: string;
  };
}

export async function createBurnerWallet(
  recipientPublicKey: PublicKey,
  senderPublicKey: PublicKey
): Promise<{ burnerKeypair: Keypair; encryptedData: BurnerWalletData }> {
  const burnerKeypair = Keypair.generate();
  const privateKeyBytes = burnerKeypair.secretKey;

  // Encrypt for recipient
  const encryptedForRecipient = encryptForRecipient(
    privateKeyBytes,
    recipientPublicKey
  );

  // Encrypt for sender
  const encryptedForSender = encryptForRecipient(
    privateKeyBytes,
    senderPublicKey
  );

  return {
    burnerKeypair,
    encryptedData: {
      publicKey: burnerKeypair.publicKey.toString(),
      encryptedForRecipient,
      encryptedForSender,
    },
  };
}

export async function fundBurnerWallet(
  connection: Connection,
  fromKeypair: Keypair,
  burnerPublicKey: PublicKey,
  amountSOL: number = 0.01 //funding for gas fees
): Promise<string> {
  const transaction = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: fromKeypair.publicKey,
      toPubkey: burnerPublicKey,
      lamports: amountSOL * LAMPORTS_PER_SOL,
    })
  );

  const signature = await connection.sendTransaction(transaction, [
    fromKeypair,
  ]);
  await connection.confirmTransaction(signature);

  return signature;
}
