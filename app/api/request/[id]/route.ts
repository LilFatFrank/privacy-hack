import { NextRequest, NextResponse } from "next/server";
import { getActivity } from "@/lib/database";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: "Missing request ID" },
        { status: 400 }
      );
    }

    const activity = await getActivity(id);

    if (!activity) {
      return NextResponse.json(
        { error: "Request not found" },
        { status: 404 }
      );
    }

    if (activity.type !== "request") {
      return NextResponse.json(
        { error: "Not a payment request" },
        { status: 400 }
      );
    }

    // Return public request info
    // For requests, receiver_hash contains the actual address (not hashed)
    return NextResponse.json({
      id: activity.id,
      amount: activity.amount,
      token: activity.token_address,
      status: activity.status,
      message: activity.message,
      createdAt: activity.created_at,
      // Only include receiver address for open requests (needed to fulfill)
      receiverAddress: activity.status === "open" ? activity.receiver_hash : undefined,
    });
  } catch (error: any) {
    console.error("Get request error:", error);

    return NextResponse.json(
      { error: error.message ?? "Failed to get request" },
      { status: 500 }
    );
  }
}
