'use client';

import { useState, useEffect, useCallback } from 'react';
import { adminFetch } from '@/lib/adminApi';
import {
  Send,
  Megaphone,
  Sparkles,
  Flame,
  Bell,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  Eye,
  Power,
  Loader2,
  X,
  ExternalLink,
} from 'lucide-react';

interface Broadcast {
  id: number;
  title: string;
  message: string;
  theme: string;
  icon: string;
  btn_text: string;
  btn_url: string;
  is_active: number;
  dismissible: number;
  created_at: string;
}

const THEME_OPTIONS = [
  {
    id: 'orange',
    name: 'Neon Orange (Brand)',
    bg: 'from-[#ff640a]/25 via-[#ff640a]/15 to-[#141519]',
    border: 'border-[#ff640a]/40',
    badge: 'bg-[#ff640a] text-white',
    btn: 'bg-[#ff640a] hover:bg-[#e05300] text-white',
    accent: '#ff640a',
  },
  {
    id: 'purple',
    name: 'Cyberpunk Violet',
    bg: 'from-violet-600/30 via-purple-600/15 to-[#141519]',
    border: 'border-violet-500/40',
    badge: 'bg-violet-600 text-white',
    btn: 'bg-violet-600 hover:bg-violet-700 text-white',
    accent: '#8b5cf6',
  },
  {
    id: 'red',
    name: 'Fire Red (Alert)',
    bg: 'from-rose-600/30 via-red-600/15 to-[#141519]',
    border: 'border-rose-500/40',
    badge: 'bg-rose-600 text-white',
    btn: 'bg-rose-600 hover:bg-rose-700 text-white',
    accent: '#f43f5e',
  },
  {
    id: 'emerald',
    name: 'Emerald (New Release)',
    bg: 'from-emerald-600/30 via-teal-600/15 to-[#141519]',
    border: 'border-emerald-500/40',
    badge: 'bg-emerald-600 text-white',
    btn: 'bg-emerald-600 hover:bg-emerald-700 text-white',
    accent: '#10b981',
  },
  {
    id: 'blue',
    name: 'Sky Blue (Community)',
    bg: 'from-sky-600/30 via-blue-600/15 to-[#141519]',
    border: 'border-sky-500/40',
    badge: 'bg-sky-500 text-white',
    btn: 'bg-sky-500 hover:bg-sky-600 text-white',
    accent: '#0284c7',
  },
];

const ICON_OPTIONS = [
  { id: 'sparkles', label: 'Sparkles', icon: Sparkles },
  { id: 'flame', label: 'Flame', icon: Flame },
  { id: 'bell', label: 'Bell', icon: Bell },
  { id: 'telegram', label: 'Telegram', icon: Send },
  { id: 'alert', label: 'Alert', icon: AlertTriangle },
];

export default function BroadcastsAdminPage() {
  const [loading, setLoading] = useState(true);
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);

  // Telegram settings state
  const [telegramUrl, setTelegramUrl] = useState('https://t.me/');
  const [telegramText, setTelegramText] = useState('');
  const [telegramBtnText, setTelegramBtnText] = useState('Join');
  const [telegramEnabled, setTelegramEnabled] = useState(true);
  const [savingTelegram, setSavingTelegram] = useState(false);
  const [telegramSavedNotice, setTelegramSavedNotice] = useState(false);

  // New broadcast form state
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [theme, setTheme] = useState('orange');
  const [icon, setIcon] = useState('sparkles');
  const [btnText, setBtnText] = useState('');
  const [btnUrl, setBtnUrl] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [dismissible, setDismissible] = useState(true);
  const [creating, setCreating] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      // Fetch telegram & site settings
      const settingsRes = await adminFetch('/api/admin/settings');
      if (settingsRes.ok) {
        const data = await settingsRes.json();
        setTelegramUrl(data.telegram_url || 'https://t.me/');
        setTelegramText(
          data.telegram_text ||
            'Join Official Telegram for latest Hindi & Multi-Audio releases!'
        );
        setTelegramBtnText(data.telegram_btn_text || 'Join');
        setTelegramEnabled(data.telegram_enabled === '1');
      }

      // Fetch broadcasts
      const broadcastsRes = await adminFetch('/api/admin/broadcasts');
      if (broadcastsRes.ok) {
        const bData = await broadcastsRes.json();
        setBroadcasts(Array.isArray(bData) ? bData : []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Save Telegram settings
  const handleSaveTelegram = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingTelegram(true);
    try {
      const res = await adminFetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telegram_url: telegramUrl.trim(),
          telegram_text: telegramText.trim(),
          telegram_btn_text: telegramBtnText.trim() || 'Join',
          telegram_enabled: telegramEnabled ? '1' : '0',
        }),
      });

      if (res.ok) {
        setTelegramSavedNotice(true);
        setTimeout(() => setTelegramSavedNotice(false), 3000);
      } else {
        alert('Failed to save Telegram settings');
      }
    } catch {
      alert('Error saving settings');
    } finally {
      setSavingTelegram(false);
    }
  };

  // Create Broadcast
  const handleCreateBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) {
      alert('Title and message are required');
      return;
    }

    setCreating(true);
    try {
      const res = await adminFetch('/api/admin/broadcasts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          message: message.trim(),
          theme,
          icon,
          btn_text: btnText.trim(),
          btn_url: btnUrl.trim(),
          is_active: isActive ? 1 : 0,
          dismissible: dismissible ? 1 : 0,
        }),
      });

      if (res.ok) {
        setTitle('');
        setMessage('');
        setBtnText('');
        setBtnUrl('');
        await fetchData();
        alert('Broadcast published successfully!');
      } else {
        alert('Failed to publish broadcast');
      }
    } catch {
      alert('Network error while publishing broadcast');
    } finally {
      setCreating(false);
    }
  };

  // Toggle active status
  const handleToggleActive = async (b: Broadcast) => {
    try {
      const newStatus = b.is_active === 1 ? 0 : 1;
      const res = await adminFetch(`/api/admin/broadcasts/${b.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: newStatus }),
      });
      if (res.ok) {
        setBroadcasts((prev) =>
          prev.map((item) =>
            item.id === b.id ? { ...item, is_active: newStatus } : item
          )
        );
      }
    } catch {
      alert('Failed to update broadcast');
    }
  };

  // Delete broadcast
  const handleDeleteBroadcast = async (id: number) => {
    if (!confirm('Are you sure you want to delete this broadcast?')) return;
    try {
      const res = await adminFetch(`/api/admin/broadcasts/${id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setBroadcasts((prev) => prev.filter((item) => item.id !== id));
      }
    } catch {
      alert('Failed to delete broadcast');
    }
  };

  if (loading) {
    return <div className="text-slate-400 text-center py-12">Loading settings...</div>;
  }

  const selectedThemeConfig =
    THEME_OPTIONS.find((t) => t.id === theme) || THEME_OPTIONS[0];
  const SelectedIconComponent =
    ICON_OPTIONS.find((i) => i.id === icon)?.icon || Sparkles;

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-16">
      <div>
        <h1 className="text-3xl font-black text-white flex items-center gap-3">
          <Megaphone className="text-violet-500" size={30} />
          Broadcast & Telegram Management
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-1">
          Configure the public Telegram channel link and control live announcements displayed to users.
        </p>
      </div>

      {/* 1. TELEGRAM CHANNEL SETTINGS */}
      <div className="bg-[#1a1a2e] rounded-2xl border border-slate-800 p-6 space-y-5 shadow-xl">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-sky-500/10 text-sky-400">
              <Send size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Telegram Channel Settings</h2>
              <p className="text-xs text-slate-400">
                Shown to all users at the top of every page
              </p>
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <span className="text-xs text-slate-400 font-medium">
              {telegramEnabled ? 'Active' : 'Disabled'}
            </span>
            <input
              type="checkbox"
              checked={telegramEnabled}
              onChange={(e) => setTelegramEnabled(e.target.checked)}
              className="sr-only"
            />
            <div
              className={`w-10 h-6 rounded-full transition-colors relative p-1 ${
                telegramEnabled ? 'bg-sky-500' : 'bg-slate-700'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-white transition-transform ${
                  telegramEnabled ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </div>
          </label>
        </div>

        <form onSubmit={handleSaveTelegram} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">
                Telegram Channel URL / Invite Link
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={telegramUrl}
                  onChange={(e) => setTelegramUrl(e.target.value)}
                  placeholder="https://t.me/your_channel_name"
                  className="w-full bg-[#0f0f1a] border border-slate-800 focus:border-sky-500 rounded-xl p-3 text-xs text-white outline-none transition-colors"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">
                Button Label
              </label>
              <input
                type="text"
                value={telegramBtnText}
                onChange={(e) => setTelegramBtnText(e.target.value)}
                placeholder="Join"
                className="w-full bg-[#0f0f1a] border border-slate-800 focus:border-sky-500 rounded-xl p-3 text-xs text-white outline-none transition-colors"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">
              Notification Text
            </label>
            <input
              type="text"
              value={telegramText}
              onChange={(e) => setTelegramText(e.target.value)}
              placeholder="Join Official Telegram for latest Hindi & Multi-Audio releases!"
              className="w-full bg-[#0f0f1a] border border-slate-800 focus:border-sky-500 rounded-xl p-3 text-xs text-white outline-none transition-colors"
            />
          </div>

          <div className="flex items-center justify-between pt-2">
            {telegramSavedNotice ? (
              <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 size={15} /> Telegram settings saved successfully!
              </span>
            ) : (
              <span className="text-xs text-slate-500">
                Changes will reflect immediately for all visitors.
              </span>
            )}
            <button
              type="submit"
              disabled={savingTelegram}
              className="px-5 py-2.5 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-sky-600/20 flex items-center gap-2"
            >
              {savingTelegram ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              Save Telegram Settings
            </button>
          </div>
        </form>
      </div>

      {/* 2. CREATE NEW LIVE BROADCAST */}
      <div className="bg-[#1a1a2e] rounded-2xl border border-slate-800 p-6 space-y-6 shadow-xl">
        <div className="flex items-center gap-3 pb-3 border-b border-slate-800">
          <div className="p-2.5 rounded-xl bg-violet-500/10 text-violet-400">
            <Megaphone size={20} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Create Live Broadcast Announcement</h2>
            <p className="text-xs text-slate-400">
              Broadcast custom alerts, release notices, or maintenance updates across the entire site
            </p>
          </div>
        </div>

        <form onSubmit={handleCreateBroadcast} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">
                Broadcast Title / Tag
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. New Release / Server Notice / Special Update"
                required
                className="w-full bg-[#0f0f1a] border border-slate-800 focus:border-violet-500 rounded-xl p-3 text-xs text-white outline-none transition-colors"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">
                Icon Style
              </label>
              <div className="flex gap-2">
                {ICON_OPTIONS.map((item) => {
                  const IconComp = item.icon;
                  const isSelected = icon === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setIcon(item.id)}
                      className={`flex-1 flex items-center justify-center gap-1.5 p-2.5 rounded-xl text-xs font-medium border transition-all ${
                        isSelected
                          ? 'bg-violet-600/30 border-violet-500 text-white shadow-md'
                          : 'bg-[#0f0f1a] border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      <IconComp size={15} />
                      <span className="hidden sm:inline">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">
              Broadcast Message
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={2}
              placeholder="e.g. Solo Leveling Episode 12 Hindi Dub is now streaming in Full HD! Tap to watch now."
              required
              className="w-full bg-[#0f0f1a] border border-slate-800 focus:border-violet-500 rounded-xl p-3 text-xs text-white outline-none transition-colors resize-none"
            />
          </div>

          {/* Theme Selector */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-300">
              Choose Visual Theme
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {THEME_OPTIONS.map((t) => {
                const isSelected = theme === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTheme(t.id)}
                    className={`p-3 rounded-xl border text-left flex flex-col gap-1.5 transition-all ${
                      isSelected
                        ? `bg-slate-900 ${t.border} ring-2 ring-violet-500/50`
                        : 'bg-[#0f0f1a] border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: t.accent }}
                      />
                      <span className="text-xs font-bold text-white truncate">
                        {t.name}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Optional Action Button */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">
                Action Button Text (Optional)
              </label>
              <input
                type="text"
                value={btnText}
                onChange={(e) => setBtnText(e.target.value)}
                placeholder="e.g. Watch Now / Join Channel"
                className="w-full bg-[#0f0f1a] border border-slate-800 focus:border-violet-500 rounded-xl p-3 text-xs text-white outline-none transition-colors"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">
                Action Button URL (Optional)
              </label>
              <input
                type="text"
                value={btnUrl}
                onChange={(e) => setBtnUrl(e.target.value)}
                placeholder="e.g. /anime/solo-leveling or https://..."
                className="w-full bg-[#0f0f1a] border border-slate-800 focus:border-violet-500 rounded-xl p-3 text-xs text-white outline-none transition-colors"
              />
            </div>
          </div>

          {/* Toggles: Active & Dismissible */}
          <div className="flex flex-wrap items-center gap-6 pt-1">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="w-4 h-4 accent-violet-600 rounded"
              />
              <span className="text-xs text-slate-300 font-medium">
                Make Active Immediately (Visible to users)
              </span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={dismissible}
                onChange={(e) => setDismissible(e.target.checked)}
                className="w-4 h-4 accent-violet-600 rounded"
              />
              <span className="text-xs text-slate-300 font-medium">
                Allow user to close [X]
              </span>
            </label>
          </div>

          {/* 🔍 LIVE PREVIEW BOX */}
          <div className="space-y-2 pt-2">
            <label className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
              <Eye size={14} className="text-violet-400" /> Live Preview (How it will look to users):
            </label>

            <div
              className={`rounded-xl border p-2.5 sm:p-3 shadow-2xl bg-gradient-to-r ${selectedThemeConfig.bg} ${selectedThemeConfig.border} flex items-center justify-between gap-3 flex-wrap`}
            >
              <div className="flex items-center gap-2.5 flex-wrap flex-1 min-w-0">
                <span
                  className={`text-[10px] font-black uppercase px-2 py-0.5 rounded shadow flex items-center gap-1 ${selectedThemeConfig.badge}`}
                >
                  <SelectedIconComponent size={12} />
                  {title || 'ANNOUNCEMENT'}
                </span>
                <span className="text-xs text-gray-200 font-medium truncate">
                  {message || 'Your broadcast message preview appears right here in real time.'}
                </span>
                {btnText && (
                  <span
                    className={`text-[11px] font-bold px-2.5 py-0.5 rounded shadow transition-all ${selectedThemeConfig.btn}`}
                  >
                    {btnText}
                  </span>
                )}
              </div>

              {dismissible && (
                <span className="text-gray-400 p-1">
                  <X size={14} />
                </span>
              )}
            </div>
          </div>

          {/* Submit */}
          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={creating}
              className="px-6 py-3 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-xl shadow-violet-600/30 flex items-center gap-2"
            >
              {creating ? (
                <>
                  <Loader2 size={14} className="animate-spin" /> Publishing...
                </>
              ) : (
                <>
                  <Megaphone size={14} /> Publish Broadcast
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* 3. BROADCAST HISTORY & ACTIVE SWITCH */}
      <div className="bg-[#1a1a2e] rounded-2xl border border-slate-800 p-6 space-y-4 shadow-xl">
        <h2 className="text-lg font-bold text-white">Broadcast History & Active Banners</h2>

        {broadcasts.length === 0 ? (
          <p className="text-xs text-slate-500 py-6 text-center italic">
            No broadcasts created yet. Create one above to publish across the site.
          </p>
        ) : (
          <div className="space-y-3">
            {broadcasts.map((b) => {
              const bTheme = THEME_OPTIONS.find((t) => t.id === b.theme) || THEME_OPTIONS[0];
              const BIcon = ICON_OPTIONS.find((i) => i.id === b.icon)?.icon || Sparkles;
              const isLive = b.is_active === 1;

              return (
                <div
                  key={b.id}
                  className={`p-4 rounded-xl border transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${
                    isLive
                      ? 'bg-slate-900/80 border-slate-700'
                      : 'bg-[#0f0f1a]/60 border-slate-800 opacity-60'
                  }`}
                >
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div
                      className={`p-2 rounded-lg shrink-0 ${
                        isLive ? 'bg-violet-500/20 text-violet-400' : 'bg-slate-800 text-slate-500'
                      }`}
                    >
                      <BIcon size={18} />
                    </div>
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${bTheme.badge}`}
                        >
                          {b.title}
                        </span>
                        <span className="text-[10px] text-slate-500">
                          {b.created_at?.slice(0, 16)}
                        </span>
                        {isLive && (
                          <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded font-bold flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            LIVE NOW
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-300 font-medium break-words">
                        {b.message}
                      </p>
                      {b.btn_text && (
                        <p className="text-[11px] text-slate-400 flex items-center gap-1">
                          Action: <span className="font-semibold text-white">{b.btn_text}</span> &rarr;{' '}
                          <span className="text-slate-500 truncate max-w-xs">{b.btn_url}</span>
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end md:self-center shrink-0">
                    <button
                      onClick={() => handleToggleActive(b)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 border ${
                        isLive
                          ? 'bg-amber-500/10 hover:bg-amber-500/20 border-amber-500/30 text-amber-300'
                          : 'bg-emerald-600/20 hover:bg-emerald-600/40 border-emerald-500/40 text-emerald-300'
                      }`}
                    >
                      <Power size={13} />
                      {isLive ? 'Deactivate' : 'Activate'}
                    </button>
                    <button
                      onClick={() => handleDeleteBroadcast(b.id)}
                      className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                      title="Delete broadcast"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
