import { NextRequest, NextResponse } from "next/server";
import {
  getUserByTwitterHandle,
  upsertUser,
  getTwitterIdByHandle,
  cacheTwitterId,
} from "@/lib/database";
import { getPrivyClient } from "@/lib/privy-server";

async function resolveTwitterNumericId(handle: string): Promise<string> {
  // Check cache first
  const cached = await getTwitterIdByHandle(handle);
  if (cached) return cached;

  // Call X API to resolve handle → numeric ID
  const res = await fetch(
    `https://api.x.com/2/users/by/username/${encodeURIComponent(handle)}`,
    {
      headers: {
        Authorization: `Bearer ${process.env.TWITTER_BEARER_TOKEN}`,
      },
    }
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`X API error (${res.status}): ${body}`);
  }

  const json = await res.json();

  if (!json.data?.id) {
    throw new Error(`X user @${handle} not found`);
  }

  const numericId: string = json.data.id;

  // Cache for future lookups
  await cacheTwitterId(handle, numericId);

  return numericId;
}

export async function POST(request: NextRequest) {
  try {
    const { twitterHandle } = await request.json();

    if (!twitterHandle) {
      return NextResponse.json(
        { error: "twitterHandle is required" },
        { status: 400 }
      );
    }

    // Normalize handle (remove @ if present)
    const handle = twitterHandle.replace(/^@/, "").toLowerCase();

    // Check if user already exists in our DB
    const existingUser = await getUserByTwitterHandle(handle);
    if (existingUser) {
      return NextResponse.json({
        walletAddress: existingUser.wallet_address,
        isNewUser: false,
      });
    }

    // Resolve handle → numeric ID via X API (with caching)
    const numericId = await resolveTwitterNumericId(handle);

    // Create a new Privy user with embedded Solana wallet
    // Using numeric ID as subject so it matches Privy OAuth login
    const privy = getPrivyClient();
    const newUser = await privy.importUser({
      linkedAccounts: [
        {
          type: "twitter_oauth",
          subject: numericId,
          username: handle,
          name: handle,
        },
      ],
      createSolanaWallet: true,
    });

    // Find the Solana wallet from the created user
    const solanaWallet = newUser.linkedAccounts.find(
      (account: any) =>
        account.type === "wallet" && account.chainType === "solana"
    );

    if (!solanaWallet || !("address" in solanaWallet)) {
      return NextResponse.json(
        { error: "Failed to create embedded wallet" },
        { status: 500 }
      );
    }

    const walletAddress = solanaWallet.address as string;

    // Store in users table
    await upsertUser({
      wallet_address: walletAddress,
      connection_type: "x",
      twitter_handle: handle,
      privy_user_id: newUser.id,
    });

    return NextResponse.json({
      walletAddress,
      isNewUser: true,
    });
  } catch (error: any) {
    console.error("Resolve X handle error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to resolve X handle" },
      { status: 500 }
    );
  }
}
