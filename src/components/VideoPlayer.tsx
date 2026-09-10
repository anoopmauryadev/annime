"use client";

import { useState, useEffect, useRef } from "react";
import {
  MonitorPlay,
  Play,
  Settings,
  Check,
  Lock,
  ArrowRight,
  ShieldCheck,
  Loader2,
  Sparkles,
  RotateCcw,
  FastForward,
  Download,
  X,
  Key,
  Clock,
  ExternalLink,
} from "lucide-react";
import Hls from "hls.js";
import BrandIntro, { BRAND_INTRO_DURATION } from "./BrandIntro";
import { useAuth } from "@/context/AuthContext";
import { usePathname } from "next/navigation";
import Link from "next/link";
import PlayerControls from "./PlayerControls";
import PlaybackAnalytics from "./PlaybackAnalytics";

interface QualityLevel {
  index: number;
  height: number;
  name: string;
  bitrate?: number;
}

interface VideoPlayerProps {
  servers: any[];
  animeId?: number;
  episodeId?: number;
  title?: string;
  nextEpisodeUrl?: string;
}

function formatTime(secs: number): string {
  if (isNaN(secs) || secs < 0) return "0:00";
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  const h = Math.floor(m / 60);
  const remM = m % 60;
  const sStr = s < 10 ? `0${s}` : `${s}`;
  if (h > 0) {
    const mStr = remM < 10 ? `0${remM}` : `${remM}`;
    return `${h}:${mStr}:${sStr}`;
  }
  return `${m}:${sStr}`;
}

export default function VideoPlayer(props: VideoPlayerProps) {
  // A new episode gets its own intro and playback history state, even on client navigation.
  const identity = `${props.animeId ?? ""}:${props.episodeId ?? props.servers?.map((server) => server.stream_url).join("|")}`;
  return <EpisodeVideoPlayer key={identity} {...props} />;
}

function EpisodeVideoPlayer({ servers: initialServers, animeId, episodeId, title, nextEpisodeUrl }: VideoPlayerProps) {
  const { user, token, isLoading } = useAuth();
  const pathname = usePathname();
  const [servers,setServers] = useState(initialServers);
  const [loginRequired,setLoginRequired] = useState(true);
  const [originalEnabled,setOriginalEnabled] = useState(true);
  const [allow480,setAllow480] = useState(true);
  const [guestMode,setGuestMode] = useState('login');
  const switchPosition = useRef<number | null>(null);


  const [activeIdx, setActiveIdx] = useState(0);
  const [qualityLevels, setQualityLevels] = useState<QualityLevel[]>([]);
  const [nativeVariant,setNativeVariant] = useState('');
  const [currentLevel, setCurrentLevel] = useState<number>(-1); // -1 is Auto
  const [showQualityMenu, setShowQualityMenu] = useState(false);

  // Resume & Restart States
  const [savedProgress, setSavedProgress] = useState<{ time: number; duration: number } | null>(null);
  const [showResumeBanner, setShowResumeBanner] = useState(false);
  const [playbackToast, setPlaybackToast] = useState<string | null>(null);

  const [introPhase, setIntroPhase] = useState<"idle" | "playing" | "complete">("idle");
  const [introMediaUrl, setIntroMediaUrl] = useState<string | undefined>();
  const [introStarting, setIntroStarting] = useState(false);
  const introPassed = useRef(false);
  const [needsPlay, setNeedsPlay] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const lastSavedTime = useRef<number>(0);
  const [isVip, setIsVip] = useState(false);

  // 🔑 48-Hour Key & VIP Access State
  const [keyAccess, setKeyAccess] = useState<{
    isLoading: boolean;
    active: boolean;
    is_vip: boolean;
    remaining_hours: number;
    expires_at: string | null;
  }>({
    isLoading: true,
    active: false,
    is_vip: false,
    remaining_hours: 0,
    expires_at: null,
  });

  const [isGeneratingKey, setIsGeneratingKey] = useState(false);
  const [keyGenError, setKeyGenError] = useState<string | null>(null);
  const [showManualKeyInput, setShowManualKeyInput] = useState(false);
  const [manualKeyCode, setManualKeyCode] = useState("");
  const [manualKeySubmitting, setManualKeySubmitting] = useState(false);
  const [manualKeyError, setManualKeyError] = useState<string | null>(null);

  const fetchKeyStatus = async () => {
    try {
      const res = await fetch(`/api/keys/status${episodeId ? `?episode_id=${episodeId}` : ''}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        const active = !!data.active || !!data.is_vip || !!data.key_system_disabled;
        setKeyAccess({
          isLoading: false,
          active,
          is_vip: !!data.is_vip,
          remaining_hours: data.remaining_hours || 0,
          expires_at: data.expires_at || null,
        });
        setLoginRequired(data.login_required !== false);
        setOriginalEnabled(data.original_enabled !== false);
        setAllow480(data.allow_480p !== false);
        setGuestMode(data.guest_mode || 'login');
        setIsVip(!!data.is_vip);
      } else {
        setKeyAccess((prev) => ({ ...prev, isLoading: false }));
      }
    } catch {
      setKeyAccess((prev) => ({ ...prev, isLoading: false }));
    }
  };

  useEffect(() => {
    fetchKeyStatus();
  }, [user, token, episodeId]);

  const canPlay = !isLoading && !keyAccess.isLoading && keyAccess.active && (!loginRequired || !!user);
  useEffect(() => {
    if (!episodeId || !canPlay) { setServers([]); return; }
    let cancelled=false;
    const refresh=async()=>{
      try {
        const res=await fetch(`/api/episodes/${episodeId}`,{cache:'no-store'});
        if(res.ok) { const data=await res.json(); if(!cancelled) setServers(prev=>JSON.stringify(prev)===JSON.stringify(data.servers) ? prev : data.servers || []); }
      } catch {}
    };
    refresh();
    const timer=setInterval(refresh,10000);
    return ()=>{cancelled=true;clearInterval(timer);};
  },[episodeId,canPlay,isVip]);

  // Auto-refresh key status when user returns to this browser tab after completing shortener
  useEffect(() => {
    const handleFocus = () => {
      fetchKeyStatus();
    };
    window.addEventListener("focus", handleFocus);
    const timer = window.setInterval(handleFocus, 30000);
    return () => { window.removeEventListener("focus", handleFocus); window.clearInterval(timer); };
  }, [token, keyAccess.active, episodeId]);

  const handleGetKey = async () => {
    setIsGeneratingKey(true);
    setKeyGenError(null);
    try {
      const res = await fetch("/api/keys/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      const data = await res.json();
      if (res.ok && data.redirect_url) {
        sessionStorage.setItem("key_return_path", pathname || "/");
        window.location.assign(data.redirect_url);
        setPlaybackToast("⚡ Complete shortener task in the opened tab to activate your 48h key!");
        setTimeout(() => setPlaybackToast(null), 6000);
      } else if (data.status === "already_active") {
        setKeyAccess((prev) => ({ ...prev, active: true, remaining_hours: data.remaining_hours }));
        setPlaybackToast("Your 48-Hour pass is already active!");
        setTimeout(() => setPlaybackToast(null), 3000);
      } else {
        setKeyGenError(data.error || data.message || "Failed to generate key link.");
      }
    } catch (err: any) {
      setKeyGenError(err.message || "Network error generating key link.");
    } finally {
      setIsGeneratingKey(false);
    }
  };

  const handleManualKeySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = manualKeyCode.trim().toUpperCase();
    if (!clean) return;

    setManualKeySubmitting(true);
    setManualKeyError(null);

    try {
      const res = await fetch("/api/keys/redeem", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ key_code: clean }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setKeyAccess({
          isLoading: false,
          active: true,
          is_vip: false,
          remaining_hours: data.duration_hours || 48,
          expires_at: data.expires_at,
        });
        setPlaybackToast(`🎉 Key Activated! ${data.duration_hours || 48} Hours of unlimited access.`);
        setShowManualKeyInput(false);
        setManualKeyCode("");
        setTimeout(() => setPlaybackToast(null), 4000);
      } else {
        setManualKeyError(data.error || "Invalid key code.");
      }
    } catch (err: any) {
      setManualKeyError(err.message || "Network error redeeming key.");
    } finally {
      setManualKeySubmitting(false);
    }
  };

  // Fetch or read saved playback position on mount
  useEffect(() => {
    if (!episodeId) return;

    // Check if user clicked Restart
    const isRestart = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("restart") === "1";
    if (isRestart) {
      setPlaybackToast("Started from beginning (0:00)");
      setTimeout(() => setPlaybackToast(null), 3000);
      return;
    }

    let posTime = 0;
    let posDuration = 0;

    // Check localStorage first
    try {
      const local = localStorage.getItem(`watch_pos_${episodeId}`);
      if (local) {
        const parsed = JSON.parse(local);
        if (parsed.time && parsed.time > 10) {
          posTime = Number(parsed.time);
          posDuration = Number(parsed.duration || 0);
        }
      }
    } catch {}

    // Check backend API if user is logged in
    if (user && token) {
      fetch(`/api/history?episode_id=${episodeId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((res) => res.json())
        .then((data) => {
          if (data?.progress?.progress_seconds && data.progress.progress_seconds > posTime) {
            posTime = Number(data.progress.progress_seconds);
            posDuration = Number(data.progress.duration_seconds || posDuration);
          }
          if (posTime > 10) {
            setSavedProgress({ time: posTime, duration: posDuration });
            setShowResumeBanner(true);
          }
        })
        .catch(() => {
          if (posTime > 10) {
            setSavedProgress({ time: posTime, duration: posDuration });
            setShowResumeBanner(true);
          }
        });
    } else if (posTime > 10) {
      setSavedProgress({ time: posTime, duration: posDuration });
      setShowResumeBanner(true);
    }
  }, [episodeId, user, token]);

  const saveProgress = (currentTime: number, duration: number) => {
    if (!episodeId || !currentTime) return;

    // Save to localStorage
    try {
      localStorage.setItem(
        `watch_pos_${episodeId}`,
        JSON.stringify({ time: Math.floor(currentTime), duration: Math.floor(duration || 0) })
      );
    } catch {}

    // Save to backend database for logged-in users
    if (!animeId || !user || !token) return;
    fetch("/api/history", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        anime_id: animeId,
        episode_id: episodeId,
        progress_seconds: Math.floor(currentTime),
        duration_seconds: Math.floor(duration || 0),
      }),
    }).catch(() => {});
  };

  const requestPlayback = async () => {
    if (!canPlay || keyAccess.isLoading || introStarting || introPhase === "playing") return;
    if (!introPassed.current) {
      // Read again at Play so an intro uploaded in another admin tab takes effect.
      setIntroStarting(true);
      try {
        const res = await fetch("/api/admin/brand-intro", { cache: "no-store" });
        if (!res.ok) throw new Error("Intro settings unavailable");
        const data = await res.json();
        setIntroMediaUrl(data.url && data.url !== "/brand/anime-zone-intro-4k.mp4" ? data.url : undefined);
        if (data.enabled !== false) {
          setIntroPhase("playing");
          return;
        }
        introPassed.current = true;
        setIntroPhase("complete");
      } catch {
        setPlaybackToast("Could not load player settings. Please try Play again.");
        return;
      } finally {
        setIntroStarting(false);
      }
    }
    setNeedsPlay(false);
    videoRef.current?.play().catch(() => setNeedsPlay(true));
  };

  const handleResume = () => {
    if (videoRef.current && savedProgress) {
      videoRef.current.currentTime = savedProgress.time;
      requestPlayback();
      setPlaybackToast(`Resumed from ${formatTime(savedProgress.time)}`);
      setShowResumeBanner(false);
      setTimeout(() => setPlaybackToast(null), 3000);
    }
  };

  const handleStartOver = () => {
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      requestPlayback();
      setPlaybackToast("Restarted from beginning (0:00)");
      setShowResumeBanner(false);
      setTimeout(() => setPlaybackToast(null), 3000);
    }
  };

  const scrollToDownloads = () => {
    const el = document.getElementById("episode-downloads");
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  const server = servers && servers.length > 0 ? (servers[activeIdx] || servers[0]) : null;

  // Auto-extract URL if full <iframe src="..."> code is pasted
  const getEmbedSrc = (raw: string) => {
    if (!raw) return "";
    let url = raw.trim();

    if (url.includes("<iframe") || url.includes("src=")) {
      const match = url.match(/src=["']([^"']+)["']/i);
      if (match && match[1]) {
        url = match[1];
      }
    }

    if (url.startsWith("/")) return url;
    try {
      const parsed = new URL(url);
      return parsed.protocol === "https:" || (parsed.protocol === "http:" && process.env.NODE_ENV !== "production") ? parsed.href : "";
    } catch { return ""; }
  };

  const masterSrc = server ? getEmbedSrc(server.stream_url) : "";
  const embedSrc = nativeVariant || masterSrc;
  const isDirectVideo =
    embedSrc.endsWith(".mp4") ||
    embedSrc.endsWith(".webm") ||
    embedSrc.includes(".mp4?") ||
    embedSrc.includes("/uploads/videos/");
  const isHls = /\.m3u8(?:$|\?)/i.test(embedSrc);
  const isEmbed =
    !isHls &&
    (server?.server_type === "embed" ||
      (!isDirectVideo && (embedSrc.startsWith("http://") || embedSrc.startsWith("https://"))));

  // Keep the underlying video paused and embeds unmounted until the ident ends.
  // A timer also completes the intro when reduced-motion disables CSS animations.
  useEffect(() => {
    if (introPhase !== "playing" || !canPlay || introMediaUrl) return;
    const timer = window.setTimeout(() => {
      introPassed.current = true;
      setIntroPhase("complete");
      if (!isEmbed) {
        videoRef.current?.play().catch(() => setNeedsPlay(true));
      }
    }, BRAND_INTRO_DURATION);
    return () => window.clearTimeout(timer);
  }, [introPhase, canPlay, isEmbed, embedSrc, introMediaUrl]);

  // Initialize HLS when stream is .m3u8 and user has active pass
  useEffect(() => {
    if (!canPlay) return; // Do not initialize stream if not unlocked
    const video = videoRef.current;
    if (!video || isEmbed || !embedSrc) return;

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    if (isHls && Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        startLevel: 0,
      });
      hlsRef.current = hls;

      hls.loadSource(embedSrc);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, (_, data) => {
        const levels: QualityLevel[] = data.levels.map((lvl) => {
          let label = `${lvl.height}p`;
          if (lvl.height >= 1440) label = "2K (1440p)";
          else if (lvl.height >= 1080) label = "1080p Full HD";
          else if (lvl.height >= 720) label = "720p HD";
          else if (lvl.height >= 480) label = "480p";
          else if (lvl.height >= 360) label = "360p Data Saver";
          return {
            index: lvl.height,
            height: lvl.height,
            name: label,
            bitrate: lvl.bitrate,
          };
        });

        if (!nativeVariant) setQualityLevels(levels.sort((a, b) => a.height - b.height));
      });

      return () => {
        hls.destroy();
        hlsRef.current = null;
      };
    } else if (isHls && video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = embedSrc;
      video.load();
    } else {
      video.src = embedSrc;
      video.load();
    }
  }, [embedSrc, isEmbed, isHls, canPlay, nativeVariant]);

  const lowQualitySource = servers.find(s => /\.m3u8(?:$|\?)/i.test(s.stream_url))?.stream_url || "";
  useEffect(()=>{
    const hls=hlsRef.current;
    if(hls) {
      const low=hls.levels.findIndex(level=>level.height<=360);
      hls.autoLevelCapping=allow480 ? -1 : Math.max(0,low);
      if(!allow480 && hls.currentLevel>=0 && hls.levels[hls.currentLevel]?.height>360)hls.currentLevel=Math.max(0,low);
    }
    if(!allow480 && nativeVariant.includes('/480p.m3u8')) {
      switchPosition.current=videoRef.current?.currentTime||0;
      setNativeVariant(nativeVariant.replace('/480p.m3u8','/360p.m3u8'));setCurrentLevel(360);
    }
  },[allow480,nativeVariant,embedSrc]);
  useEffect(()=>{
    if(!canPlay || !lowQualitySource) return;
    let cancelled=false;
    const refresh=async()=>{
      try {
        const response=await fetch(lowQualitySource,{cache:'no-store'});
        if(!response.ok) return;
        const text=await response.text();
        const names=[...text.matchAll(/^(360p|480p)\.m3u8$/gm)].map(m=>m[1]);
        if(!cancelled && names.length) setQualityLevels(names.map(name=>({index:parseInt(name),height:parseInt(name),name})));
      } catch {}
    };
    refresh(); const timer=setInterval(refresh,10000);
    return ()=>{cancelled=true;clearInterval(timer);};
  },[canPlay,lowQualitySource]);

  const handleQualityChange = (lvlIndex: number) => {
    if(lvlIndex === -2) {
      const originalIndex=servers.findIndex(s=>s.server_name==='Original Quality (VIP)');
      if(!originalEnabled || !isVip || originalIndex < 0) { setPlaybackToast('Original Quality requires VIP login and a ready video.'); setTimeout(()=>setPlaybackToast(null),5000); return; }
      switchPosition.current=videoRef.current?.currentTime || 0; setNativeVariant('');setActiveIdx(originalIndex);setCurrentLevel(-2); return;
    }
    if(lvlIndex === 480 && !allow480)return;
    const lowIndex = servers.findIndex(s => s.stream_url === lowQualitySource);
    if (lowIndex < 0 || (lvlIndex !== -1 && !qualityLevels.some(q => q.height === lvlIndex))) return;
    const hlsLevel = hlsRef.current?.levels.findIndex(level => level.height === lvlIndex) ?? -1;
    if (activeIdx === lowIndex && !nativeVariant && hlsRef.current && (lvlIndex === -1 || hlsLevel >= 0)) {
      hlsRef.current.currentLevel = lvlIndex === -1 ? -1 : hlsLevel;
    } else {
      switchPosition.current = videoRef.current?.currentTime || 0;
      setActiveIdx(lowIndex);
      // Direct rendition URLs also support native HLS and newly published 480p.
      setNativeVariant(lvlIndex === -1 ? '' : lowQualitySource.replace(/[^/]+$/, `${lvlIndex}p.m3u8`));
    }
    setCurrentLevel(lvlIndex);
    setShowQualityMenu(false);
  };

  const currentQualityLabel = () => {
    if (currentLevel === -1) return "Auto";
    if (currentLevel === -2) return "Original Quality (VIP)";
    const found = qualityLevels.find((q) => q.index === currentLevel);
    return found ? found.name : "Auto";
  };

  if ((!servers || servers.length === 0) && !isLoading && canPlay && !keyAccess.isLoading) {
    return (
      <div className="aspect-video w-full bg-black flex flex-col items-center justify-center text-gray-500 rounded-xl">
        <MonitorPlay size={48} className="mb-4 opacity-50" />
        <p>Video is being prepared. 360p will appear here as soon as it is ready.</p>
      </div>
    );
  }

  const redirectParam = encodeURIComponent(pathname || "/");

  return (
    <div className="w-full flex flex-col rounded-xl overflow-hidden bg-[#141519] shadow-2xl relative select-none">
      {/* Video Display Area */}
      <div 
        ref={playerRef}
        className="az-player-frame aspect-video w-full bg-black relative overflow-hidden group select-none"
        onContextMenu={(e) => e.preventDefault()}
      >
        {isLoading || keyAccess.isLoading ? (
          /* Checking Authentication / Pass State */
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#0a0a0f]">
            <Loader2 size={36} className="animate-spin text-[#ff640a]" />
            <p className="text-xs text-gray-400">Loading secure video player...</p>
          </div>
        ) : keyAccess.active && loginRequired && !user ? (
          /* 🔒 LOGIN REQUIRED GATE — Video will NOT load or play until user logs in */
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-gradient-to-b from-black/85 via-[#0d0e12]/95 to-black select-none z-20">
            <div className="absolute w-72 h-72 rounded-full bg-[#ff640a]/10 blur-3xl pointer-events-none -z-10" />

            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-[#ff640a]/30 to-purple-600/20 border border-[#ff640a]/40 flex items-center justify-center mb-4 shadow-2xl shadow-[#ff640a]/20">
              <Lock size={32} className="text-[#ff640a]" />
            </div>

            <div className="inline-flex items-center gap-1.5 bg-[#ff640a]/10 border border-[#ff640a]/20 text-[#ff640a] text-[10px] sm:text-xs font-black uppercase px-3 py-1 rounded-full mb-3 shadow">
              <Sparkles size={12} /> Member Access Only
            </div>

            <h2 className="text-xl sm:text-2xl md:text-3xl font-black text-white tracking-tight mb-2">
              Sign In to Stream Episode
            </h2>

            <p className="text-xs sm:text-sm text-gray-400 max-w-md mb-6 leading-relaxed">
              {guestMode === 'preview' ? 'The free guest preview covers the first two episodes of each anime. Sign in to watch this episode after key verification.' : 'Your key step is complete. Sign in or create an account to continue watching.'}
            </p>

            <div className="flex flex-wrap items-center justify-center gap-3">
              <Link
                href={`/login?redirect=${redirectParam}`}
                className="inline-flex items-center gap-2 bg-[#ff640a] hover:bg-[#e05300] text-white px-6 py-3 rounded-xl font-bold text-xs sm:text-sm transition-all shadow-xl shadow-[#ff640a]/30 hover:scale-105"
              >
                <span>Sign In to Watch</span>
                <ArrowRight size={15} />
              </Link>
              <Link
                href={`/signup?redirect=${redirectParam}`}
                className="inline-flex items-center gap-2 bg-[#1e1e24] hover:bg-[#282830] border border-white/10 text-white px-5 py-3 rounded-xl font-bold text-xs sm:text-sm transition-all"
              >
                Create Free Account
              </Link>
            </div>

            <div className="flex items-center flex-wrap justify-center gap-4 sm:gap-6 mt-6 pt-5 border-t border-white/5 text-[11px] text-gray-500">
              <span className="flex items-center gap-1">
                <ShieldCheck size={13} className="text-emerald-400" /> 100% Free
              </span>
              <span>•</span>
              <span>⚡ Fast 2Gbps Servers</span>
              <span>•</span>
              <span>🎧 Hindi / English Dubs</span>
            </div>
          </div>
        ) : !keyAccess.active && !keyAccess.is_vip ? (
          /* 🔑 48-HOUR KEY REQUIRED GATE */
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-gradient-to-b from-black/90 via-[#0d0e14]/95 to-black select-none z-20 overflow-y-auto">
            <div className="absolute w-80 h-80 rounded-full bg-amber-500/10 blur-3xl pointer-events-none -z-10" />

            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-amber-500/25 to-orange-600/20 border border-amber-500/40 flex items-center justify-center mb-3 shadow-2xl shadow-amber-500/20">
              <Key size={32} className="text-amber-400" />
            </div>

            <div className="inline-flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] sm:text-xs font-black uppercase px-3 py-1 rounded-full mb-2.5 shadow">
              <Sparkles size={12} /> 48-Hour Access Pass Required
            </div>

            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight mb-2">
              Unlock 48 Hours of Unlimited Anime
            </h2>

            <p className="text-xs sm:text-sm text-neutral-300 max-w-md mb-5 leading-relaxed">
              Complete a quick shortener task to get your free 48-Hour Key. Once unlocked, all episodes, dubs, and movies are unlocked across the entire site.
            </p>

            {keyGenError && (
              <div className="mb-4 px-4 py-2 bg-rose-500/15 border border-rose-500/30 rounded-xl text-xs text-rose-300 max-w-md text-left">
                {keyGenError}
              </div>
            )}

            {/* Primary Action Buttons */}
            <div className="flex flex-col items-center gap-3 w-full max-w-md">
              <div className="flex flex-wrap items-center justify-center gap-3 w-full">
                <button
                  onClick={handleGetKey}
                  disabled={isGeneratingKey}
                  className="flex-1 min-w-[180px] inline-flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-neutral-950 px-6 py-3 rounded-xl font-extrabold text-xs sm:text-sm transition-all shadow-xl shadow-amber-500/25 active:scale-95 disabled:opacity-50"
                >
                  {isGeneratingKey ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>Generating Link...</span>
                    </>
                  ) : (
                    <>
                      <Key size={16} />
                      <span>Get 48-Hour Key</span>
                      <ExternalLink size={14} className="opacity-70" />
                    </>
                  )}
                </button>

                <button
                  onClick={() => setShowManualKeyInput(!showManualKeyInput)}
                  className="inline-flex items-center justify-center gap-2 bg-neutral-800/90 hover:bg-neutral-700 border border-white/10 text-white px-5 py-3 rounded-xl font-bold text-xs sm:text-sm transition-all"
                >
                  <span>{showManualKeyInput ? "Close" : "I Have a Key"}</span>
                </button>
              </div>

              {/* Upgrade to VIP Button */}
              <Link
                href="/account"
                className="w-full inline-flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white px-6 py-3 rounded-xl font-extrabold text-xs sm:text-sm transition-all shadow-xl shadow-purple-500/25 active:scale-95"
              >
                <Sparkles size={16} />
                <span>Upgrade to VIP (No Ads, No Keys)</span>
              </Link>
            </div>

            {/* Inline Key Code Input Form */}
            {showManualKeyInput && (
              <form
                onSubmit={handleManualKeySubmit}
                className="mt-4 w-full max-w-md bg-neutral-900/90 border border-neutral-700/80 p-3.5 rounded-xl flex flex-col gap-2.5 animate-in fade-in zoom-in-95 duration-150"
              >
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={manualKeyCode}
                    onChange={(e) => setManualKeyCode(e.target.value)}
                    placeholder="e.g. AZ-ABCD-1234"
                    className="flex-1 bg-black/60 border border-neutral-700 rounded-lg px-3 py-2 text-xs font-mono text-white placeholder:text-neutral-500 uppercase focus:outline-none focus:border-amber-500"
                  />
                  <button
                    type="submit"
                    disabled={manualKeySubmitting || !manualKeyCode.trim()}
                    className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs rounded-lg transition disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {manualKeySubmitting ? <Loader2 size={14} className="animate-spin" /> : "Unlock"}
                  </button>
                </div>
                {manualKeyError && (
                  <p className="text-[11px] text-rose-400 text-left">{manualKeyError}</p>
                )}
              </form>
            )}

            {/* Footer Info / VIP Callout */}
            <div className="flex items-center flex-wrap justify-center gap-4 sm:gap-6 mt-6 pt-4 border-t border-white/5 text-[11px] text-gray-400">
              <span className="flex items-center gap-1 text-amber-400/90 font-medium">
                <Clock size={13} /> 48 Hours Full Site Access
              </span>
              <span>•</span>
              <span className="flex items-center gap-1 text-emerald-400">
                <ShieldCheck size={13} /> 100% Free
              </span>
              <span>•</span>
              <span className="text-gray-400">
                👑 VIPs bypass keys automatically
              </span>
            </div>
          </div>
        ) : isEmbed ? (
          /* User is logged in: Embed Iframe */
          introPhase === "complete" ? <iframe
            key={embedSrc}
            src={embedSrc}
            allowFullScreen
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            sandbox="allow-scripts allow-same-origin allow-presentation"
            referrerPolicy="origin"
            className="absolute inset-0 w-full h-full border-0"
          ></iframe> : null
        ) : (
          /* User is logged in: Native / HLS HTML5 Video */
          <>
            <video
              ref={videoRef}
              controls={false}
              onPlay={(event) => {
                if (!introPassed.current) {
                  event.currentTarget.pause();
                  setIntroPhase("playing");
                } else {
                  setNeedsPlay(false);
                }
              }}
              playsInline
              preload="metadata"
              onLoadedMetadata={() => {
                if(switchPosition.current !== null && videoRef.current) {
                  videoRef.current.currentTime=switchPosition.current; switchPosition.current=null;
                  if(introPassed.current) videoRef.current.play().catch(()=>setNeedsPlay(true));
                }
              }}
              onContextMenu={(e) => e.preventDefault()}
              className="absolute inset-0 w-full h-full outline-none select-none"
              controlsList="nodownload"
              onTimeUpdate={(e) => {
                const now = e.currentTarget.currentTime;
                if (Math.abs(now - lastSavedTime.current) >= 5) {
                  lastSavedTime.current = now;
                  saveProgress(now, e.currentTarget.duration);
                }
              }}
              onPause={(e) => {
                saveProgress(e.currentTarget.currentTime, e.currentTarget.duration);
              }}
            >
              {!isHls && embedSrc && <source src={embedSrc} type="video/mp4" />}
            </video>

            {introPhase === "complete" && <PlayerControls key={embedSrc} videoRef={videoRef} containerRef={playerRef} hlsRef={hlsRef}
              qualities={[...qualityLevels.filter(q=>allow480||q.height!==480), ...(originalEnabled ? [{index:-2,height:0,name:isVip ? "Original Quality (VIP)" : "Original Quality — VIP required"}] : [])]} quality={currentLevel} onQuality={handleQualityChange} onPlay={requestPlayback}
              title={title} nextEpisodeUrl={nextEpisodeUrl} />}
            <PlaybackAnalytics videoRef={videoRef} episodeId={episodeId} enabled={canPlay && introPhase === 'complete'} source={embedSrc} />

            {/* Resume Playback Prompt Banner (Overlay inside player) */}
            {introPhase !== "playing" && showResumeBanner && savedProgress && (
              <div className="absolute top-4 left-4 right-4 sm:left-auto sm:right-4 max-w-md bg-[#18191f]/95 border border-[#ff640a]/40 backdrop-blur-md p-3.5 rounded-xl shadow-2xl z-30 flex flex-col gap-2.5 animate-in fade-in slide-in-from-top-3 duration-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-[#ff640a]/20 text-[#ff640a]">
                      <RotateCcw size={15} />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white">
                        Resume from {formatTime(savedProgress.time)}?
                      </p>
                      <p className="text-[10px] text-gray-400">
                        You were watching this episode earlier.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowResumeBanner(false)}
                    className="text-gray-400 hover:text-white p-1"
                    title="Dismiss"
                  >
                    <X size={14} />
                  </button>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={handleResume}
                    className="flex-1 bg-[#ff640a] hover:bg-[#e05300] text-white text-xs font-bold py-1.5 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-all shadow-md shadow-[#ff640a]/20"
                  >
                    <Play size={12} className="fill-white" />
                    <span>Resume ({formatTime(savedProgress.time)})</span>
                  </button>
                  <button
                    onClick={handleStartOver}
                    className="bg-[#1e1e24] hover:bg-[#282830] text-gray-300 hover:text-white border border-white/10 text-xs font-bold py-1.5 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-all"
                  >
                    <RotateCcw size={12} />
                    <span>Start Over</span>
                  </button>
                </div>
              </div>
            )}

            {/* Playback Toast Notification */}
            {introPhase !== "playing" && playbackToast && (
              <div className="absolute bottom-16 left-1/2 -translate-x-1/2 bg-black/80 text-white text-xs font-bold px-4 py-2 rounded-full border border-white/10 shadow-2xl backdrop-blur-md z-30 flex items-center gap-2 animate-in fade-in zoom-in-95">
                <Sparkles size={13} className="text-[#ff640a]" />
                <span>{playbackToast}</span>
              </div>
            )}
          </>
        )}
        {!isLoading && canPlay && !keyAccess.isLoading && introPhase !== "complete" && (
          <BrandIntro playing={introPhase === "playing"} mediaUrl={introMediaUrl} onPlay={requestPlayback} onComplete={() => { introPassed.current = true; setIntroPhase("complete"); videoRef.current?.play().catch(() => setNeedsPlay(true)); }} />
        )}
        {introStarting && <div role="status" className="absolute inset-0 z-40 flex items-center justify-center bg-black/90 text-white text-sm">Loading player…</div>}
        {introPhase === "complete" && needsPlay && !isEmbed && canPlay && (
          <button type="button" onClick={requestPlayback} className="absolute inset-0 z-20 flex items-center justify-center gap-3 bg-black/70 text-white font-bold">
            <Play size={28} fill="currentColor" /> Tap to play video
          </button>
        )}
      </div>

      {/* ⚡ 48-Hour Pass Status Banner (When Pass is Active) */}
      {keyAccess.active && !keyAccess.is_vip && keyAccess.remaining_hours > 0 && (
        <div className="px-3.5 sm:px-4 py-2 bg-amber-500/10 border-t border-amber-500/20 flex items-center justify-between text-xs text-amber-400">
          <div className="flex items-center gap-1.5 font-medium">
            <Sparkles size={14} className="text-amber-400 animate-pulse" />
            <span>
              48-Hour Pass Active: <strong className="text-white">{keyAccess.remaining_hours} hours</strong> remaining
            </span>
          </div>
          <Link
            href="/verify-key"
            className="text-[11px] text-amber-400 hover:text-amber-300 font-semibold underline underline-offset-2"
          >
            Extend Pass
          </Link>
        </div>
      )}

      {/* Controls & Server Switcher Bar */}
      <div className="p-3.5 sm:p-4 bg-[#141519] flex flex-wrap items-center justify-between gap-3 border-t border-white/5">
        {/* Left Side: Server Switcher Tabs */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs sm:text-sm font-semibold text-gray-400 mr-1 flex items-center gap-1">
            <MonitorPlay size={16} /> Server:
          </span>
          {servers.map((srv, idx) =>
            canPlay ? (
              <button
                key={srv.id || idx}
                onClick={() => { switchPosition.current=videoRef.current?.currentTime || 0; setNativeVariant('');setActiveIdx(idx); }}
                className={`px-3 py-1.5 text-xs sm:text-sm font-bold rounded transition-colors flex items-center gap-1.5
                  ${
                    activeIdx === idx
                      ? "bg-[#ff640a] text-white"
                      : "bg-[#1e1e24] text-gray-300 hover:bg-[#282830] hover:text-white"
                  }`}
              >
                <Play size={13} className={activeIdx === idx ? "fill-white" : ""} /> {srv.server_name}
              </button>
            ) : (
              <span
                key={srv.id || idx}
                className="px-3 py-1.5 text-xs font-medium rounded bg-[#1e1e24]/60 text-gray-500 border border-white/5 flex items-center gap-1 cursor-not-allowed opacity-60"
              >
                <Lock size={11} /> {srv.server_name}
              </span>
            )
          )}
        </div>

        {/* Right Side: Playback & Download Quick Actions (For Logged-In Users) */}
        {canPlay && (
          <div className="flex items-center flex-wrap gap-2">
            {/* 🔄 Start Over / Restart Button */}
            {!isEmbed && (
              <button
                onClick={handleStartOver}
                title="Restart video from beginning (0:00)"
                className="flex items-center gap-1.5 bg-[#1e1e24] hover:bg-[#282830] text-gray-300 hover:text-white px-3 py-1.5 rounded text-xs font-bold transition-all border border-white/5"
              >
                <RotateCcw size={13} className="text-[#ff640a]" />
                <span className="hidden sm:inline">Start Over</span>
              </button>
            )}

            {/* ⏩ Resume Button (if saved position available) */}
            {!isEmbed && savedProgress && savedProgress.time > 10 && (
              <button
                onClick={handleResume}
                title={`Resume to ${formatTime(savedProgress.time)}`}
                className="flex items-center gap-1.5 bg-[#ff640a]/15 hover:bg-[#ff640a]/25 text-[#ff640a] border border-[#ff640a]/30 px-3 py-1.5 rounded text-xs font-bold transition-all"
              >
                <FastForward size={13} />
                <span>Resume ({formatTime(savedProgress.time)})</span>
              </button>
            )}

            {/* 📥 Quick Jump to Episode Downloads (VIP Only) */}
            {isVip && (
              <button
                onClick={scrollToDownloads}
                title="Download Episode in 1080p, 720p, 480p"
                className="flex items-center gap-1.5 bg-emerald-600/15 hover:bg-emerald-600/25 border border-emerald-500/30 text-emerald-400 px-3 py-1.5 rounded text-xs font-bold transition-all"
              >
                <Download size={13} />
                <span>Download</span>
              </button>
            )}

            {/* ⚙️ Quality Selector (for HLS streams) */}
            {qualityLevels.length > 0 && (
              <div className="relative">
                <button
                  onClick={() => setShowQualityMenu(!showQualityMenu)}
                  className="flex items-center gap-1.5 bg-[#1e1e24] hover:bg-[#282830] text-white px-3 py-1.5 rounded text-xs font-bold transition-all border border-white/5 hover:border-[#ff640a]/40"
                >
                  <Settings size={14} className="text-[#ff640a]" />
                  <span>Quality:</span>
                  <span className="text-[#ff640a] font-mono">{currentQualityLabel()}</span>
                </button>

                {/* Quality Dropdown Menu */}
                {showQualityMenu && (
                  <div className="absolute right-0 bottom-full mb-2 w-48 bg-[#18191f] border border-white/10 rounded-xl shadow-2xl py-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                    <div className="px-3 py-1.5 border-b border-white/5 text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                      Select Video Quality
                    </div>

                    <button
                      onClick={() => handleQualityChange(-1)}
                      className={`w-full text-left px-3.5 py-2 text-xs font-bold flex items-center justify-between transition-colors ${
                        currentLevel === -1
                          ? "text-[#ff640a] bg-white/5 font-black"
                          : "text-gray-300 hover:text-white hover:bg-white/5"
                      }`}
                    >
                      <span>Auto (Adaptive)</span>
                      {currentLevel === -1 && <Check size={14} className="text-[#ff640a]" />}
                    </button>

                    {qualityLevels.filter(q=>allow480||q.height!==480).map((lvl) => (
                      <button
                        key={lvl.index}
                        onClick={() => handleQualityChange(lvl.index)}
                        className={`w-full text-left px-3.5 py-2 text-xs font-bold flex items-center justify-between transition-colors ${
                          currentLevel === lvl.index
                            ? "text-[#ff640a] bg-white/5 font-black"
                            : "text-gray-300 hover:text-white hover:bg-white/5"
                        }`}
                      >
                        <span>{lvl.name}</span>
                        {currentLevel === lvl.index && <Check size={14} className="text-[#ff640a]" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
