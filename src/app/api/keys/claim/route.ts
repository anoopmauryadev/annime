import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { claimAndActivateKey, getKeyByClaimToken, isUserKeyActive } from "@/lib/db";

// GET only validates the provider return link. It never changes access state.
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

    if (key.status === "used") {
      const authUser = getUserFromRequest(request);
      const activeUserId = authUser?.id === key.used_by_user_id ? authUser.id : null;
      const activeStatus = activeUserId ? isUserKeyActive(activeUserId) : null;
      return NextResponse.json({
        valid: true,
        success: true,
        already_active: true,
        status: "used",
        duration_hours: key.duration_hours,
        expires_at: activeStatus?.expires_at || undefined,
        message: "Your 48-Hour access pass is active!",
      });
    }

    return NextResponse.json({
      valid: true,
      status: key.status,
      duration_hours: key.duration_hours,
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

    if (!authUser) {
      return NextResponse.json(
        { error: "Please log in to activate your access key." },
        { status: 401 }
      );
    }

    if (key.user_id && key.user_id !== authUser.id) {
      return NextResponse.json({ error: "This verification link belongs to another account." }, { status: 403 });
    }
    const result = claimAndActivateKey(claimToken, authUser.id);

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
