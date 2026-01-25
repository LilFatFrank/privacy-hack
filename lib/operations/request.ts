/**
 * Payment Request Operation
 *
 * Request payment from someone.
 * - Requester creates a request
 * - Payer can fulfill the request
 * - Requester absorbs the relayer fee (receives amount - fee)
 */

import { Connection, Keypair } from "@solana/web3.js";
import bs58 from "bs58";

import {
  createActivity,
  hashAddress,
  getActivity,
  updateActivityStatus,
} from "../database";
import { TokenType, TOKEN_MINTS } from "../privacycash/tokens";
import { sponsoredSend } from "../sponsor/sponsoredSend";

export interface CreateRequestParams {
  requesterAddress: string;
  payerAddress?: string; // Optional - if not specified, anyone can pay
  amount: number;
  token: TokenType;
  message?: string;
}

export interface CreateRequestResult {
  activityId: string;
  requestLink: string;
}

export interface FulfillRequestParams {
  activityId: string;
  payerKeypair: Keypair;
}

export interface FulfillRequestResult {
  fundTx: string;
  depositTx: string;
  withdrawTx: string;
  sweepTx: string | null;
  amountReceived: number;
  feesPaid: number;
}

/**
 * Create a payment request.
 *
 * Flow:
 * 1. Create activity record (status: open)
 * 2. Return request link
 */
export async function createRequest(
  params: CreateRequestParams
): Promise<CreateRequestResult> {
  const { requesterAddress, payerAddress, amount, token, message } = params;

  // Create activity record
  const activity = await createActivity({
    type: "request",
    sender_hash: payerAddress ? hashAddress(payerAddress) : "", // Empty if open request
    receiver_hash: hashAddress(requesterAddress),
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
    receiver_address: requesterAddress, // Stored unhashed for requests
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  return {
    activityId: activity.id,
    requestLink: `${appUrl}/pay/${activity.id}`,
  };
}

/**
 * Fulfill a payment request.
 *
 * Flow:
 * 1. Fetch activity from database
 * 2. Verify payer is allowed (if restricted)
 * 3. Execute sponsored send to requester
 * 4. Update activity status
 */
export async function fulfillRequest(
  params: FulfillRequestParams
): Promise<FulfillRequestResult> {
  const { activityId, payerKeypair } = params;

  // Get activity
  const activity = await getActivity(activityId);
  if (!activity) {
    throw new Error("Request not found");
  }

  if (activity.type !== "request") {
    throw new Error("Not a payment request");
  }

  if (activity.status !== "open") {
    throw new Error("Request already fulfilled or cancelled");
  }

  // Verify payer if restricted
  if (activity.sender_hash) {
    const payerHash = hashAddress(payerKeypair.publicKey.toBase58());
    if (activity.sender_hash !== payerHash) {
      throw new Error("Not authorized to fulfill this request");
    }
  }

  // Get requester address from receiver_hash
  // Note: We need to store the actual address somewhere for this to work
  // For now, we'll need to pass it in or store it unhashed
  // This is a design limitation - we'll need to revisit

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

  // Get the receiver address (stored unhashed for requests)
  if (!activity.receiver_address) {
    throw new Error("Request missing receiver address");
  }
  const receiverAddress = activity.receiver_address;

  // Determine token from token_address
  let token: TokenType = "USDC";
  if (activity.token_address === TOKEN_MINTS.SOL.toBase58()) {
    token = "SOL";
  }

  // Execute sponsored send
  const result = await sponsoredSend({
    connection,
    senderKeypair: payerKeypair,
    sponsorKeypair,
    receiverAddress,
    amount: activity.amount,
    token,
  });

  // Update activity
  await updateActivityStatus(activity.id, "settled", {
    tx_hash: result.withdrawTx,
  });

  return {
    fundTx: result.fundTx,
    depositTx: result.depositTx,
    withdrawTx: result.withdrawTx,
    sweepTx: result.sweepTx,
    amountReceived: result.amountSent,
    feesPaid: result.feesPaid,
  };
}

/**
 * Cancel a payment request (by requester).
 */
export async function cancelRequest(
  activityId: string,
  requesterAddress: string
): Promise<void> {
  const activity = await getActivity(activityId);
  if (!activity) {
    throw new Error("Request not found");
  }

  if (activity.type !== "request") {
    throw new Error("Not a payment request");
  }

  if (activity.status !== "open") {
    throw new Error("Request already fulfilled or cancelled");
  }

  // Verify requester
  const requesterHash = hashAddress(requesterAddress);
  if (activity.receiver_hash !== requesterHash) {
    throw new Error("Not the requester");
  }

  await updateActivityStatus(activity.id, "cancelled");
}
