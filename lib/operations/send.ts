/**
 * Direct Send Operation
 *
 * Sends funds directly to a recipient through PrivacyCash.
 * - Sender's identity is hidden from receiver
 * - Sponsor pays all gas fees
 * - All remaining SOL is swept back to sponsor
 */

import { Connection, Keypair } from "@solana/web3.js";
import bs58 from "bs58";

import { sponsoredSend, SponsoredSendResult } from "../sponsor/sponsoredSend";
import {
  createActivity,
  hashAddress,
  Activity,
  updateActivityStatus,
} from "../database";
import { TokenType, TOKEN_MINTS } from "../privacycash/tokens";

export interface DirectSendParams {
  senderKeypair: Keypair;
  receiverAddress: string;
  amount: number; // In token units (e.g., 1.5 for $1.50 USDC)
  token: TokenType;
  message?: string;
}

export interface DirectSendResult {
  activityId: string;
  fundTx: string;
  depositTx: string;
  withdrawTx: string;
  sweepTx: string | null;
  amountSent: number;
  feesPaid: number;
}

/**
 * Execute a direct send operation.
 *
 * Flow:
 * 1. Create activity record (status: open)
 * 2. Execute sponsored send (deposit → withdraw)
 * 3. Update activity record (status: settled)
 */
export async function directSend(
  params: DirectSendParams
): Promise<DirectSendResult> {
  const { senderKeypair, receiverAddress, amount, token, message } = params;

  // Get sponsor keypair from env
  const sponsorKey = process.env.SPONSOR_PRIVATE_KEY;
  if (!sponsorKey) {
    throw new Error("SPONSOR_PRIVATE_KEY not configured");
  }
  const sponsorKeypair = Keypair.fromSecretKey(bs58.decode(sponsorKey));

  // Get connection
  const rpcUrl = process.env.RPC_URL;
  if (!rpcUrl) {
    throw new Error("RPC_URL not configured");
  }
  const connection = new Connection(rpcUrl, "confirmed");

  // Create activity record
  const activity = await createActivity({
    type: "send",
    sender_hash: hashAddress(senderKeypair.publicKey.toBase58()),
    receiver_hash: hashAddress(receiverAddress),
    amount,
    token_address: TOKEN_MINTS[token].toBase58(),
    status: "open",
    message: message || null,
    tx_hash: null,
    burner_address: null,
    encrypted_for_receiver: null,
    encrypted_for_sender: null,
    deposit_tx_hash: null,
    claim_tx_hash: null,
  });

  try {
    // Execute sponsored send
    const result = await sponsoredSend({
      connection,
      senderKeypair,
      sponsorKeypair,
      receiverAddress,
      amount,
      token,
    });

    // Update activity with transaction hashes
    await updateActivityStatus(activity.id, "settled", {
      tx_hash: result.withdrawTx,
    });

    return {
      activityId: activity.id,
      fundTx: result.fundTx,
      depositTx: result.depositTx,
      withdrawTx: result.withdrawTx,
      sweepTx: result.sweepTx,
      amountSent: result.amountSent,
      feesPaid: result.feesPaid,
    };
  } catch (error) {
    // Mark activity as failed (cancelled)
    await updateActivityStatus(activity.id, "cancelled");
    throw error;
  }
}
