"use client";

import { useState } from "react";
import { AlertTriangle, X, CheckCircle, Loader2 } from "lucide-react";

interface ReportModalProps {
  episodeId: number;
  servers: Array<{ id: number; server_name: string }>;
  isOpen: boolean;
  onClose: () => void;
}

const ISSUE_OPTIONS = [
  { value: "video_not_playing", label: "Video is not playing / Black screen" },
  { value: "buffering", label: "Constant buffering / Very slow load" },
  { value: "audio_issue", label: "Audio is out of sync or missing" },
  { value: "subtitle_issue", label: "Subtitles are missing or wrong" },
  { value: "wrong_episode", label: "Wrong episode or incorrect title" },
  { value: "other", label: "Other issue" },
];

export default function ReportModal({ episodeId, servers, isOpen, onClose }: ReportModalProps) {
  const [issueType, setIssueType] = useState(ISSUE_OPTIONS[0].value);
  const [serverId, setServerId] = useState<string>(servers.length > 0 ? String(servers[0].id) : "");
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          episode_id: episodeId,
          server_id: serverId ? parseInt(serverId) : null,
          issue_type: issueType,
          details: details.trim(),
        }),
      });

      if (res.ok) {
        setSubmitted(true);
        setTimeout(() => {
          setSubmitted(false);
          setDetails("");
          onClose();
        }, 2000);
      } else {
        const data = await res.json();
        setError(data.error || "Failed to submit report");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-[#141519] border border-white/10 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4 relative">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white p-1 rounded-lg hover:bg-white/5 transition-colors"
        >
          <X size={18} />
        </button>

        {submitted ? (
          <div className="py-8 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto">
              <CheckCircle size={24} />
            </div>
            <h4 className="text-lg font-bold text-white">Report Submitted!</h4>
            <p className="text-xs text-gray-400">
              Shukriya! Humare team jald se jald is issue ko fix karegi.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex items-center gap-2 text-white">
              <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
                <AlertTriangle size={20} />
              </div>
              <div>
                <h3 className="font-bold text-base">Report an Issue</h3>
                <p className="text-xs text-gray-400">Help us fix broken videos quickly</p>
              </div>
            </div>

            {/* Issue selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-300">What is the problem?</label>
              <select
                value={issueType}
                onChange={(e) => setIssueType(e.target.value)}
                className="w-full bg-[#1e1e24] border border-white/10 rounded-xl p-2.5 text-xs text-white outline-none focus:border-[#ff640a]"
              >
                {ISSUE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Server selector (if multiple) */}
            {servers.length > 0 && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-300">Which server failed?</label>
                <select
                  value={serverId}
                  onChange={(e) => setServerId(e.target.value)}
                  className="w-full bg-[#1e1e24] border border-white/10 rounded-xl p-2.5 text-xs text-white outline-none focus:border-[#ff640a]"
                >
                  <option value="">All / Don&apos;t know</option>
                  {servers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.server_name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Notes textarea */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-300">
                Additional Details (Optional)
              </label>
              <textarea
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                rows={3}
                placeholder="e.g. Video stopped at 12:45, or audio is Hindi but subtitles are Japanese..."
                className="w-full bg-[#1e1e24] border border-white/10 rounded-xl p-3 text-xs text-white placeholder-gray-500 outline-none focus:border-[#ff640a] resize-none"
              />
            </div>

            {error && <p className="text-xs text-red-400">{error}</p>}

            <div className="flex gap-2 justify-end pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-white/5 hover:bg-white/10 text-gray-300 rounded-xl text-xs font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center gap-1.5 bg-[#ff640a] hover:bg-[#e05300] disabled:opacity-50 text-white rounded-xl text-xs font-bold px-4 py-2 transition-all shadow-md shadow-[#ff640a]/20"
              >
                {submitting ? (
                  <>
                    <Loader2 size={13} className="animate-spin" /> Submitting...
                  </>
                ) : (
                  "Submit Report"
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
