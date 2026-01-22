import { Connection, PublicKey } from "@solana/web3.js";
import { estimateGasLamports } from "../gas/gasEstimator";
import { sponsorSol } from "../sponsor/sponsorSol";

export async function ensureGasForWithdraw(
  connection: Connection,
  user: PublicKey,
) {
  const needed = estimateGasLamports("WITHDRAW_SPL");
  const balance = await connection.getBalance(user);

  if (balance < needed) {
    await sponsorSol(connection, user, needed - balance);
  }
}
