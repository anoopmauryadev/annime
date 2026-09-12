import { createServer, updateServer, deleteServer } from "@/lib/db";
import { requireAdminAuth } from "@/lib/auth";
import { NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

function cleanStreamUrl(url: string): string {
  if (!url) return "";
  let clean = url.trim();
  if (clean.includes("<iframe") || clean.includes("src=")) {
    const match = clean.match(/src=["']([^"']+)["']/i);
    if (match && match[1]) {
      clean = match[1];
    }
  }
  return clean;
}

export async function POST(request: Request) {
  const auth = requireAdminAuth(request);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
  }

  const data = await request.json();
  if (data.stream_url) {
    data.stream_url = cleanStreamUrl(data.stream_url);
  }
  const id = createServer(data);
  return NextResponse.json({ success: true, id });
}

export async function PUT(request: Request) {
  const auth = requireAdminAuth(request);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
  }

  const data = await request.json();
  const { id, ...rest } = data;
  if (rest.stream_url) {
    rest.stream_url = cleanStreamUrl(rest.stream_url);
  }
  if(rest.stream_url) {
    const {cancelServerTranscodes}=await import("@/lib/cancelTranscodes");
    await cancelServerTranscodes(Number(id));
  }
  updateServer(id, rest);
  return NextResponse.json({ success: true });
}

export async function DELETE(request: Request) {
  const auth = requireAdminAuth(request);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = parseInt(searchParams.get("id") || "0");
  if (id) {
    const { cleanupServerFiles } = await import("@/lib/fileCleanup");
    await cleanupServerFiles(id);
    deleteServer(id);
  }
  return NextResponse.json({ success: true });
}
