import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";

export function loadSponsorWallet(): Keypair {
  if (!process.env.SPONSOR_PRIVATE_KEY) {
    throw new Error("SPONSOR_PRIVATE_KEY not set");
  }

  return Keypair.fromSecretKey(bs58.decode(process.env.SPONSOR_PRIVATE_KEY));
}
