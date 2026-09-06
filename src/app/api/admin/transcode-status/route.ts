import { getTranscodeJobByServer } from "@/lib/db";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const serverId = parseInt(searchParams.get("server_id") || "0");

  if (!serverId) {
    return NextResponse.json({ error: "server_id required" }, { status: 400 });
  }

  const job = getTranscodeJobByServer(serverId);

  if (!job) {
    return NextResponse.json({ status: "none", progress_text: "" });
  }

  return NextResponse.json({
    id: job.id,
    status: job.status, // "pending" | "processing" | "complete" | "failed"
    progress_text: job.progress_text,
    error: job.error || "",
    updated_at: job.updated_at,
  });
}
