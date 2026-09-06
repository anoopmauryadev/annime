import { getAllDownloadsWithDetails, getUserById } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// GET /api/downloads — Fetch member downloads (Requires VIP authentication)
export async function GET(request: Request) {
  const userPayload = getUserFromRequest(request);
  if (!userPayload) {
    return NextResponse.json(
      { error: "Unauthorized: Sign in to your account to access downloads" },
      { status: 401 }
    );
  }

  // Check VIP status from database (most up-to-date)
  const user = getUserById(userPayload.id);
  if (!user || !user.is_vip) {
    return NextResponse.json(
      { error: "VIP membership required to access downloads. Upgrade your account to VIP to unlock downloads." },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get("limit") || "50");

  const downloads = getAllDownloadsWithDetails(limit);
  return NextResponse.json({ downloads });
}
