import { NextRequest, NextResponse } from "next/server";

import { createRequest } from "@/lib/operations/request";
import { TokenType } from "@/lib/privacycash/tokens";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      requesterAddress,
      payerAddress,
      amount,
      token,
      message,
    }: {
      requesterAddress: string;
      payerAddress?: string;
      amount: number;
      token: TokenType;
      message?: string;
    } = body;

    // Validation
    if (!requesterAddress || !amount || !token) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    if (amount <= 0) {
      return NextResponse.json(
        { error: "Amount must be greater than zero" },
        { status: 400 }
      );
    }

    // Create request
    const result = await createRequest({
      requesterAddress,
      payerAddress,
      amount,
      token,
      message,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Create request error:", error);

    return NextResponse.json(
      { error: error.message ?? "Failed to create request" },
      { status: 500 }
    );
  }
}
