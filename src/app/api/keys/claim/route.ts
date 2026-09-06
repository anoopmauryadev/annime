import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { claimAndActivateKey, getKeyByClaimToken, isUserKeyActive } from "@/lib/db";

// GET /api/keys/claim?claim=XYZ - Validate and instantly auto-activate key
export async function GET(request: NextRequest) {
  try {
    const claimToken = request.nextUrl.searchParams.get("claim");
    if (!claimToken) {
      return NextResponse.json({ valid: false, error: "Missing claim token" }, { status: 400 });
    }

    const key = getKeyByClaimToken(claimToken);
    if (!key) {
      return NextResponse.json(
        { valid: false, error: "Invalid or expired claim token." },
        { status: 404 }
      );
    }

    // Determine target user (authenticated user or creator of this key)
    const authUser = getUserFromRequest(request);
    const targetUserId = authUser?.id || key.user_id;

    // 1. If key is already used / active
    if (key.status === "used") {
      const activeUserId = targetUserId || key.used_by_user_id;
      const activeStatus = activeUserId ? isUserKeyActive(activeUserId) : null;
      return NextResponse.json({
        valid: true,
        success: true,
        already_active: true,
        status: "used",
        key_code: key.key_code,
        duration_hours: key.duration_hours,
        expires_at: activeStatus?.expires_at || undefined,
        message: "Your 48-Hour access pass is active!",
      });
    }

    // 2. If key is pending and we have a target user, auto-activate immediately
    if (key.status === "pending" && targetUserId) {
      const result = claimAndActivateKey(claimToken, targetUserId);
      if (result.success) {
        return NextResponse.json({
          valid: true,
          success: true,
          activated: true,
          status: "used",
          key_code: result.key_code,
          duration_hours: result.duration_hours,
          expires_at: result.expires_at,
          message: `🎉 Success! Your ${result.duration_hours}-Hour access pass is now activated!`,
        });
      }
    }

    // 3. Pending without linked user yet (e.g. key created without user)
    return NextResponse.json({
      valid: true,
      status: key.status,
      duration_hours: key.duration_hours,
      created_at: key.created_at,
      key_code: key.key_code,
    });
  } catch (error: any) {
    return NextResponse.json(
      { valid: false, error: error?.message || "Error validating claim" },
      { status: 500 }
    );
  }
}

// POST /api/keys/claim - Claim and activate key for user
export async function POST(request: NextRequest) {
  try {
    const authUser = getUserFromRequest(request);
    const body = await request.json().catch(() => ({}));
    const claimToken = body.claim_token || request.nextUrl.searchParams.get("claim");

    if (!claimToken) {
      return NextResponse.json(
        { error: "Claim token is required." },
        { status: 400 }
      );
    }

    const key = getKeyByClaimToken(claimToken);
    if (!key) {
      return NextResponse.json(
        { error: "Invalid or expired claim token." },
        { status: 404 }
      );
    }

    const targetUserId = authUser?.id || key.user_id;
    if (!targetUserId) {
      return NextResponse.json(
        { error: "Please log in to activate your access key." },
        { status: 401 }
      );
    }

    const result = claimAndActivateKey(claimToken, targetUserId);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Failed to activate key." },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `🎉 Success! Your ${result.duration_hours}-Hour access pass is now activated!`,
      key_code: result.key_code,
      duration_hours: result.duration_hours,
      expires_at: result.expires_at,
    });
  } catch (error: any) {
    console.error("[KeyClaim] Error:", error);
    return NextResponse.json(
      { error: error?.message || "Internal server error activating key" },
      { status: 500 }
    );
  }
}
