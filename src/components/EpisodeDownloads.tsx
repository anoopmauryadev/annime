"use client";

import { useAuth } from "@/context/AuthContext";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Download, Lock, ArrowRight, ShieldCheck, Loader2, Sparkles, CheckCircle2, Crown } from "lucide-react";
import { useState, useEffect } from "react";

interface DownloadLink {
  id: number;
  quality: string;
  download_url: string;
  file_size?: string;
}

interface EpisodeDownloadsProps {
  downloads: DownloadLink[];
  servers?: any[];
  episodeTitle?: string;
}

export default function EpisodeDownloads({
  downloads = [],
  servers = [],
  episodeTitle,
}: EpisodeDownloadsProps) {
  const { user, token, isLoading } = useAuth();
  const pathname = usePathname();
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [isVip, setIsVip] = useState(false);
  const [checkingVip, setCheckingVip] = useState(false);

  // Check VIP status when user is logged in
  useEffect(() => {
    if (!user || !token) {
      setIsVip(false);
      return;
    }

    if (user.is_vip !== undefined) {
      setIsVip(user.is_vip === 1);
      return;
    }

    setCheckingVip(true);
    fetch("/api/auth/me", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        setIsVip(data?.user?.is_vip === 1);
      })
      .catch(() => setIsVip(false))
      .finally(() => setCheckingVip(false));
  }, [user, token]);

  // Only build effective downloads for VIP users
  const effectiveDownloads = isVip ? [...downloads] : [];
  if (isVip && effectiveDownloads.length === 0 && servers && servers.length > 0) {
    servers.forEach((s, idx) => {
      const url = s.stream_url || "";
      // ONLY allow real video files (.mp4, .webm, .mkv, .mov, .avi)
      // NEVER allow .m3u8 playlists, /hls/ streams, or iframe embeds
      const isRealVideoFile = /\.(mp4|webm|mkv|mov|avi)(\?|$)/i.test(url);
      const isPlaylistOrEmbed = url.includes("/hls/") || url.endsWith(".m3u8") || url.endsWith(".ts") || s.server_type === "embed";

      if (isRealVideoFile && !isPlaylistOrEmbed) {
        effectiveDownloads.push({
          id: 9999 + idx,
          quality: "Original HD (" + s.server_name + ")",
          download_url: s.stream_url,
          file_size: "Direct Video",
        });
      }
    });
  }

  const cleanDownloadName = (quality: string, url: string) => {
    const extMatch = url.match(/\.(mp4|webm|mkv|mov|avi)(\?|$)/i);
    const ext = extMatch ? extMatch[1].toLowerCase() : "mp4";
    const base = episodeTitle ? episodeTitle.replace(/[^a-zA-Z0-9_-]/g, "_") : "Episode";
    const q = quality.replace(/[^a-zA-Z0-9_-]/g, "_");
    return `${base}_${q}.${ext}`;
  };

  const handleDownloadClick = (id: number) => {
    setDownloadingId(id);
    setTimeout(() => {
      setDownloadingId(null);
    }, 3000);
  };

  return (
    <div
      id="episode-downloads"
      className="bg-[#141519] p-5 rounded-xl border border-white/5 shadow-xl space-y-4 scroll-mt-20"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-base font-black text-white flex items-center gap-2">
          <Download size={18} className="text-emerald-400" />
          <span>Download Episode</span>
        </h3>
        {user && isVip ? (
          <span className="text-[11px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2.5 py-1 rounded-full font-bold flex items-center gap-1">
            <Crown size={12} /> VIP Access
          </span>
        ) : user ? (
          <span className="text-[11px] bg-slate-500/10 text-slate-400 border border-slate-500/20 px-2.5 py-1 rounded-full font-bold flex items-center gap-1">
            <Lock size={11} /> VIP Only
          </span>
        ) : (
          <span className="text-[11px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2.5 py-1 rounded-full font-bold flex items-center gap-1">
            <Lock size={11} /> Login Required
          </span>
        )}
      </div>

      {isLoading || checkingVip ? (
        <div className="py-4 text-center text-xs text-gray-400 flex items-center justify-center gap-2">
          <Loader2 size={14} className="animate-spin text-emerald-400" />
          <span>Checking download privileges...</span>
        </div>
      ) : !user ? (
        /* Not logged in */
        <div className="bg-[#1e1e24]/80 border border-emerald-500/20 rounded-xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center shrink-0">
              <Lock size={20} />
            </div>
            <div>
              <p className="text-sm font-bold text-white flex items-center gap-1.5 justify-center sm:justify-start">
                <span>Downloads Reserved for VIP Members</span>
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                Sign in and upgrade to VIP to unlock high-speed direct downloads.
              </p>
            </div>
          </div>
          <Link
            href={`/login?redirect=${encodeURIComponent(pathname)}`}
            className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-5 py-2.5 rounded-lg transition-all shadow-md shadow-emerald-600/20 shrink-0 hover:scale-105"
          >
            <span>Sign In</span>
            <ArrowRight size={14} />
          </Link>
        </div>
      ) : !isVip ? (
        /* Logged in but NOT VIP */
        <div className="bg-gradient-to-br from-amber-500/5 to-orange-500/5 border border-amber-500/20 rounded-xl p-5 text-center space-y-3">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center mx-auto">
            <Crown size={24} />
          </div>
          <p className="text-sm font-bold text-white">VIP Membership Required</p>
          <p className="text-xs text-gray-400 max-w-sm mx-auto">
            Downloads are exclusively available for VIP members. Contact admin to upgrade your account.
          </p>
        </div>
      ) : effectiveDownloads.length > 0 ? (
        /* VIP user with downloads available */
        <div className="space-y-3">
          <p className="text-xs text-gray-400">
            Select your preferred resolution to download directly to your device:
          </p>
          <div className="flex flex-wrap gap-2.5">
            {effectiveDownloads.map((dl) => {
              const isDownloading = downloadingId === dl.id;
              return (
                <a
                  key={dl.id}
                  href={dl.download_url}
                  download={cleanDownloadName(dl.quality, dl.download_url)}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => handleDownloadClick(dl.id)}
                  className="flex items-center gap-2.5 bg-[#1e1e24] hover:bg-emerald-600/20 border border-white/10 hover:border-emerald-500/50 text-white rounded-lg px-4 py-2.5 transition-all group shadow-md"
                >
                  {isDownloading ? (
                    <CheckCircle2 size={15} className="text-emerald-400 animate-bounce" />
                  ) : (
                    <Download
                      size={15}
                      className="text-emerald-400 group-hover:scale-110 transition-transform"
                    />
                  )}
                  <div className="text-left">
                    <span className="font-bold text-xs block">{dl.quality}</span>
                    {dl.file_size && (
                      <span className="text-[10px] text-gray-400 block -mt-0.5">
                        {dl.file_size}
                      </span>
                    )}
                  </div>
                </a>
              );
            })}
          </div>
        </div>
      ) : (
        /* VIP user, but no downloads available for this episode */
        <div className="bg-[#1e1e24]/40 border border-white/5 rounded-xl p-4 text-center space-y-1">
          <p className="text-xs font-semibold text-gray-300">
            No direct downloads added for this episode yet.
          </p>
          <p className="text-[11px] text-gray-500">
            Downloads for this episode will be added by the admin shortly. You can still stream in HD!
          </p>
        </div>
      )}
    </div>
  );
}
