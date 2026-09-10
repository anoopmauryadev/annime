import { activateGuestKey, guestTable } from "@/lib/playbackAccess";
import { getKeyByCode } from "@/lib/db";
import { isSameOriginMutation } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { redeemAccessKey } from "@/lib/db";
import { rateLimit } from "@/lib/rateLimit";

// POST /api/keys/redeem - Manually redeem an access key code (e.g. AZ-XXXX-XXXX)
export async function POST(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);
    if (!isSameOriginMutation(request)) return NextResponse.json({error:"Forbidden"},{status:403});
    const limited = rateLimit(request, "key-redeem", 10, 15 * 60 * 1000, String(user?.id || "guest"));
    if (limited) return limited;
    const body = await request.json().catch(() => ({}));
    const keyCode = typeof body.key_code === "string" ? body.key_code.trim() : "";

    if (!keyCode || keyCode.length > 64) {
      return NextResponse.json(
        { error: "Please provide a valid access key code." },
        { status: 400 }
      );
    }

    const key = getKeyByCode(keyCode);
    const guestOwned = key && guestTable().prepare("SELECT key_id FROM guest_keys WHERE key_id=?").get(key.id);
    const result: {success:boolean;error?:string;duration_hours?:number;expires_at?:string} = key && (guestOwned || !user)
      ? activateGuestKey(request,key.id)
      : user ? redeemAccessKey(keyCode,user.id) : {success:false,error:"Invalid key"};

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Failed to redeem access key." },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `🎉 Key redeemed! You now have ${result.duration_hours} hours of unlimited video access.`,
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
