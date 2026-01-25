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
        { error: "Activity ID required" },
        { status: 400 }
      );
    }

    const activity = await getActivity(id);

    if (!activity) {
      return NextResponse.json(
        { error: "Activity not found" },
        { status: 404 }
      );
    }

    // Remove sensitive fields before returning
    const {
      encrypted_for_receiver,
      encrypted_for_sender,
      ...safeActivity
    } = activity;

    return NextResponse.json(safeActivity);
  } catch (error: any) {
    console.error("Get activity error:", error);

    return NextResponse.json(
      { error: error.message ?? "Failed to get activity" },
      { status: 500 }
    );
  }
}
