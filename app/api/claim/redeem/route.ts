import { NextRequest, NextResponse } from "next/server";

import { claimPayment } from "@/lib/operations/claim";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      activityId,
      passphrase,
      receiverAddress,
    }: {
      activityId: string;
      passphrase: string;
      receiverAddress: string;
    } = body;

    // Validation
    if (!activityId || !passphrase || !receiverAddress) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Claim payment
    const result = await claimPayment({
      activityId,
      passphrase,
      receiverAddress,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Claim payment error:", error);

    // Check for specific errors
    if (error.message === "Invalid passphrase") {
      return NextResponse.json({ error: "Invalid passphrase" }, { status: 401 });
    }

    if (error.message === "Claim link not found") {
      return NextResponse.json({ error: "Claim link not found" }, { status: 404 });
    }

    if (error.message === "Claim link already used or cancelled") {
      return NextResponse.json(
        { error: "Claim link already used or cancelled" },
        { status: 410 }
      );
    }

    return NextResponse.json(
      { error: error.message ?? "Failed to claim" },
      { status: 500 }
    );
  }
}
