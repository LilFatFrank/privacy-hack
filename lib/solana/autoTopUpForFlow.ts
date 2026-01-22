import {
  Connection,
  PublicKey,
  Keypair,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import { estimateTxCostLamports, FlowType } from "./estimateTxCost";

export async function autoTopUpForFlow({
  connection,
  flow,
  userPubkey,
  sponsorKeypair,
  bufferMultiplier = 1.2,
}: {
  connection: Connection;
  flow: FlowType;
  userPubkey: PublicKey;
  sponsorKeypair: Keypair;
  bufferMultiplier?: number;
}) {
  const requiredLamports = Math.ceil(
    estimateTxCostLamports(flow) * bufferMultiplier,
  );

  const currentBalance = await connection.getBalance(userPubkey);

  if (currentBalance >= requiredLamports) {
    return {
      toppedUp: false,
      requiredLamports,
      currentLamports: currentBalance,
    };
  }

  const topUpAmount = requiredLamports - currentBalance;

  const tx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: sponsorKeypair.publicKey,
      toPubkey: userPubkey,
      lamports: topUpAmount,
    }),
  );

  const sig = await sendAndConfirmTransaction(
    connection,
    tx,
    [sponsorKeypair],
    { commitment: "confirmed" },
  );

  return {
    toppedUp: true,
    signature: sig,
    fundedLamports: topUpAmount,
    requiredLamports,
  };
}
