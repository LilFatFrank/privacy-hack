import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function backfillUsers() {
  console.log("Fetching distinct addresses from activity table...");

  // Get all distinct sender addresses
  const { data: senders, error: senderErr } = await supabase
    .from("activity")
    .select("sender_address")
    .not("sender_address", "is", null);

  if (senderErr) {
    throw new Error(`Failed to fetch senders: ${senderErr.message}`);
  }

  // Get all distinct receiver addresses
  const { data: receivers, error: receiverErr } = await supabase
    .from("activity")
    .select("receiver_address")
    .not("receiver_address", "is", null);

  if (receiverErr) {
    throw new Error(`Failed to fetch receivers: ${receiverErr.message}`);
  }

  // Collect unique addresses
  const addresses = new Set<string>();
  for (const row of senders || []) {
    if (row.sender_address) addresses.add(row.sender_address);
  }
  for (const row of receivers || []) {
    if (row.receiver_address) addresses.add(row.receiver_address);
  }

  console.log(`Found ${addresses.size} unique addresses`);

  let inserted = 0;
  let skipped = 0;

  for (const address of addresses) {
    const { error } = await supabase.from("users").upsert(
      {
        wallet_address: address,
        connection_type: "wallet",
        updated_at: Date.now(),
      },
      { onConflict: "wallet_address", ignoreDuplicates: true }
    );

    if (error) {
      console.error(`Failed to insert ${address}: ${error.message}`);
      skipped++;
    } else {
      inserted++;
    }
  }

  console.log(`Done. Inserted/updated: ${inserted}, skipped: ${skipped}`);
}

backfillUsers().catch(console.error);
