import "dotenv/config";
import { Connection, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import bs58 from "bs58";
import { PrivacyCash } from "privacycash";

if (process.env.CONFIRM_MAINNET_TEST !== "true") {
  console.log("Mainnet recovery blocked");
  process.exit(0);
}

const RPC = "https://api.mainnet-beta.solana.com";

// IMPORTANT: withdraw LESS than deposited
const WITHDRAW = Math.floor(0.0007 * LAMPORTS_PER_SOL);

async function main() {
  if (!process.env.TEST_PRIVATE_KEY) {
    throw new Error("TEST_PRIVATE_KEY not set");
  }

  const connection = new Connection(RPC, "confirmed");
  const wallet = Keypair.fromSecretKey(
    bs58.decode(process.env.TEST_PRIVATE_KEY)
  );

  console.log("Recovering to:", wallet.publicKey.toBase58());

  const client = new PrivacyCash({
    RPC_url: RPC,
    owner: wallet.secretKey,
  });

  const balance = await client.getPrivateBalance();
  console.log("Private balance:", balance.lamports);

  if (balance.lamports < WITHDRAW) {
    throw new Error("Not enough private balance to recover");
  }

  const res = await client.withdraw({
    lamports: WITHDRAW,
    recipientAddress: wallet.publicKey.toBase58(),
  });

  console.log("Recovery withdraw tx:", res);
  console.log("Funds recovered successfully");
}

main().catch(console.error);
