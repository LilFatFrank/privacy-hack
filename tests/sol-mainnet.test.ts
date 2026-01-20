import "dotenv/config";
import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";
import { PrivacyCash } from "privacycash";

if (process.env.CONFIRM_MAINNET_TEST !== "true") {
  console.log("Mainnet test blocked");
  console.log("Set CONFIRM_MAINNET_TEST=true to run.");
  process.exit(0);
}

const RPC = "https://api.mainnet-beta.solana.com";

// Match PrivacyCash example economics
const DEPOSIT_LAMPORTS = 10_000_000; // 0.01 SOL
const WITHDRAW_LAMPORTS = 9_000_000; // leave relayer + proof buffer

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  if (!process.env.TEST_PRIVATE_KEY) {
    throw new Error("TEST_PRIVATE_KEY not set");
  }

  const sender = Keypair.fromSecretKey(
    bs58.decode(process.env.TEST_PRIVATE_KEY)
  );

  console.log("Wallet:", sender.publicKey.toBase58());

  const client = new PrivacyCash({
    RPC_url: RPC,
    owner: sender.secretKey,
  });

  // ---- DEPOSIT ----
  console.log("Depositing 0.01 SOL...");
  const depositRes = await client.deposit({
    lamports: DEPOSIT_LAMPORTS,
  });

  console.log("Deposit tx:", depositRes);

  // Indexer needs time on first run
  console.log("Waiting for indexer (60s)...");
  await sleep(60_000);

  const balanceAfterDeposit = await client.getPrivateBalance();
  console.log("Private balance after deposit:", balanceAfterDeposit.lamports);

  if (balanceAfterDeposit.lamports < DEPOSIT_LAMPORTS) {
    throw new Error("Deposit not indexed correctly");
  }

  // ---- WITHDRAW ----
  console.log("Withdrawing 0.009 SOL...");
  const withdrawRes = await client.withdraw({
    lamports: WITHDRAW_LAMPORTS,
    recipientAddress: sender.publicKey.toBase58(),
  });

  console.log("Withdraw tx:", withdrawRes);

  console.log("MAINNET SOL TEST PASSED");
}

main().catch((err) => {
  console.error("❌ TEST FAILED:", err);
  process.exit(1);
});
