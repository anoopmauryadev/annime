import { addComment, getCommentsByEpisode, deleteComment } from "@/lib/db";
import { getUserFromRequest } from "@/lib/auth";
import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

// GET /api/comments?episode_id=123
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const episodeId = parseInt(searchParams.get("episode_id") || "0");

  if (!episodeId) {
    return NextResponse.json({ error: "episode_id required" }, { status: 400 });
  }

  const comments = getCommentsByEpisode(episodeId);
  return NextResponse.json(comments);
}

// POST /api/comments — add comment (login required)
export async function POST(request: Request) {
  const user = getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "Login required to comment" }, { status: 401 });
  }

  const limited = rateLimit(request, "comments", 10, 60 * 1000, String(user.id));
  if (limited) return limited;
  try {
    const body = await request.json();
    const { episode_id, comment } = body;

    if (!episode_id || typeof comment !== "string" || !comment.trim()) {
      return NextResponse.json({ error: "episode_id and comment are required" }, { status: 400 });
    }

    if (comment.trim().length > 500) {
      return NextResponse.json({ error: "Comment too long (max 500 chars)" }, { status: 400 });
    }

    const id = addComment({
      episode_id: parseInt(episode_id),
      user_id: user.id,
      comment: comment.trim(),
    });

    return NextResponse.json({ success: true, id });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to add comment" }, { status: 500 });
  }
}

// DELETE /api/comments?id=123 — delete comment
export async function DELETE(request: Request) {
  const user = getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const commentId = parseInt(searchParams.get("id") || "0");
  if (!commentId) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  // Only allow user to delete their own comment (or admin)
  const deleted = deleteComment(commentId, user.id);
  if (!deleted) {
    return NextResponse.json({ error: "Comment not found or not authorized" }, { status: 403 });
  }

  return NextResponse.json({ success: true });
}
