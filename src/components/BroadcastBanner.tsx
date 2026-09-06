"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Send,
  Sparkles,
  Flame,
  Bell,
  AlertTriangle,
  X,
  ExternalLink,
} from "lucide-react";

interface ActiveBroadcast {
  id: number;
  title: string;
  message: string;
  theme: string;
  icon: string;
  btn_text: string;
  btn_url: string;
  dismissible: number;
}

interface TelegramConfig {
  enabled: boolean;
  url: string;
  text: string;
  btn_text: string;
}

const THEME_STYLES: Record<
  string,
  {
    gradient: string;
    border: string;
    badge: string;
    btn: string;
    text: string;
  }
> = {
  orange: {
    gradient: "from-[#ff640a]/20 via-[#ff640a]/10 to-[#141519]",
    border: "border-[#ff640a]/30",
    badge: "bg-[#ff640a] text-white shadow-[#ff640a]/20",
    btn: "bg-[#ff640a] hover:bg-[#e05300] text-white shadow-[#ff640a]/20",
    text: "text-white",
  },
  purple: {
    gradient: "from-violet-600/25 via-purple-600/15 to-[#141519]",
    border: "border-violet-500/30",
    badge: "bg-violet-600 text-white shadow-violet-600/20",
    btn: "bg-violet-600 hover:bg-violet-700 text-white shadow-violet-600/20",
    text: "text-white",
  },
  red: {
    gradient: "from-rose-600/25 via-red-600/15 to-[#141519]",
    border: "border-rose-500/30",
    badge: "bg-rose-600 text-white shadow-rose-600/20",
    btn: "bg-rose-600 hover:bg-rose-700 text-white shadow-rose-600/20",
    text: "text-white",
  },
  emerald: {
    gradient: "from-emerald-600/25 via-teal-600/15 to-[#141519]",
    border: "border-emerald-500/30",
    badge: "bg-emerald-600 text-white shadow-emerald-600/20",
    btn: "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20",
    text: "text-white",
  },
  blue: {
    gradient: "from-sky-600/25 via-blue-600/15 to-[#141519]",
    border: "border-sky-500/30",
    badge: "bg-sky-500 text-white shadow-sky-500/20",
    btn: "bg-sky-500 hover:bg-sky-600 text-white shadow-sky-500/20",
    text: "text-white",
  },
};

export default function BroadcastBanner() {
  const [broadcast, setBroadcast] = useState<ActiveBroadcast | null>(null);
  const [telegram, setTelegram] = useState<TelegramConfig | null>(null);
  const [dismissedBroadcast, setDismissedBroadcast] = useState(true);
  const [dismissedTelegram, setDismissedTelegram] = useState(true);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/broadcast")
      .then((res) => res.json())
      .then((data) => {
        if (data.broadcast) {
          const b = data.broadcast;
          setBroadcast(b);
          const isDismissed =
            typeof window !== "undefined" &&
            localStorage.getItem(`dismissed_broadcast_${b.id}`) === "1";
          setDismissedBroadcast(isDismissed);
        } else {
          setBroadcast(null);
        }

        if (data.telegram) {
          setTelegram(data.telegram);
          const isDismissedTg =
            typeof window !== "undefined" &&
            sessionStorage.getItem("dismissed_telegram_bar") === "1";
          setDismissedTelegram(isDismissedTg);
        }
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  const handleDismissBroadcast = () => {
    if (!broadcast) return;
    setDismissedBroadcast(true);
    try {
      localStorage.setItem(`dismissed_broadcast_${broadcast.id}`, "1");
    } catch {}
  };

  const handleDismissTelegram = () => {
    setDismissedTelegram(true);
    try {
      sessionStorage.setItem("dismissed_telegram_bar", "1");
    } catch {}
  };

  if (!loaded) return null;

  // 1. Prioritize active broadcast
  if (broadcast && !dismissedBroadcast) {
    const themeStyle = THEME_STYLES[broadcast.theme] || THEME_STYLES.orange;

    const renderIcon = () => {
      switch (broadcast.icon) {
        case "flame":
          return <Flame size={12} className="animate-pulse" />;
        case "bell":
          return <Bell size={12} />;
        case "telegram":
          return <Send size={12} />;
        case "alert":
          return <AlertTriangle size={12} />;
        case "sparkles":
        default:
          return <Sparkles size={12} />;
      }
    };

    const isExternalLink =
      broadcast.btn_url?.startsWith("http://") ||
      broadcast.btn_url?.startsWith("https://");

    return (
      <div
        className={`bg-gradient-to-r ${themeStyle.gradient} ${themeStyle.border} border-b text-white text-xs py-2 px-4 flex items-center justify-between gap-3 font-medium relative z-50 backdrop-blur-sm shadow-md animate-in fade-in slide-in-from-top-1 duration-200`}
      >
        <div className="flex-1 flex items-center justify-center gap-2.5 flex-wrap text-center">
          {broadcast.title && (
            <span
              className={`text-[10px] font-black uppercase px-2 py-0.5 rounded shadow flex items-center gap-1 shrink-0 ${themeStyle.badge}`}
            >
              {renderIcon()}
              {broadcast.title}
            </span>
          )}

          <span className={`text-gray-200 text-xs sm:text-sm font-medium ${themeStyle.text}`}>
            {broadcast.message}
          </span>

          {broadcast.btn_text && broadcast.btn_url && (
            isExternalLink ? (
              <a
                href={broadcast.btn_url}
                target="_blank"
                rel="noopener noreferrer"
                className={`inline-flex items-center gap-1 text-xs font-bold px-3 py-1 rounded-lg transition-all shadow ${themeStyle.btn}`}
              >
                <span>{broadcast.btn_text}</span>
                <ExternalLink size={11} />
              </a>
            ) : (
              <Link
                href={broadcast.btn_url}
                className={`inline-flex items-center gap-1 text-xs font-bold px-3 py-1 rounded-lg transition-all shadow ${themeStyle.btn}`}
              >
                <span>{broadcast.btn_text}</span>
              </Link>
            )
          )}
        </div>

        {broadcast.dismissible === 1 && (
          <button
            onClick={handleDismissBroadcast}
            className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors shrink-0"
            aria-label="Dismiss announcement"
          >
            <X size={15} />
          </button>
        )}
      </div>
    );
  }

  // 2. Fallback to Telegram notification bar if active
  if (telegram?.enabled && !dismissedTelegram) {
    return (
      <div className="bg-[#14151a] border-b border-white/5 text-white text-xs py-1.5 px-4 text-center flex items-center justify-between font-medium relative z-50 animate-in fade-in duration-150">
        <div className="flex-1 flex items-center justify-center gap-2 flex-wrap">
          <Send size={13} className="text-[#ff640a]" />
          <span className="text-gray-300">{telegram.text}</span>
          {telegram.url && (
            <a
              href={telegram.url}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-[#ff640a] hover:bg-[#e05300] text-white px-2.5 py-0.5 rounded font-bold transition-all text-xs ml-1 shadow-sm"
            >
              {telegram.btn_text || "Join"}
            </a>
          )}
        </div>
        <button
          onClick={handleDismissTelegram}
          className="text-gray-400 hover:text-white p-1 rounded hover:bg-white/10 transition-colors"
          aria-label="Dismiss Telegram banner"
        >
          <X size={14} />
        </button>
      </div>
    );
  }

  return null;
}
