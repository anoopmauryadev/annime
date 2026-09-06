import { createReport } from "@/lib/db";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// POST /api/reports — submit a bug report (no auth needed, anyone can report)
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { episode_id, server_id, issue_type, details } = body;

    if (!episode_id || !issue_type) {
      return NextResponse.json({ error: "episode_id and issue_type are required" }, { status: 400 });
    }

    const validIssues = ["video_not_playing", "buffering", "wrong_episode", "audio_issue", "subtitle_issue", "other"];
    if (!validIssues.includes(issue_type)) {
      return NextResponse.json({ error: "Invalid issue_type" }, { status: 400 });
    }

    const id = createReport({
      episode_id: parseInt(episode_id),
      server_id: server_id ? parseInt(server_id) : null,
      issue_type,
      details: details?.trim() || "",
    });

    return NextResponse.json({ success: true, id });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to submit report" }, { status: 500 });
  }
}
