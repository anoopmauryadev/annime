import { getAllUsers, getUserCount, updateUserVipStatus, setUserVipByEmail, setUserVipByUsername } from "@/lib/db";
import { requireAdminAuth } from "@/lib/auth";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// GET /api/admin/users — List all users with search + pagination
export async function GET(request: Request) {
  const auth = requireAdminAuth(request);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") || "";
  const vipOnly = searchParams.get("vipOnly") === "true";
  const limit = parseInt(searchParams.get("limit") || "50");
  const offset = parseInt(searchParams.get("offset") || "0");

  const users = getAllUsers({ search: search || undefined, vipOnly, limit, offset });
  const total = getUserCount({ search: search || undefined, vipOnly });

  return NextResponse.json({ users, total });
}

// PATCH /api/admin/users — Toggle VIP status for a user
export async function PATCH(request: Request) {
  const auth = requireAdminAuth(request);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { userId, email, username, is_vip } = body;

    if (is_vip === undefined) {
      return NextResponse.json({ error: "is_vip field is required" }, { status: 400 });
    }

    let success = false;
    const vipValue = Number(is_vip) === 1;

    if (userId) {
      success = updateUserVipStatus(userId, vipValue);
    } else if (email) {
      success = setUserVipByEmail(email, vipValue);
    } else if (username) {
      success = setUserVipByUsername(username, vipValue);
    } else {
      return NextResponse.json(
        { error: "Provide userId, email, or username to update" },
        { status: 400 }
      );
    }

    if (!success) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: `VIP status updated to ${vipValue ? "active" : "inactive"}` });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to update user" }, { status: 500 });
  }
}
