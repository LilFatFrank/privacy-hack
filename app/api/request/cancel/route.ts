import { NextRequest, NextResponse } from "next/server";

import { cancelRequest } from "@/lib/operations/request";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      activityId,
      requesterAddress,
    }: {
      activityId: string;
      requesterAddress: string;
    } = body;

    // Validation
    if (!activityId || !requesterAddress) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Cancel request
    await cancelRequest(activityId, requesterAddress);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Cancel request error:", error);

    if (error.message === "Request not found") {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }

    if (error.message === "Not the requester") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    if (error.message === "Request already fulfilled or cancelled") {
      return NextResponse.json(
        { error: "Request already fulfilled or cancelled" },
        { status: 410 }
      );
    }

    return NextResponse.json(
      { error: error.message ?? "Failed to cancel request" },
      { status: 500 }
    );
  }
}
