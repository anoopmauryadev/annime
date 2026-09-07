import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { redeemVipCode } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { error: "Please log in to redeem your VIP code." },
        { status: 401 }
      );
    }

    const body = await request.json();
    const code = (body.code || "").trim();

    if (!code) {
      return NextResponse.json(
        { error: "Please enter a valid VIP code." },
        { status: 400 }
      );
    }

    const result = redeemVipCode(code, user.id, user.username);
    if (!result.success) {
      return NextResponse.json({ error: result.message }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: result.message,
      vip_expires_at: result.vip_expires_at,
      duration_days: result.duration_days,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to redeem VIP code." },
      { status: 500 }
    );
  }
}
