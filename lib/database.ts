import { createClient } from "@supabase/supabase-js";
import { createHmac } from "crypto";
import { EncryptedPayload } from "./crypto";

// Types
export type ActivityType = "send" | "request" | "claim";
export type ActivityStatus = "open" | "settled" | "cancelled";

export interface Activity {
  id: string;
  type: ActivityType;
  sender_hash: string;
  receiver_hash: string | null;
  amount: number;
  token_address: string | null; // null for native SOL
  status: ActivityStatus;
  message: string | null;
  tx_hash: string | null;
  created_at: number;
  updated_at: number;

  // Claim-specific fields (optional, only for claim type)
  burner_address?: string | null;
  encrypted_for_receiver?: EncryptedPayload | null;
  encrypted_for_sender?: EncryptedPayload | null;
  deposit_tx_hash?: string | null;
  claim_tx_hash?: string | null;

  // Request-specific field (optional, only for request type)
  receiver_address?: string | null;
}

// Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Hash address with secret
export function hashAddress(address: string): string {
  const secret = process.env.HASH_SECRET;
  if (!secret) {
    throw new Error("HASH_SECRET not configured");
  }
  return createHmac("sha256", secret).update(address).digest("hex");
}

// Create activity
export async function createActivity(
  activity: Omit<Activity, "id" | "created_at" | "updated_at">
): Promise<Activity> {
  const now = Date.now();
  const id = crypto.randomUUID();

  const record: Activity = {
    ...activity,
    id,
    created_at: now,
    updated_at: now,
  };

  // Remove undefined fields to avoid Supabase schema errors
  const cleanRecord = Object.fromEntries(
    Object.entries(record).filter(([_, v]) => v !== undefined)
  );

  const { error } = await supabase.from("activity").insert([cleanRecord]);

  if (error) {
    throw new Error(`Failed to create activity: ${error.message}`);
  }

  return record;
}

// Get activity by ID
export async function getActivity(id: string): Promise<Activity | null> {
  const { data, error } = await supabase
    .from("activity")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return null;
    }
    throw new Error(`Failed to get activity: ${error.message}`);
  }

  return data;
}

// Update activity status
export async function updateActivityStatus(
  id: string,
  status: ActivityStatus,
  updates?: Partial<Pick<Activity, "tx_hash" | "claim_tx_hash" | "receiver_hash" | "sender_hash">>
): Promise<void> {
  const { error } = await supabase
    .from("activity")
    .update({
      status,
      updated_at: Date.now(),
      ...updates,
    })
    .eq("id", id);

  if (error) {
    throw new Error(`Failed to update activity: ${error.message}`);
  }
}

// Get all activities for a user
export async function getActivitiesForUser(
  userAddress: string
): Promise<Activity[]> {
  const userHash = hashAddress(userAddress);

  const { data, error } = await supabase
    .from("activity")
    .select("*")
    .or(`sender_hash.eq.${userHash},receiver_hash.eq.${userHash}`)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to get activities: ${error.message}`);
  }

  return data || [];
}

// Get user stats (computed from activity)
export async function getUserStats(userAddress: string): Promise<{
  total_sent: number;
  total_received: number;
  total_claimed: number;
}> {
  const userHash = hashAddress(userAddress);

  // Get all settled activities where user is sender
  const { data: sentData, error: sentError } = await supabase
    .from("activity")
    .select("amount, type")
    .eq("sender_hash", userHash)
    .eq("status", "settled");

  if (sentError) {
    throw new Error(`Failed to get sent stats: ${sentError.message}`);
  }

  // Get all settled activities where user is receiver
  const { data: receivedData, error: receivedError } = await supabase
    .from("activity")
    .select("amount, type")
    .eq("receiver_hash", userHash)
    .eq("status", "settled");

  if (receivedError) {
    throw new Error(`Failed to get received stats: ${receivedError.message}`);
  }

  const total_sent = (sentData || [])
    .filter((a) => a.type === "send")
    .reduce((sum, a) => sum + a.amount, 0);

  const total_received = (receivedData || [])
    .filter((a) => a.type === "send" || a.type === "request")
    .reduce((sum, a) => sum + a.amount, 0);

  const total_claimed = (receivedData || [])
    .filter((a) => a.type === "claim")
    .reduce((sum, a) => sum + a.amount, 0);

  return { total_sent, total_received, total_claimed };
}
