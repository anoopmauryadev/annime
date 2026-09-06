import { upsertWatchHistory, getUserWatchHistory, getEpisodeWatchProgress } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// GET /api/history — fetch continue watching items or progress for a specific episode
export async function GET(request: Request) {
  const user = getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ history: [], progress: null });
  }

  const { searchParams } = new URL(request.url);
  const episodeId = searchParams.get("episode_id");

  if (episodeId) {
    const progress = getEpisodeWatchProgress(user.id, parseInt(episodeId));
    return NextResponse.json({ progress: progress || null });
  }

  const limit = parseInt(searchParams.get("limit") || "10");
  const history = getUserWatchHistory(user.id, limit);
  return NextResponse.json({ history });
}

// POST /api/history — save user playback position
export async function POST(request: Request) {
  const user = getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { anime_id, episode_id, progress_seconds, duration_seconds } = body;

    if (!anime_id || !episode_id) {
      return NextResponse.json({ error: "anime_id and episode_id required" }, { status: 400 });
    }

    upsertWatchHistory({
      user_id: user.id,
      anime_id: parseInt(anime_id),
      episode_id: parseInt(episode_id),
      progress_seconds: parseFloat(progress_seconds || 0),
      duration_seconds: parseFloat(duration_seconds || 0),
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to update history" }, { status: 500 });
  }
}
