import { EncryptedPayload } from "./crypto";

export interface Payment {
  id: string;

  burnerPublicKey: string;

  encryptedKeyForRecipient: EncryptedPayload;
  encryptedKeyForSender: EncryptedPayload;

  sender: string;
  recipient: string;

  amount: number;
  token: "SOL" | "USDC" | "USDT";

  status: "pending" | "claimed" | "reclaimed";

  createdAt: number;
  claimedAt?: number;

  depositTxSignature?: string;
}

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function storePayment(payment: Payment): Promise<void> {
  const { error } = await supabase.from("payments").insert([payment]);

  if (error) {
    throw new Error(`Failed to store payment: ${error.message}`);
  }
}

export async function getPayment(id: string): Promise<Payment | null> {
  const { data, error } = await supabase
    .from("payments")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return null;
    }
    throw new Error(`Failed to get payment: ${error.message}`);
  }

  return data;
}

export async function updatePaymentStatus(
  id: string,
  status: "claimed" | "reclaimed",
  claimedAt: number
): Promise<void> {
  const { error } = await supabase
    .from("payments")
    .update({ status, claimedAt })
    .eq("id", id);

  if (error) {
    throw new Error(`Failed to update payment: ${error.message}`);
  }
}

export async function getPaymentsByRecipient(
  recipient: string
): Promise<Payment[]> {
  const { data, error } = await supabase
    .from("payments")
    .select("*")
    .eq("recipient", recipient)
    .order("createdAt", { ascending: false });

  if (error) {
    throw new Error(`Failed to get payments: ${error.message}`);
  }

  return data || [];
}

export async function getPaymentsBySender(sender: string): Promise<Payment[]> {
  const { data, error } = await supabase
    .from("payments")
    .select("*")
    .eq("sender", sender)
    .order("createdAt", { ascending: false });

  if (error) {
    throw new Error(`Failed to get payments: ${error.message}`);
  }

  return data || [];
}
