import "dotenv/config";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import bs58 from "bs58";
import { PrivacyCash } from "privacycash";
import { TOKEN_MINTS } from "../lib/privacycash/tokens";
import { ensureSolBalance } from "../lib/ensureSolBalance";

if (process.env.CONFIRM_MAINNET_TEST !== "true") {
  console.log("Mainnet test blocked");
  console.log("Set CONFIRM_MAINNET_TEST=true to run.");
  process.exit(0);
}

const USDC_BASE_UNITS = 1.5 * 1_000_000;

const RECIPIENT = new PublicKey("4UygE3w6jjaPfK8yPGrMvtbS2kLdXXVPw7DB7mi5Vxze");

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  if (!process.env.TEST_PRIVATE_KEY) {
    throw new Error("TEST_PRIVATE_KEY not set");
  }

  if (!process.env.HELIUS_RPC) {
    throw new Error("HELIUS_RPC not set");
  }

  if (!process.env.SPONSOR_PRIVATE_KEY) {
    throw new Error("SPONSOR_PRIVATE_KEY not set");
  }

  const sender = Keypair.fromSecretKey(
    bs58.decode(process.env.TEST_PRIVATE_KEY),
  );

  const sponsor = Keypair.fromSecretKey(
    bs58.decode(process.env.SPONSOR_PRIVATE_KEY),
  );

  const connection = new Connection(process.env.HELIUS_RPC, "confirmed");

  console.log("Sender wallet:", sender.publicKey.toBase58());
  console.log("Recipient:", RECIPIENT.toBase58());
  console.log("Sponsor wallet:", sponsor.publicKey.toBase58());

  const client = new PrivacyCash({
    RPC_url: process.env.HELIUS_RPC,
    owner: sender.secretKey,
  });

  // TOP-UP
  const topupRes = await ensureSolBalance({
    connection,
    userPubkey: sender.publicKey,
    sponsorKeypair: sponsor,
    minSol: 0.002,
    topUpSol: 0.003,
  });

  if (topupRes.toppedUp) {
    console.log(
      `Auto top-up done. New SOL balance ≈ ${topupRes.newBalanceSol} SOL`,
    );
  } else {
    console.log("SOL balance sufficient, no top-up needed");
  }

  // DEPOSIT USDC
  console.log("Depositing USDC...");
  const depositRes = await client.depositSPL({
    mintAddress: TOKEN_MINTS.USDC,
    base_units: USDC_BASE_UNITS,
  });
  console.log("Deposit tx:", depositRes.tx);

  console.log("Waiting for indexer (60s)...");
  await sleep(60_000);

  const balance = await client.getPrivateBalanceUSDC();
  console.log("Private USDC balance:", balance);

  if (balance.base_units < USDC_BASE_UNITS) {
    throw new Error("Private USDC balance mismatch");
  }

  // WITHDRAW USDC
  console.log("Withdrawing USDC to recipient...");
  const withdrawRes = await client.withdrawUSDC({
    base_units: USDC_BASE_UNITS,
    recipientAddress: RECIPIENT.toBase58(),
  });

  console.log("Withdraw result:", withdrawRes);
  console.log("MAINNET USDC TEST PASSED");
}

main().catch((err) => {
  console.error("TEST FAILED:", err);
  process.exit(1);
});
