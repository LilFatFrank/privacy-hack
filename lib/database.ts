import { createClient } from "@supabase/supabase-js";
import { EncryptedPayload, PassphraseEncryptedPayload } from "./crypto";

// Types
export type ActivityType = "send" | "request" | "send_claim";

// Encrypted data can be either asymmetric (EncryptedPayload) or symmetric (PassphraseEncryptedPayload)
export type ClaimEncryptedData = EncryptedPayload | PassphraseEncryptedPayload;
export type ActivityStatus = "open" | "settled" | "cancelled";

export interface Activity {
  id: string;
  type: ActivityType;
  sender_address: string;
  receiver_address: string | null;
  amount: number;
  token_address: string | null; // null for native SOL
  status: ActivityStatus;
  message: string | null;
  tx_hash: string | null;
  created_at: number;
  updated_at: number;

  // send_claim-specific fields (optional, only for send_claim type)
  burner_address?: string | null;
  encrypted_for_receiver?: ClaimEncryptedData | null;
  encrypted_for_sender?: ClaimEncryptedData | null;
  deposit_tx_hash?: string | null;
  claim_tx_hash?: string | null;
}

// Supabase client (lazy-loaded to avoid build-time errors)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let supabase: any = null;

function getSupabase() {
  if (!supabase) {
    supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }
  return supabase;
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

  const { error } = await getSupabase().from("activity").insert([cleanRecord]);

  if (error) {
    throw new Error(`Failed to create activity: ${error.message}`);
  }

  return record;
}

// Get activity by ID
export async function getActivity(id: string): Promise<Activity | null> {
  const { data, error } = await getSupabase()
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
  updates?: Partial<Pick<Activity, "tx_hash" | "claim_tx_hash" | "receiver_address" | "sender_address">>
): Promise<void> {
  const { error } = await getSupabase()
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
  const { data, error } = await getSupabase()
    .from("activity")
    .select("*")
    .or(`sender_address.eq.${userAddress},receiver_address.eq.${userAddress}`)
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
  // Get all settled activities where user is sender
  const { data: sentData, error: sentError } = await supabase
    .from("activity")
    .select("amount, type")
    .eq("sender_address", userAddress)
    .eq("status", "settled");

  if (sentError) {
    throw new Error(`Failed to get sent stats: ${sentError.message}`);
  }

  // Get all settled activities where user is receiver
  const { data: receivedData, error: receivedError } = await supabase
    .from("activity")
    .select("amount, type")
    .eq("receiver_address", userAddress)
    .eq("status", "settled");

  if (receivedError) {
    throw new Error(`Failed to get received stats: ${receivedError.message}`);
  }

  const total_sent = (sentData || [])
    .filter((a: Activity) => a.type === "send")
    .reduce((sum: number, a: Activity) => sum + a.amount, 0);

  const total_received = (receivedData || [])
    .filter((a: Activity) => a.type === "send" || a.type === "request")
    .reduce((sum: number, a: Activity) => sum + a.amount, 0);

  const total_claimed = (receivedData || [])
    .filter((a: Activity) => a.type === "send_claim")
    .reduce((sum: number, a: Activity) => sum + a.amount, 0);

  return { total_sent, total_received, total_claimed };
}
