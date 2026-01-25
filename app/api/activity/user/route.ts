import { NextRequest, NextResponse } from "next/server";

import { getActivitiesForUser, getUserStats } from "@/lib/database";

export async function GET(request: NextRequest) {
  try {
    const userAddress = request.nextUrl.searchParams.get("address");

    if (!userAddress) {
      return NextResponse.json(
        { error: "User address required" },
        { status: 400 }
      );
    }

    // Get activities and stats in parallel
    const [activities, stats] = await Promise.all([
      getActivitiesForUser(userAddress),
      getUserStats(userAddress),
    ]);

    // Remove sensitive fields before returning
    const safeActivities = activities.map(
      ({ encrypted_for_receiver, encrypted_for_sender, ...activity }) => activity
    );

    return NextResponse.json({
      activities: safeActivities,
      stats,
    });
  } catch (error: any) {
    console.error("Get user activities error:", error);

    return NextResponse.json(
      { error: error.message ?? "Failed to get activities" },
      { status: 500 }
    );
  }
}
