import { createDownload, deleteDownload } from "@/lib/db";
import { NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const data = await request.json();
  const id = createDownload(data);
  return NextResponse.json({ success: true, id });
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = parseInt(searchParams.get("id") || "0");
  if (id) deleteDownload(id);
  return NextResponse.json({ success: true });
}
