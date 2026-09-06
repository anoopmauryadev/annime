import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { getSiteSettings, isUserKeyActive } from "@/lib/db";

// GET /api/keys/status - Check current user's key and VIP access status
export async function GET(request: NextRequest) {
  try {
    const settings = getSiteSettings();
    const isSystemEnabled = settings.key_system_enabled !== "0";

    // If key system is turned off globally, all users have access
    if (!isSystemEnabled) {
      return NextResponse.json({
        is_logged_in: false,
        active: true,
        is_vip: false,
        key_system_disabled: true,
        remaining_hours: 9999,
        expires_at: null,
      });
    }

    const user = getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({
        is_logged_in: false,
        active: false,
        is_vip: false,
        key_system_disabled: false,
        remaining_hours: 0,
        expires_at: null,
      });
    }

    const status = isUserKeyActive(user.id);

    return NextResponse.json({
      is_logged_in: true,
      user_id: user.id,
      username: user.username,
      active: status.active,
      is_vip: status.is_vip,
      key_system_disabled: status.key_system_disabled || false,
      remaining_hours: status.remaining_hours,
      expires_at: status.expires_at,
    });
  } catch (error: any) {
    console.error("[KeyStatus] Error:", error);
    return NextResponse.json(
      { error: error?.message || "Internal server error fetching key status" },
      { status: 500 }
    );
  }
}
