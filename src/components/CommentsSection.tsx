"use client";

import { useState, useEffect, useCallback } from "react";
import { MessageSquare, Send, Trash2, User, Loader2 } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";

interface Comment {
  id: number;
  episode_id: number;
  user_id: number;
  comment: string;
  created_at: string;
  username: string;
  avatar: string | null;
}

export default function CommentsSection({ episodeId }: { episodeId: number }) {
  const { user } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchComments = useCallback(async () => {
    try {
      const res = await fetch(`/api/comments?episode_id=${episodeId}`);
      if (res.ok) {
        const data = await res.json();
        setComments(Array.isArray(data) ? data : []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [episodeId]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || submitting) return;

    setSubmitting(true);
    setError("");

    try {
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          episode_id: episodeId,
          comment: newComment.trim(),
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setNewComment("");
        await fetchComments();
      } else {
        setError(data.error || "Failed to post comment");
      }
    } catch {
      setError("Network error while posting comment");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (commentId: number) => {
    if (!confirm("Are you sure you want to delete this comment?")) return;

    try {
      const res = await fetch(`/api/comments?id=${commentId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setComments((prev) => prev.filter((c) => c.id !== commentId));
      }
    } catch {
      alert("Failed to delete comment");
    }
  };

  const formatTime = (dateStr: string) => {
    try {
      const date = new Date(dateStr.replace(" ", "T") + "Z");
      const now = new Date();
      const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);

      if (diffSec < 60) return "just now";
      if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
      if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
      if (diffSec < 604800) return `${Math.floor(diffSec / 86400)}d ago`;
      return date.toLocaleDateString();
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="bg-[#141519] p-5 sm:p-6 rounded-xl border border-white/5 shadow-xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-white/5">
        <h3 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
          <MessageSquare size={18} className="text-[#ff640a]" />
          Episode Discussion
          <span className="text-xs bg-[#ff640a]/10 text-[#ff640a] font-bold px-2 py-0.5 rounded-full border border-[#ff640a]/20">
            {comments.length}
          </span>
        </h3>
        <span className="text-xs text-gray-500">Keep it friendly & spoiler-free!</span>
      </div>

      {/* New Comment Input Box */}
      {user ? (
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-[#ff640a] text-white font-black text-xs flex items-center justify-center shrink-0 uppercase shadow-md">
              {user.username.charAt(0)}
            </div>
            <div className="flex-1 space-y-2">
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                maxLength={500}
                placeholder="Write a comment... (share your reactions, theories!)"
                rows={3}
                className="w-full bg-[#1e1e24] border border-white/10 focus:border-[#ff640a] rounded-xl p-3 text-sm text-white placeholder-gray-500 outline-none transition-colors resize-none"
              />
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-gray-500">
                  {newComment.length}/500 characters
                </span>
                <button
                  type="submit"
                  disabled={submitting || !newComment.trim()}
                  className="inline-flex items-center gap-1.5 bg-[#ff640a] hover:bg-[#e05300] disabled:opacity-40 disabled:hover:bg-[#ff640a] text-white text-xs font-bold px-4 py-2 rounded-lg transition-all shadow-md shadow-[#ff640a]/20"
                >
                  {submitting ? (
                    <>
                      <Loader2 size={13} className="animate-spin" /> Posting...
                    </>
                  ) : (
                    <>
                      <Send size={13} /> Post Comment
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
          {error && <p className="text-xs text-red-400 pl-11">{error}</p>}
        </form>
      ) : (
        <div className="bg-[#1e1e24]/60 border border-white/5 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center text-gray-400">
              <User size={18} />
            </div>
            <div>
              <p className="text-sm font-bold text-white">Join the Conversation</p>
              <p className="text-xs text-gray-400">Log in to post comments and discuss this episode.</p>
            </div>
          </div>
          <Link
            href="/login"
            className="bg-[#ff640a] hover:bg-[#e05300] text-white text-xs font-bold px-4 py-2 rounded-lg transition-colors whitespace-nowrap shadow-md"
          >
            Sign In / Register
          </Link>
        </div>
      )}

      {/* Comments List */}
      <div className="space-y-3.5 pt-2">
        {loading ? (
          <div className="text-center py-8 text-gray-500 text-xs flex items-center justify-center gap-2">
            <Loader2 size={14} className="animate-spin text-[#ff640a]" /> Loading comments...
          </div>
        ) : comments.length === 0 ? (
          <div className="text-center py-8 text-gray-500 text-xs space-y-1">
            <p className="text-sm font-semibold text-gray-400">No comments yet</p>
            <p>Be the first to share your reaction on this episode!</p>
          </div>
        ) : (
          comments.map((c) => (
            <div
              key={c.id}
              className="flex gap-3 bg-[#1e1e24]/40 hover:bg-[#1e1e24]/70 p-3.5 rounded-xl border border-white/5 transition-colors group"
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#ff640a] to-amber-600 text-white font-black text-xs flex items-center justify-center shrink-0 uppercase shadow">
                {c.username ? c.username.charAt(0) : "U"}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white truncate">{c.username}</span>
                    <span className="text-[10px] text-gray-500 font-medium">
                      {formatTime(c.created_at)}
                    </span>
                  </div>
                  {user && user.id === c.user_id && (
                    <button
                      onClick={() => handleDelete(c.id)}
                      title="Delete comment"
                      className="text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all p-1"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
                <p className="text-xs sm:text-sm text-gray-300 mt-1 whitespace-pre-wrap break-words leading-relaxed">
                  {c.comment}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
