import { NextRequest, NextResponse } from "next/server";
import { upsertUser } from "@/lib/database";

export async function POST(request: NextRequest) {
  try {
    const { walletAddress, connectionType, twitterHandle, privyUserId } =
      await request.json();

    if (!walletAddress || !connectionType) {
      return NextResponse.json(
        { error: "walletAddress and connectionType are required" },
        { status: 400 }
      );
    }

    if (!["wallet", "x"].includes(connectionType)) {
      return NextResponse.json(
        { error: "connectionType must be 'wallet' or 'x'" },
        { status: 400 }
      );
    }

    const user = await upsertUser({
      wallet_address: walletAddress,
      connection_type: connectionType,
      twitter_handle: twitterHandle || null,
      privy_user_id: privyUserId || null,
    });

    return NextResponse.json({ user });
  } catch (error: any) {
    console.error("User registration error:", error);
    return NextResponse.json(
      { error: error.message || "Registration failed" },
      { status: 500 }
    );
  }
}
