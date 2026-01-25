import "dotenv/config";
import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import bs58 from "bs58";
import { PrivacyCash } from "privacycash";

import { TOKEN_MINTS } from "../lib/privacycash/tokens";
import {
  createActivity,
  updateActivityStatus,
  hashAddress,
} from "../lib/database";

const RECEIVER = "3ePJcbZTNca4utt78bXXqvAZQtboU7VumKdD7jWXwy9g";
const USDC_AMOUNT = 1.5; // $1.50 USDC for testing (min ~$1 for withdrawal fee)
const USDC_BASE_UNITS = USDC_AMOUNT * 1_000_000;
const GAS_AMOUNT = 0.005 * LAMPORTS_PER_SOL; // 0.005 SOL for gas

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  // Load wallets
  if (!process.env.TEST_PRIVATE_KEY) {
    throw new Error("TEST_PRIVATE_KEY not set");
  }
  if (!process.env.SPONSOR_PRIVATE_KEY) {
    throw new Error("SPONSOR_PRIVATE_KEY not set");
  }
  if (!process.env.RPC_URL) {
    throw new Error("RPC_URL not set");
  }

  const sender = Keypair.fromSecretKey(
    bs58.decode(process.env.TEST_PRIVATE_KEY)
  );
  const sponsor = Keypair.fromSecretKey(
    bs58.decode(process.env.SPONSOR_PRIVATE_KEY)
  );

  const connection = new Connection(process.env.RPC_URL, "confirmed");

  console.log("=== Direct Send Test ===");
  console.log("Sender:", sender.publicKey.toBase58());
  console.log("Sponsor:", sponsor.publicKey.toBase58());
  console.log("Receiver:", RECEIVER);
  console.log("Amount:", USDC_AMOUNT, "USDC");

  // Check balances
  let senderSolBalance = await connection.getBalance(sender.publicKey);
  console.log("\nSender SOL balance:", senderSolBalance / 1e9, "SOL");

  const sponsorSolBalance = await connection.getBalance(sponsor.publicKey);
  console.log("Sponsor SOL balance:", sponsorSolBalance / 1e9, "SOL");

  // Step 1: Sponsor funds sender with gas
  console.log("\n--- Step 1: Fund Sender with Gas ---");
  if (senderSolBalance < GAS_AMOUNT) {
    console.log("Transferring", GAS_AMOUNT / LAMPORTS_PER_SOL, "SOL to sender for gas...");
    const fundTx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: sponsor.publicKey,
        toPubkey: sender.publicKey,
        lamports: GAS_AMOUNT,
      })
    );
    const fundSig = await connection.sendTransaction(fundTx, [sponsor]);
    await connection.confirmTransaction(fundSig, "confirmed");
    console.log("Fund tx:", fundSig);

    senderSolBalance = await connection.getBalance(sender.publicKey);
    console.log("Sender SOL balance now:", senderSolBalance / 1e9, "SOL");
  } else {
    console.log("Sender already has enough SOL for gas");
  }

  // Step 2: Deposit to PrivacyCash (sender pays gas from funded amount)
  console.log("\n--- Step 2: Deposit to PrivacyCash ---");
  console.log("Depositing", USDC_AMOUNT, "USDC...");

  const client = new PrivacyCash({
    RPC_url: process.env.RPC_URL,
    owner: sender.secretKey,
  });

  const depositResult = await client.depositSPL({
    mintAddress: TOKEN_MINTS.USDC,
    base_units: USDC_BASE_UNITS,
  });

  console.log("Deposit tx:", depositResult.tx);

  // Record activity in DB
  console.log("\nRecording activity in DB...");
  const activity = await createActivity({
    type: "send",
    sender_hash: hashAddress(sender.publicKey.toBase58()),
    receiver_hash: hashAddress(RECEIVER),
    amount: USDC_AMOUNT,
    token_address: TOKEN_MINTS.USDC.toBase58(),
    status: "open",
    message: null,
    tx_hash: null,
    burner_address: null,
    encrypted_for_receiver: null,
    encrypted_for_sender: null,
    deposit_tx_hash: null,
    claim_tx_hash: null,
    receiver_address: null,
  });
  console.log("Activity created:", activity.id);

  // Step 3: Wait for indexer
  console.log("\n--- Step 3: Waiting for Indexer ---");
  console.log("Waiting 15s for indexer to process deposit...");
  await sleep(15_000);

  // Step 4: Check private balance
  console.log("\n--- Step 4: Check Private Balance ---");
  const privateBalance = await client.getPrivateBalanceUSDC();
  console.log("Private USDC balance:", privateBalance.base_units / 1e6, "USDC");

  if (privateBalance.base_units < USDC_BASE_UNITS) {
    console.log("Waiting another 15s...");
    await sleep(15_000);
    const retryBalance = await client.getPrivateBalanceUSDC();
    console.log("Retry balance:", retryBalance.base_units / 1e6, "USDC");
  }

  // Step 5: Withdraw to receiver (relayer pays gas)
  console.log("\n--- Step 5: Withdraw to Receiver ---");
  console.log("Withdrawing to:", RECEIVER);
  console.log("Relayer will pay gas and take fee from amount");

  const withdrawResult = await client.withdrawUSDC({
    base_units: USDC_BASE_UNITS,
    recipientAddress: RECEIVER,
  });

  console.log("Withdraw submitted:", withdrawResult);

  // Update activity status
  await updateActivityStatus(activity.id, "settled", {
    tx_hash: withdrawResult.tx || String(withdrawResult),
  });
  console.log("Activity updated to settled");

  console.log("\n=== Direct Send Complete ===");
  console.log("Activity ID:", activity.id);
  console.log("Deposit tx:", depositResult.tx);
  console.log("Receiver:", RECEIVER);
}

main().catch((err) => {
  console.error("TEST FAILED:", err);
  process.exit(1);
});
