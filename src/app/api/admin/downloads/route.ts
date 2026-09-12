import { createDownload, deleteDownload } from "@/lib/db";
import { requireAdminAuth } from "@/lib/auth";
import { NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const auth = requireAdminAuth(request);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  const data = await request.json();
  const id = createDownload(data);
  return NextResponse.json({ success: true, id });
}

export async function DELETE(request: Request) {
  const auth = requireAdminAuth(request);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = parseInt(searchParams.get("id") || "0");
  if (id) {
    const { cleanupDownloadFiles } = await import("@/lib/fileCleanup");
    await cleanupDownloadFiles(id);
    deleteDownload(id);
  }
  return NextResponse.json({ success: true });
}
