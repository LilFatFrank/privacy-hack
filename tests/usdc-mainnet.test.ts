import "dotenv/config";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import bs58 from "bs58";
import { PrivacyCash } from "privacycash";

import { TOKEN_MINTS } from "../lib/privacycash/tokens";
import { ensureGasForDeposit } from "../lib/flows/ensureGasForDeposit";
import { ensureGasForWithdraw } from "../lib/flows/ensureGasForWithdraw";
import { loadSponsorWallet } from "../lib/sponsor/sponsorWallet";

if (process.env.CONFIRM_MAINNET_TEST !== "true") {
  console.log("Mainnet test blocked");
  process.exit(0);
}

const USDC_BASE_UNITS = 1.5 * 1_000_000;
const RECIPIENT = new PublicKey("5UCaKTTMTPaYgmPL45cU1ay5GAjHjqvXXq7VpNPu84rf");

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  if (!process.env.TEST_PRIVATE_KEY)
    throw new Error("TEST_PRIVATE_KEY not set");

  if (!process.env.HELIUS_RPC) throw new Error("HELIUS_RPC not set");

  if (!process.env.SPONSOR_PRIVATE_KEY)
    throw new Error("SPONSOR_PRIVATE_KEY not set");

  const sender = Keypair.fromSecretKey(
    bs58.decode(process.env.TEST_PRIVATE_KEY),
  );

  const sponsor = loadSponsorWallet();

  const connection = new Connection(process.env.HELIUS_RPC, "confirmed");

  console.log("Sender:", sender.publicKey.toBase58());
  console.log("Recipient:", RECIPIENT.toBase58());
  console.log("Sponsor:", sponsor.publicKey.toBase58());

  const client = new PrivacyCash({
    RPC_url: process.env.HELIUS_RPC,
    owner: sender.secretKey,
  });

  await ensureGasForDeposit(connection, sender.publicKey);

  console.log("Depositing USDC...");
  const depositRes = await client.depositSPL({
    mintAddress: TOKEN_MINTS.USDC,
    base_units: USDC_BASE_UNITS,
  });

  console.log("Deposit tx:", depositRes.tx);

  console.log("Waiting for indexer (60s)...");
  await sleep(10_000);

  const balance = await client.getPrivateBalanceUSDC();
  console.log("Private USDC balance:", balance);

  if (balance.base_units < USDC_BASE_UNITS) {
    throw new Error("Private USDC balance mismatch");
  }

  await ensureGasForWithdraw(connection, sender.publicKey);

  console.log("Withdrawing USDC...");
  const withdrawRes = await client.withdrawUSDC({
    base_units: USDC_BASE_UNITS,
    recipientAddress: RECIPIENT.toBase58(),
  });

  console.log("Withdraw submitted:", withdrawRes);
  console.log("MAINNET USDC TEST PASSED");
}

main().catch((err) => {
  console.error("TEST FAILED:", err);
  process.exit(1);
});
