import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import { loadSponsorWallet } from "./sponsorWallet";

export async function sponsorSol(
  connection: Connection,
  recipient: PublicKey,
  lamports: number,
) {
  const sponsor = loadSponsorWallet();

  const tx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: sponsor.publicKey,
      toPubkey: recipient,
      lamports,
    }),
  );

  return connection.sendTransaction(tx, [sponsor]);
}
