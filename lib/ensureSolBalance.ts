import {
  Connection,
  PublicKey,
  Keypair,
  LAMPORTS_PER_SOL,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";

export async function ensureSolBalance({
  connection,
  userPubkey,
  sponsorKeypair,
  minSol = 0.002,
  topUpSol = 0.003,
}: {
  connection: Connection;
  userPubkey: PublicKey;
  sponsorKeypair: Keypair;
  minSol?: number;
  topUpSol?: number;
}) {
  const balance = await connection.getBalance(userPubkey);
  const balanceSol = balance / LAMPORTS_PER_SOL;

  if (balanceSol >= minSol) {
    return { toppedUp: false };
  }

  const lamports = Math.ceil(topUpSol * LAMPORTS_PER_SOL);

  const tx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: sponsorKeypair.publicKey,
      toPubkey: userPubkey,
      lamports,
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
    newBalanceSol: (balance + lamports) / LAMPORTS_PER_SOL,
  };
}
