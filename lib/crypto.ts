import nacl from "tweetnacl";
import { PublicKey } from "@solana/web3.js";
import bs58 from "bs58";

export interface EncryptedPayload {
  ciphertext: string;
  nonce: string;
  ephemeralPublicKey: string;
}

export function encryptForRecipient(
  data: Uint8Array,
  recipientPublicKey: PublicKey
): {
  ciphertext: string;
  nonce: string;
  ephemeralPublicKey: string;
} {
  const ephemeralKeypair = nacl.box.keyPair();
  const nonce = nacl.randomBytes(nacl.box.nonceLength);

  // Encrypt the data
  const encrypted = nacl.box(
    data,
    nonce,
    recipientPublicKey.toBytes(),
    ephemeralKeypair.secretKey
  );

  return {
    ciphertext: bs58.encode(encrypted),
    nonce: bs58.encode(nonce),
    ephemeralPublicKey: bs58.encode(ephemeralKeypair.publicKey),
  };
}

export function decryptWithPrivateKey(
  ciphertext: string,
  nonce: string,
  ephemeralPublicKey: string,
  privateKey: Uint8Array
): Uint8Array {
  const decrypted = nacl.box.open(
    bs58.decode(ciphertext),
    bs58.decode(nonce),
    bs58.decode(ephemeralPublicKey),
    privateKey
  );

  if (!decrypted) {
    throw new Error("Decryption failed - invalid keys or corrupted data");
  }

  return decrypted;
}

export function serializeKeypair(secretKey: Uint8Array): string {
  return bs58.encode(secretKey);
}

export function deserializeKeypair(encoded: string): Uint8Array {
  return bs58.decode(encoded);
}
