import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/auth";
import { deleteVipCode } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function DELETE(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = requireAdminAuth(request);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  try {
    const params = await ctx.params;
    const id = parseInt(params.id, 10);
    if (!id) {
      return NextResponse.json({ error: "Invalid VIP code ID" }, { status: 400 });
    }

    const deleted = deleteVipCode(id);
    if (!deleted) {
      return NextResponse.json({ error: "VIP code not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: "VIP code deleted successfully" });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to delete VIP code" },
      { status: 500 }
    );
  }
}
