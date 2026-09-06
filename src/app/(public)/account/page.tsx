"use client";

import { useState, useEffect, Suspense } from "react";
import { useAuth } from "@/context/AuthContext";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  User,
  Download,
  Bookmark,
  History,
  ShieldCheck,
  Play,
  RotateCcw,
  LogOut,
  ArrowRight,
  Loader2,
  Film,
  Sparkles,
  ExternalLink,
  CheckCircle2,
  Crown,
  Lock,
} from "lucide-react";
import AnimeCard from "@/components/AnimeCard";

interface DownloadItem {
  id: number;
  quality: string;
  download_url: string;
  file_size?: string;
  episode_id: number;
  episode_number: number;
  episode_title?: string;
  season_number: number;
  anime_id: number;
  anime_title: string;
  anime_slug: string;
  anime_poster?: string;
  anime_type?: string;
}

interface HistoryItem {
  id: number;
  anime_id: number;
  episode_id: number;
  progress_seconds: number;
  duration_seconds: number;
  updated_at: string;
  anime_title: string;
  anime_slug: string;
  anime_poster?: string;
  anime_type?: string;
  episode_number: number;
  episode_title?: string;
  season_number: number;
}

function formatTime(secs: number): string {
  if (!secs || isNaN(secs)) return "0:00";
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s < 10 ? `0${s}` : s}`;
}

function AccountContent() {
  const { user, token, isLoading, logout } = useAuth();
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab") || "history";

  const [activeTab, setActiveTab] = useState<"downloads" | "history" | "watchlist">(
    initialTab as any
  );

  const [downloads, setDownloads] = useState<DownloadItem[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [bookmarks, setBookmarks] = useState<any[]>([]);

  const [loadingData, setLoadingData] = useState(true);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [isVip, setIsVip] = useState(false);
  const [vipError, setVipError] = useState('');

  useEffect(() => {
    const tabParam = searchParams.get("tab");
    if (tabParam && ["downloads", "history", "watchlist"].includes(tabParam)) {
      setActiveTab(tabParam as any);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!user) {
      setLoadingData(false);
      return;
    }

    setLoadingData(true);
    const authHeaders: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};

    Promise.all([
      fetch("/api/downloads", { headers: authHeaders })
        .then((r) => {
          if (r.status === 403) {
            setVipError('vip_required');
            setIsVip(false);
            return { downloads: [] };
          }
          setIsVip(true);
          return r.json();
        })
        .then((d) => setDownloads(Array.isArray(d.downloads) ? d.downloads : []))
        .catch(() => {}),
      fetch("/api/history?limit=30", { headers: authHeaders })
        .then((r) => r.json())
        .then((d) => setHistory(Array.isArray(d.history) ? d.history : []))
        .catch(() => {}),
      fetch("/api/bookmarks", { headers: authHeaders })
        .then((r) => r.json())
        .then((d) => setBookmarks(Array.isArray(d) ? d : []))
        .catch(() => {}),
    ]).finally(() => setLoadingData(false));
  }, [user, token]);

  const handleDownloadClick = (id: number) => {
    setDownloadingId(id);
    setTimeout(() => setDownloadingId(null), 3000);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#000000] flex items-center justify-center">
        <div className="text-center space-y-3">
          <Loader2 size={32} className="animate-spin text-[#ff640a] mx-auto" />
          <p className="text-xs text-gray-400">Loading your member account...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#000000] pt-12 pb-24 px-4">
        <div className="max-w-md mx-auto bg-[#141519] border border-white/10 rounded-2xl p-8 text-center space-y-5 shadow-2xl">
          <div className="w-16 h-16 rounded-2xl bg-[#ff640a]/10 text-[#ff640a] border border-[#ff640a]/20 flex items-center justify-center mx-auto shadow-xl">
            <User size={30} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white">Member Account Required</h1>
            <p className="text-xs text-gray-400 mt-1 leading-relaxed">
              Sign in to your AnimeZone account to access your high-speed video downloads, watch history, and saved watchlist.
            </p>
          </div>
          <div className="flex gap-3 justify-center pt-2">
            <Link
              href="/login?redirect=/account"
              className="inline-flex items-center gap-2 bg-[#ff640a] hover:bg-[#e05300] text-white px-6 py-2.5 rounded-xl font-bold text-xs transition-all shadow-lg shadow-[#ff640a]/20"
            >
              <span>Sign In</span>
              <ArrowRight size={14} />
            </Link>
            <Link
              href="/signup?redirect=/account"
              className="inline-flex items-center gap-2 bg-[#1e1e24] hover:bg-[#282830] text-white px-6 py-2.5 rounded-xl font-bold text-xs transition-all border border-white/10"
            >
              Create Account
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#000000] pt-6 pb-24">
      <div className="container mx-auto px-4 space-y-6">
        {/* User Profile Banner */}
        <div className="bg-[#141519] border border-white/5 rounded-2xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-80 h-80 bg-[#ff640a]/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 relative z-10">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-[#ff640a] to-[#ff3b00] text-white flex items-center justify-center font-black text-2xl sm:text-3xl shadow-xl shadow-[#ff640a]/20 shrink-0">
                {user.username.charAt(0).toUpperCase()}
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-2xl sm:text-3xl font-black text-white">
                    {user.username}
                  </h1>
                  <span className="inline-flex items-center gap-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[11px] font-bold px-2.5 py-0.5 rounded-full">
                    <ShieldCheck size={13} /> Verified Member
                  </span>
                  {isVip && (
                    <span className="inline-flex items-center gap-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[11px] font-bold px-2.5 py-0.5 rounded-full">
                      <Crown size={13} /> VIP Member
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-400">{user.email}</p>
              </div>
            </div>

            {/* Quick Stats & Logout */}
            <div className="flex items-center gap-3 self-stretch sm:self-auto justify-between sm:justify-end border-t sm:border-t-0 border-white/5 pt-4 sm:pt-0">
              <div className="text-center px-3 sm:px-4 py-2 bg-[#1e1e24] rounded-xl border border-white/5">
                <div className="text-base sm:text-lg font-black text-white">{history.length}</div>
                <div className="text-[10px] text-gray-400 uppercase font-bold">Watching</div>
              </div>
              <div className="text-center px-3 sm:px-4 py-2 bg-[#1e1e24] rounded-xl border border-white/5">
                <div className="text-base sm:text-lg font-black text-white">{bookmarks.length}</div>
                <div className="text-[10px] text-gray-400 uppercase font-bold">Watchlist</div>
              </div>
              {isVip && (
                <div className="text-center px-3 sm:px-4 py-2 bg-[#1e1e24] rounded-xl border border-amber-500/20">
                  <div className="text-base sm:text-lg font-black text-amber-400">{downloads.length}</div>
                  <div className="text-[10px] text-amber-400/70 uppercase font-bold">VIP Downloads</div>
                </div>
              )}
              <button
                onClick={logout}
                title="Log out of your account"
                className="flex items-center gap-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-colors"
              >
                <LogOut size={14} />
                <span className="hidden sm:inline">Log Out</span>
              </button>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 border-b border-white/10 pb-3 overflow-x-auto">
          <button
            onClick={() => setActiveTab("history")}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all shrink-0 ${
              activeTab === "history"
                ? "bg-[#ff640a] text-white shadow-lg shadow-[#ff640a]/20"
                : "bg-[#141519] text-gray-400 hover:text-white hover:bg-[#1e1e24]"
            }`}
          >
            <History size={16} />
            <span>Continue Watching</span>
            {history.length > 0 && (
              <span className="bg-black/30 text-white text-[10px] px-1.5 py-0.5 rounded-md font-mono">
                {history.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("watchlist")}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all shrink-0 ${
              activeTab === "watchlist"
                ? "bg-[#ff640a] text-white shadow-lg shadow-[#ff640a]/20"
                : "bg-[#141519] text-gray-400 hover:text-white hover:bg-[#1e1e24]"
            }`}
          >
            <Bookmark size={16} />
            <span>My Watchlist</span>
            {bookmarks.length > 0 && (
              <span className="bg-black/30 text-white text-[10px] px-1.5 py-0.5 rounded-md font-mono">
                {bookmarks.length}
              </span>
            )}
          </button>

          {isVip && (
            <button
              onClick={() => setActiveTab("downloads")}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all shrink-0 ${
                activeTab === "downloads"
                  ? "bg-amber-600 text-white shadow-lg shadow-amber-600/20"
                  : "bg-[#141519] text-amber-400 hover:text-white hover:bg-[#1e1e24]"
              }`}
            >
              <Crown size={16} className="text-amber-300" />
              <span>VIP Downloads</span>
              {downloads.length > 0 && (
                <span className="bg-black/30 text-white text-[10px] px-1.5 py-0.5 rounded-md font-mono">
                  {downloads.length}
                </span>
              )}
            </button>
          )}
        </div>

        {/* Tab Content */}
        {loadingData ? (
          <div className="py-20 text-center text-gray-400 space-y-2">
            <Loader2 size={24} className="animate-spin text-[#ff640a] mx-auto" />
            <p className="text-xs">Loading {activeTab} data...</p>
          </div>
        ) : activeTab === "downloads" ? (
          /* TAB 1: DOWNLOADS */
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-black text-white flex items-center gap-2">
                  <Download size={18} className="text-emerald-400" />
                  <span>Available Episode Downloads</span>
                  {isVip && (
                    <span className="inline-flex items-center gap-1 bg-amber-500/10 text-amber-400 text-[10px] font-bold px-2 py-0.5 rounded-full">
                      <Crown size={10} /> VIP
                    </span>
                  )}
                </h2>
                <p className="text-xs text-gray-400">
                  {isVip
                    ? 'Direct high-speed downloads unlocked for your VIP account.'
                    : 'Upgrade to VIP to unlock direct downloads.'}
                </p>
              </div>
            </div>

            {!isVip ? (
              /* VIP Upgrade Banner */
              <div className="bg-gradient-to-br from-amber-500/5 to-orange-500/5 border border-amber-500/20 rounded-2xl p-8 text-center space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center mx-auto">
                  <Crown size={30} />
                </div>
                <h3 className="text-xl font-black text-white">VIP Members Only</h3>
                <p className="text-sm text-gray-400 max-w-md mx-auto leading-relaxed">
                  Downloads are exclusively available for VIP members. Contact the admin to upgrade your account to VIP and unlock high-speed direct downloads for all episodes.
                </p>
                <div className="flex items-center justify-center gap-3 pt-2">
                  <div className="flex items-center gap-2 bg-[#1e1e24] border border-white/10 rounded-xl px-4 py-2.5">
                    <Lock size={14} className="text-amber-400" />
                    <span className="text-xs text-gray-300 font-medium">Request VIP access from admin</span>
                  </div>
                </div>
              </div>
            ) : downloads.length === 0 ? (
              <div className="bg-[#141519] border border-white/5 rounded-2xl p-12 text-center space-y-3">
                <div className="w-14 h-14 rounded-2xl bg-white/5 text-gray-500 flex items-center justify-center mx-auto">
                  <Download size={26} />
                </div>
                <h3 className="text-base font-bold text-white">No Downloads Added Yet</h3>
                <p className="text-xs text-gray-400 max-w-sm mx-auto">
                  The admin has not published download links yet. Check back soon or stream directly in HD!
                </p>
                <Link
                  href="/"
                  className="inline-flex items-center gap-1.5 bg-[#ff640a] hover:bg-[#e05300] text-white text-xs font-bold px-4 py-2 rounded-xl transition-all shadow"
                >
                  Browse Anime <ArrowRight size={13} />
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {downloads.map((dl) => {
                  const isDownloading = downloadingId === dl.id;
                  return (
                    <div
                      key={dl.id}
                      className="bg-[#141519] border border-white/5 hover:border-emerald-500/30 rounded-xl p-4 transition-all shadow-xl flex flex-col justify-between gap-4 group"
                    >
                      <div className="flex items-start gap-3.5">
                        <div className="w-16 h-20 rounded-lg overflow-hidden bg-black shrink-0 relative">
                          {dl.anime_poster ? (
                            <img
                              src={dl.anime_poster}
                              alt={dl.anime_title}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-600">
                              <Film size={20} />
                            </div>
                          )}
                          <span className="absolute bottom-1 right-1 bg-black/80 text-emerald-400 font-black text-[9px] px-1 py-0.2 rounded font-mono">
                            {dl.quality.includes("1080") ? "1080p" : dl.quality.includes("720") ? "720p" : "SD"}
                          </span>
                        </div>
                        <div className="space-y-1 flex-1 min-w-0">
                          <span className="text-[10px] text-[#ff640a] font-bold uppercase tracking-wider block truncate">
                            {dl.anime_title}
                          </span>
                          <h4 className="text-sm font-bold text-white truncate">
                            S{dl.season_number} Ep {dl.episode_number}: {dl.episode_title || `Episode ${dl.episode_number}`}
                          </h4>
                          <div className="flex items-center gap-2 pt-0.5">
                            <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold px-2 py-0.5 rounded">
                              {dl.quality}
                            </span>
                            {dl.file_size && (
                              <span className="text-[10px] text-gray-400 font-mono">
                                {dl.file_size}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-2 border-t border-white/5">
                        <a
                          href={dl.download_url}
                          download={`${(dl.anime_title || 'Anime').replace(/[^a-zA-Z0-9_-]/g, '_')}_S${dl.season_number}E${dl.episode_number}_${(dl.quality || 'HD').replace(/[^a-zA-Z0-9_-]/g, '_')}.${dl.download_url.match(/\.(mp4|webm|mkv|mov|avi)(\?|$)/i)?.[1] || 'mp4'}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => handleDownloadClick(dl.id)}
                          className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-all shadow-md shadow-emerald-600/20"
                        >
                          {isDownloading ? (
                            <>
                              <CheckCircle2 size={13} className="text-white animate-bounce" />
                              <span>Starting...</span>
                            </>
                          ) : (
                            <>
                              <Download size={13} />
                              <span>Download Video</span>
                            </>
                          )}
                        </a>
                        <Link
                          href={`/watch/${dl.anime_slug}/${dl.season_number}x${dl.episode_number}`}
                          className="bg-[#1e1e24] hover:bg-[#282830] text-gray-300 hover:text-white p-2 rounded-lg transition-colors"
                          title="Watch Episode"
                        >
                          <Play size={14} />
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : activeTab === "history" ? (
          /* TAB 2: CONTINUE WATCHING & RESUME / RESTART */
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-black text-white flex items-center gap-2">
                <History size={18} className="text-[#ff640a]" />
                <span>Continue Watching</span>
              </h2>
              <p className="text-xs text-gray-400">
                Pick up right where you left off or restart from the beginning.
              </p>
            </div>

            {history.length === 0 ? (
              <div className="bg-[#141519] border border-white/5 rounded-2xl p-12 text-center space-y-3">
                <div className="w-14 h-14 rounded-2xl bg-white/5 text-gray-500 flex items-center justify-center mx-auto text-2xl">
                  🍿
                </div>
                <h3 className="text-base font-bold text-white">No Watch History Yet</h3>
                <p className="text-xs text-gray-400 max-w-sm mx-auto">
                  As you stream episodes, your progress will be saved here automatically with instant Resume options!
                </p>
                <Link
                  href="/"
                  className="inline-flex items-center gap-1.5 bg-[#ff640a] hover:bg-[#e05300] text-white text-xs font-bold px-4 py-2 rounded-xl transition-all shadow"
                >
                  Start Watching <ArrowRight size={13} />
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {history.map((item) => {
                  const pct =
                    item.duration_seconds > 0
                      ? Math.min(100, Math.round((item.progress_seconds / item.duration_seconds) * 100))
                      : 0;
                  return (
                    <div
                      key={item.id}
                      className="bg-[#141519] border border-white/5 rounded-xl p-4 shadow-xl flex flex-col justify-between gap-3 group hover:border-[#ff640a]/30 transition-all"
                    >
                      <div className="flex items-start gap-3.5">
                        <div className="w-16 h-20 rounded-lg overflow-hidden bg-black shrink-0 relative">
                          {item.anime_poster ? (
                            <img
                              src={item.anime_poster}
                              alt={item.anime_title}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-600">
                              <Film size={20} />
                            </div>
                          )}
                        </div>
                        <div className="space-y-1 flex-1 min-w-0">
                          <span className="text-[10px] text-[#ff640a] font-bold uppercase tracking-wider block truncate">
                            {item.anime_title}
                          </span>
                          <h4 className="text-sm font-bold text-white truncate">
                            S{item.season_number} Ep {item.episode_number}: {item.episode_title || `Episode ${item.episode_number}`}
                          </h4>
                          <div className="pt-1">
                            <div className="flex items-center justify-between text-[10px] text-gray-400 font-mono mb-1">
                              <span>Left off: {formatTime(item.progress_seconds)}</span>
                              <span>{pct}%</span>
                            </div>
                            <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-[#ff640a] rounded-full"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Action buttons: Resume vs Restart */}
                      <div className="flex items-center gap-2 pt-2 border-t border-white/5">
                        <Link
                          href={`/watch/${item.anime_slug}/${item.season_number}x${item.episode_number}`}
                          className="flex-1 bg-[#ff640a] hover:bg-[#e05300] text-white text-xs font-bold py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-all shadow-md shadow-[#ff640a]/20"
                        >
                          <Play size={13} className="fill-white" />
                          <span>Resume ({formatTime(item.progress_seconds)})</span>
                        </Link>
                        <Link
                          href={`/watch/${item.anime_slug}/${item.season_number}x${item.episode_number}?restart=1`}
                          className="bg-[#1e1e24] hover:bg-[#282830] text-gray-300 hover:text-white border border-white/10 text-xs font-bold py-2 px-3 rounded-lg flex items-center gap-1 transition-colors"
                          title="Restart from beginning"
                        >
                          <RotateCcw size={13} />
                          <span className="hidden sm:inline">Restart</span>
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          /* TAB 3: WATCHLIST */
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-black text-white flex items-center gap-2">
                <Bookmark size={18} className="text-[#ff640a]" />
                <span>Saved Watchlist</span>
              </h2>
              <p className="text-xs text-gray-400">
                Anime and movies you have saved for later.
              </p>
            </div>

            {bookmarks.length === 0 ? (
              <div className="bg-[#141519] border border-white/5 rounded-2xl p-12 text-center space-y-3">
                <div className="w-14 h-14 rounded-2xl bg-white/5 text-gray-500 flex items-center justify-center mx-auto text-2xl">
                  🔖
                </div>
                <h3 className="text-base font-bold text-white">Your Watchlist is Empty</h3>
                <p className="text-xs text-gray-400 max-w-sm mx-auto">
                  Browse series and tap the Bookmark icon to save anime to your queue.
                </p>
                <Link
                  href="/"
                  className="inline-flex items-center gap-1.5 bg-[#ff640a] hover:bg-[#e05300] text-white text-xs font-bold px-4 py-2 rounded-xl transition-all shadow"
                >
                  Explore Trending <ArrowRight size={13} />
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {bookmarks.map((anime) => (
                  <AnimeCard key={anime.id} anime={anime} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function AccountPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-black flex items-center justify-center">
          <Loader2 size={32} className="animate-spin text-[#ff640a]" />
        </div>
      }
    >
      <AccountContent />
    </Suspense>
  );
}
