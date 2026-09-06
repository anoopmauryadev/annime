import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { redeemAccessKey } from "@/lib/db";

// POST /api/keys/redeem - Manually redeem an access key code (e.g. AZ-XXXX-XXXX)
export async function POST(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { error: "Please log in to redeem your access key." },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const keyCode = (body.key_code || "").trim();

    if (!keyCode) {
      return NextResponse.json(
        { error: "Please provide a valid access key code." },
        { status: 400 }
      );
    }

    const result = redeemAccessKey(keyCode, user.id);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Failed to redeem access key." },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `🎉 Key redeemed! You now have ${result.duration_hours} hours of unlimited video access.`,
      key_code: result.key_code,
      duration_hours: result.duration_hours,
      expires_at: result.expires_at,
    });
  } catch (error: any) {
    console.error("[KeyRedeem] Error:", error);
    return NextResponse.json(
      { error: error?.message || "Internal server error redeeming key" },
      { status: 500 }
    );
  }
}
