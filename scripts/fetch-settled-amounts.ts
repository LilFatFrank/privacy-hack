import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface SettledActivity {
  id: string;
  type: string;
  sender_address: string;
  receiver_address: string | null;
  amount: number;
  tx_hash: string | null;
  created_at: number;
}

async function fetchSettledAmounts() {
  const { data, error } = await supabase
    .from("activity")
    .select("id, type, sender_address, receiver_address, amount, tx_hash, created_at")
    .eq("status", "settled")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching settled activities:", error.message);
    process.exit(1);
  }

  const activities = (data || []) as SettledActivity[];

  if (activities.length === 0) {
    console.log("No settled transactions found.");
    return;
  }

  // Group by type
  const sends = activities.filter((a) => a.type === "send");
  const requests = activities.filter((a) => a.type === "request");
  const claims = activities.filter((a) => a.type === "send_claim");

  const totalAll = activities.reduce((sum, a) => sum + a.amount, 0);
  const totalSends = sends.reduce((sum, a) => sum + a.amount, 0);
  const totalRequests = requests.reduce((sum, a) => sum + a.amount, 0);
  const totalClaims = claims.reduce((sum, a) => sum + a.amount, 0);

  console.log("=== Settled USDC Amounts ===\n");
  console.log(`Total settled:        $${totalAll.toFixed(2)} USDC across ${activities.length} transactions`);
  console.log(`  Send:               $${totalSends.toFixed(2)} USDC (${sends.length} txns)`);
  console.log(`  Request (fulfilled): $${totalRequests.toFixed(2)} USDC (${requests.length} txns)`);
  console.log(`  Send & Claim:       $${totalClaims.toFixed(2)} USDC (${claims.length} txns)`);

  console.log("\n--- All Settled Transactions ---\n");
  console.log(
    "Date".padEnd(22) +
    "Type".padEnd(14) +
    "Amount".padEnd(14) +
    "Sender".padEnd(14) +
    "Receiver".padEnd(14) +
    "Tx Hash"
  );
  console.log("-".repeat(100));

  for (const a of activities) {
    const date = new Date(a.created_at).toISOString().replace("T", " ").slice(0, 19);
    const sender = a.sender_address ? a.sender_address.slice(0, 8) + "..." : "N/A";
    const receiver = a.receiver_address ? a.receiver_address.slice(0, 8) + "..." : "N/A";
    const txHash = a.tx_hash ? a.tx_hash.slice(0, 12) + "..." : "N/A";

    console.log(
      date.padEnd(22) +
      a.type.padEnd(14) +
      `$${a.amount.toFixed(2)}`.padEnd(14) +
      sender.padEnd(14) +
      receiver.padEnd(14) +
      txHash
    );
  }
}

fetchSettledAmounts();
