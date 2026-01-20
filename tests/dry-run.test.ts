import "dotenv/config";
import { Keypair, PublicKey } from "@solana/web3.js";
import bs58 from "bs58";
import { createBurnerWallet } from "../lib/burner-wallet";

const sender = Keypair.fromSecretKey(
  bs58.decode(process.env.TEST_PRIVATE_KEY!)
);
const recipient = sender.publicKey;

const { burnerKeypair, encryptedData } = await createBurnerWallet(
  recipient,
  sender.publicKey
);

console.log("Burner:", burnerKeypair.publicKey.toBase58());
console.log("Encrypted OK:", !!encryptedData);
