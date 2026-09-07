import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/auth";
import { getAllVipCodes, generateVipCodes } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET /api/admin/vip-codes - List VIP codes
export async function GET(request: NextRequest) {
  const auth = requireAdminAuth(request);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = parseInt(searchParams.get("limit") || "50", 10);
  const status = (searchParams.get("status") || "all") as "all" | "unused" | "used";
  const search = searchParams.get("search") || "";

  const result = getAllVipCodes({ page, limit, status, search });
  return NextResponse.json(result);
}

// POST /api/admin/vip-codes - Generate VIP codes
export async function POST(request: NextRequest) {
  const auth = requireAdminAuth(request);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  try {
    const body = await request.json();
    const count = parseInt(body.count || "1", 10);
    const durationDays = parseInt(body.duration_days || "30", 10);
    const notes = typeof body.notes === "string" ? body.notes : "";

    const result = generateVipCodes(count, durationDays, notes);
    return NextResponse.json({
      success: true,
      message: `Successfully generated ${result.createdCount} VIP code(s).`,
      codes: result.codes,
      createdCount: result.createdCount,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to generate VIP codes." },
      { status: 500 }
    );
  }
}
