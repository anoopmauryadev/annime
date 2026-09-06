import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/auth";
import {
  getAllAccessKeys,
  generateBulkKeys,
  revokeAccessKey,
  deleteAccessKey,
  createAccessKey,
} from "@/lib/db";

export const dynamic = "force-dynamic";

// GET /api/admin/keys - List access keys with pagination, search, and status filter
export async function GET(request: NextRequest) {
  const auth = requireAdminAuth(request);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = parseInt(searchParams.get("limit") || "25", 10);
  const status = searchParams.get("status") || "all";
  const search = searchParams.get("search") || "";

  const result = getAllAccessKeys({ page, limit, status, search });
  return NextResponse.json(result);
}

// POST /api/admin/keys - Generate keys (bulk or single custom code)
export async function POST(request: NextRequest) {
  const auth = requireAdminAuth(request);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  try {
    const body = await request.json();
    const count = parseInt(body.count || "1", 10);
    const durationHours = parseInt(body.duration_hours || "48", 10);
    const customCode = body.custom_code?.trim();

    if (customCode) {
      // Create a single custom key
      const key = createAccessKey({
        key_code: customCode,
        duration_hours: durationHours,
      });
      return NextResponse.json({
        success: true,
        message: `Custom key ${key.key_code} created successfully.`,
        keys: [key.key_code],
      });
    }

    // Bulk generate
    const safeCount = Math.min(100, Math.max(1, count));
    const generated = generateBulkKeys(safeCount, durationHours);

    return NextResponse.json({
      success: true,
      message: `Generated ${generated.length} access keys (${durationHours}h validity each).`,
      keys: generated,
    });
  } catch (error: any) {
    console.error("[AdminKeys] Error creating keys:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to generate keys" },
      { status: 500 }
    );
  }
}

// PATCH /api/admin/keys - Revoke a key
export async function PATCH(request: NextRequest) {
  const auth = requireAdminAuth(request);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  try {
    const body = await request.json();
    const id = parseInt(body.id, 10);
    if (!id) {
      return NextResponse.json({ error: "Key ID is required" }, { status: 400 });
    }

    const success = revokeAccessKey(id);
    if (!success) {
      return NextResponse.json({ error: "Key not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: "Key revoked successfully" });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to revoke key" },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/keys - Delete a key
export async function DELETE(request: NextRequest) {
  const auth = requireAdminAuth(request);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  try {
    const body = await request.json();
    const id = parseInt(body.id, 10);
    if (!id) {
      return NextResponse.json({ error: "Key ID is required" }, { status: 400 });
    }

    const success = deleteAccessKey(id);
    if (!success) {
      return NextResponse.json({ error: "Key not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: "Key deleted successfully" });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to delete key" },
      { status: 500 }
    );
  }
}
