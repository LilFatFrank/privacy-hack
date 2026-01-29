/**
 * Payment Request Operation
 *
 * Request payment from someone.
 * - Requester creates a request
 * - Payer can fulfill the request via prepare/submit flow
 * - Requester absorbs the relayer fee (receives amount - fee)
 */

import {
  createActivity,
  hashAddress,
  getActivity,
  updateActivityStatus,
} from "../database";
import { TokenType, TOKEN_MINTS } from "../privacycash/tokens";

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
  // For requests: store actual receiver address (not hashed) so we can fulfill
  const activity = await createActivity({
    type: "request",
    sender_hash: payerAddress ? hashAddress(payerAddress) : "", // Empty if open request
    receiver_hash: requesterAddress, // Actual address for requests (needed for withdraw)
    amount,
    token_address: TOKEN_MINTS[token].toBase58(),
    status: "open",
    message: message || null,
    tx_hash: null,
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  return {
    activityId: activity.id,
    requestLink: `${appUrl}/pay/${activity.id}`,
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

  // Verify requester (for requests, receiver_hash is the actual address)
  if (activity.receiver_hash !== requesterAddress) {
    throw new Error("Not the requester");
  }

  await updateActivityStatus(activity.id, "cancelled");
}
