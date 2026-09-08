'use client';
import { useState, useEffect } from 'react';
import { Lock, Eye, EyeOff, CheckCircle2, AlertTriangle, ShieldAlert, Power, Upload, Film, Clapperboard } from 'lucide-react';
import { adminFetch } from '@/lib/adminApi';

export default function AdminSettingsPage() {
  // --- Password State ---
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // --- Maintenance Mode State ---
  const [maintenanceEnabled, setMaintenanceEnabled] = useState(false);
  const [maintenanceMessage, setMaintenanceMessage] = useState('We\'re upgrading our servers. Please check back shortly!');
  const [maintenanceLoading, setMaintenanceLoading] = useState(false);
  const [maintenanceSaved, setMaintenanceSaved] = useState(false);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [introEnabled, setIntroEnabled] = useState(true);
  const [introDownloadEnabled, setIntroDownloadEnabled] = useState(false);
  const [introUrl, setIntroUrl] = useState('/brand/anime-zone-intro-4k.mp4');
  const [introSaving, setIntroSaving] = useState(false);
  const [introMessage, setIntroMessage] = useState('');

  // --- Transcoding Toggle State ---
  const [transcodeEnabled, setTranscodeEnabled] = useState(true);
  const [transcodeLoading, setTranscodeLoading] = useState(false);
  const [transcodeSaved, setTranscodeSaved] = useState(false);

  // Load current settings on mount
  useEffect(() => {
    (async () => {
      try {
        const res = await adminFetch('/api/admin/settings');
        const data = await res.json();
        if (data.maintenance_mode === '1') setMaintenanceEnabled(true);
        if (data.maintenance_message) setMaintenanceMessage(data.maintenance_message);
        setIntroEnabled(data.video_intro_enabled !== '0');
        setIntroDownloadEnabled(data.video_intro_download_enabled === '1');
        if (data.video_intro_url) setIntroUrl(data.video_intro_url);
        setTranscodeEnabled(data.auto_transcode_enabled !== '0');
        setSettingsLoaded(true);
      } catch {
        setSettingsLoaded(true);
      }
    })();
  }, []);

  const saveIntroSettings = async (patch: Record<string, string>) => {
    setIntroSaving(true); setIntroMessage('');
    try {
      const res = await adminFetch('/api/admin/brand-intro', { method: 'POST', body: (() => { const f = new FormData(); Object.entries(patch).forEach(([k, v]) => f.append(k, v)); return f; })() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not save intro settings');
      setIntroEnabled(data.settings.video_intro_enabled !== '0');
      setIntroDownloadEnabled(data.settings.video_intro_download_enabled === '1');
      setIntroMessage('Intro settings saved.');
    } catch (error) { setIntroMessage(error instanceof Error ? error.message : 'Could not save intro settings'); }
    finally { setIntroSaving(false); }
  };

  const handleIntroUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; if (!file) return;
    const form = new FormData(); form.append('file', file);
    setIntroSaving(true); setIntroMessage('Uploading intro…');
    try {
      const res = await adminFetch('/api/admin/brand-intro', { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      if (data.video_intro_url) setIntroUrl(data.video_intro_url);
      setIntroMessage(data.settings.video_intro_enabled === '0' ? 'Custom intro uploaded. Turn on Website intro animation to play it before episodes.' : 'Custom intro uploaded. It will play before the next episode you start.');
    } catch (error) { setIntroMessage(error instanceof Error ? error.message : 'Upload failed'); }
    finally { setIntroSaving(false); event.target.value = ''; }
  };

  // Toggle maintenance mode
  const handleMaintenanceToggle = async () => {
    const newValue = !maintenanceEnabled;
    setMaintenanceLoading(true);
    setMaintenanceSaved(false);
    try {
      const res = await adminFetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          maintenance_mode: newValue ? '1' : '0',
          maintenance_message: maintenanceMessage,
        }),
      });
      if (res.ok) {
        setMaintenanceEnabled(newValue);
        setMaintenanceSaved(true);
        setTimeout(() => setMaintenanceSaved(false), 3000);
      }
    } catch {
      // Error handling
    } finally {
      setMaintenanceLoading(false);
    }
  };

  // Save maintenance message
  const handleSaveMessage = async () => {
    setMaintenanceLoading(true);
    setMaintenanceSaved(false);
    try {
      const res = await adminFetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          maintenance_message: maintenanceMessage,
        }),
      });
      if (res.ok) {
        setMaintenanceSaved(true);
        setTimeout(() => setMaintenanceSaved(false), 3000);
      }
    } catch {}
    finally {
      setMaintenanceLoading(false);
    }
  };

  // Toggle transcoding
  const handleTranscodeToggle = async () => {
    const newValue = !transcodeEnabled;
    setTranscodeLoading(true);
    setTranscodeSaved(false);
    try {
      const res = await adminFetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ auto_transcode_enabled: newValue ? '1' : '0' }),
      });
      if (res.ok) {
        setTranscodeEnabled(newValue);
        setTranscodeSaved(true);
        setTimeout(() => setTranscodeSaved(false), 3000);
      }
    } catch {}
    finally {
      setTranscodeLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (newPassword.length < 6) {
      setMessage({ type: 'error', text: 'New password must be at least 6 characters' });
      return;
    }

    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'New password and confirm password do not match' });
      return;
    }

    setLoading(true);
    try {
      const res = await adminFetch('/api/admin/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const data = await res.json();
      if (res.ok) {
        setMessage({ type: 'success', text: 'Password changed successfully! Use your new password next time you login.' });
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to change password' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Network error. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8 pb-12">
      <div>
        <h1 className="text-3xl font-bold text-white">Settings</h1>
        <p className="text-xs text-slate-400 mt-1">Admin account settings, security & site controls</p>
      </div>

      {/* ═══════════════ Auto-Transcoding Toggle Card ═══════════════ */}
      <div className={`rounded-2xl border overflow-hidden transition-all duration-300 ${transcodeEnabled ? 'bg-[#1a1a2e] border-cyan-500/30' : 'bg-slate-950/40 border-slate-800'}`}>
        <div className="p-6 border-b border-slate-800/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl transition-colors ${transcodeEnabled ? 'bg-cyan-500/20 text-cyan-400' : 'bg-slate-700/30 text-slate-500'}`}>
              <Clapperboard size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Auto Transcoding (HLS)</h2>
              <p className="text-xs text-slate-400">Convert uploaded videos to multi-quality HLS (360p/720p/1080p)</p>
            </div>
          </div>

          {/* Toggle Switch */}
          <button
            onClick={handleTranscodeToggle}
            disabled={transcodeLoading || !settingsLoaded}
            className={`relative inline-flex h-8 w-[60px] items-center rounded-full transition-all duration-300 focus:outline-none disabled:opacity-50 ${transcodeEnabled ? 'bg-cyan-500 shadow-lg shadow-cyan-500/30' : 'bg-slate-700'}`}
          >
            <span className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform duration-300 shadow-md ${transcodeEnabled ? 'translate-x-[34px]' : 'translate-x-[2px]'}`} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Status indicator */}
          <div className={`flex items-center gap-2 text-sm font-medium ${transcodeEnabled ? 'text-cyan-400' : 'text-slate-500'}`}>
            <Power size={14} />
            <span>
              {transcodeEnabled
                ? '🟢 ON — Videos will auto-convert to multi-quality HLS after upload'
                : '🔴 OFF — Videos will be served as original file (no multi-quality)'}
            </span>
          </div>

          {transcodeSaved && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm flex items-center gap-2">
              <CheckCircle2 size={14} />
              Transcoding setting saved!
            </div>
          )}

          {/* Info box */}
          <div className="p-4 rounded-xl bg-slate-800/30 border border-slate-700/50 text-xs text-slate-400 space-y-1">
            <p className="font-semibold text-slate-300 mb-2">ℹ️ How it works:</p>
            <p>🎬 <strong className="text-slate-300">ON:</strong> After upload, FFmpeg creates 360p + 720p + 1080p HLS streams (uses CPU)</p>
            <p>⚡ <strong className="text-slate-300">OFF:</strong> Videos are served as-is, no CPU-heavy transcoding (faster uploads)</p>
            <p>💡 <strong className="text-slate-300">Tip:</strong> Turn OFF when uploading many videos, then run <code className="px-1.5 py-0.5 bg-slate-800 rounded text-cyan-300">npm run transcode</code> later to batch-process</p>
          </div>
        </div>
      </div>

      {/* ═══════════════ Maintenance Mode Card ═══════════════ */}
      <div className={`rounded-2xl border overflow-hidden transition-all duration-300 ${maintenanceEnabled ? 'bg-red-950/30 border-red-500/40' : 'bg-[#1a1a2e] border-slate-800'}`}>
        <div className="p-6 border-b border-slate-800/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl transition-colors ${maintenanceEnabled ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
              <ShieldAlert size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Maintenance Mode</h2>
              <p className="text-xs text-slate-400">Take the user-facing site offline temporarily</p>
            </div>
          </div>

          {/* Toggle Switch */}
          <button
            onClick={handleMaintenanceToggle}
            disabled={maintenanceLoading || !settingsLoaded}
            className={`relative inline-flex h-8 w-[60px] items-center rounded-full transition-all duration-300 focus:outline-none disabled:opacity-50 ${maintenanceEnabled ? 'bg-red-500 shadow-lg shadow-red-500/30' : 'bg-slate-700'}`}
          >
            <span className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform duration-300 shadow-md ${maintenanceEnabled ? 'translate-x-[34px]' : 'translate-x-[2px]'}`} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Status indicator */}
          <div className={`flex items-center gap-2 text-sm font-medium ${maintenanceEnabled ? 'text-red-400' : 'text-emerald-400'}`}>
            <Power size={14} />
            <span>
              {maintenanceEnabled
                ? '🔴 Site is OFFLINE — Users see maintenance page'
                : '🟢 Site is ONLINE — Users can browse normally'}
            </span>
          </div>

          {maintenanceSaved && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm flex items-center gap-2">
              <CheckCircle2 size={14} />
              Settings saved! Changes take effect within 5 seconds.
            </div>
          )}

          {/* Custom message */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Maintenance Message <span className="text-slate-500 font-normal">(shown to users)</span>
            </label>
            <textarea
              value={maintenanceMessage}
              onChange={(e) => setMaintenanceMessage(e.target.value)}
              rows={3}
              placeholder="Tell users why the site is down and when it'll be back..."
              className="w-full bg-[#0f0f1a] border border-slate-800 rounded-xl p-3 text-white text-sm focus:outline-none focus:border-violet-500 transition-colors resize-none"
            />
            <button
              onClick={handleSaveMessage}
              disabled={maintenanceLoading}
              className="mt-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              {maintenanceLoading ? 'Saving...' : 'Save Message'}
            </button>
          </div>

          {/* What stays accessible info */}
          {maintenanceEnabled && (
            <div className="p-4 rounded-xl bg-slate-800/30 border border-slate-700/50 text-xs text-slate-400 space-y-1">
              <p className="font-semibold text-slate-300 mb-2">ℹ️ While maintenance is active:</p>
              <p>✅ Admin panel works normally (you can manage everything)</p>
              <p>✅ All admin API endpoints remain accessible</p>
              <p>🚫 Users see a beautiful maintenance page instead of the site</p>
              <p>🔄 Users are auto-redirected back when you turn this off</p>
            </div>
          )}
        </div>
      </div>

      <div className="bg-[#1a1a2e] rounded-2xl border border-orange-500/20 overflow-hidden">
        <div className="p-6 border-b border-slate-800 flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-orange-500/10 text-orange-400"><Film size={20} /></div>
          <div><h2 className="text-lg font-bold text-white">Video Intro</h2><p className="text-xs text-slate-400">Play before every unlocked episode</p></div>
        </div>
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between gap-4"><div><p className="text-sm font-medium text-white">Website intro animation</p><p className="text-xs text-slate-400">Login and key/VIP checks still happen first.</p></div><button role="switch" aria-label="Website intro animation" aria-checked={introEnabled} disabled={introSaving || !settingsLoaded} onClick={() => saveIntroSettings({ enabled: introEnabled ? '0' : '1' })} className={`relative inline-flex h-8 w-[60px] items-center rounded-full ${introEnabled ? 'bg-orange-500' : 'bg-slate-700'}`}><span className={`inline-block h-6 w-6 rounded-full bg-white transition-transform ${introEnabled ? 'translate-x-[34px]' : 'translate-x-[2px]'}`} /></button></div>
          <div className="flex items-center justify-between gap-4"><div><p className="text-sm font-medium text-white">Add intro to downloads</p><p className="text-xs text-slate-400">Only local MP4/WebM downloads can be joined on the VPS.</p></div><button role="switch" aria-label="Add intro to downloads" aria-checked={introDownloadEnabled} disabled={introSaving || !settingsLoaded} onClick={() => saveIntroSettings({ downloadEnabled: introDownloadEnabled ? '0' : '1' })} className={`relative inline-flex h-8 w-[60px] items-center rounded-full ${introDownloadEnabled ? 'bg-emerald-500' : 'bg-slate-700'}`}><span className={`inline-block h-6 w-6 rounded-full bg-white transition-transform ${introDownloadEnabled ? 'translate-x-[34px]' : 'translate-x-[2px]'}`} /></button></div>
          <div className="rounded-xl border border-slate-800 bg-[#0f0f1a] p-4"><p className="text-xs text-slate-400 mb-2">Current intro file</p><p className="text-xs font-mono text-orange-300 break-all mb-3">{introUrl}</p><label className="inline-flex items-center gap-2 cursor-pointer px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm text-white"><Upload size={15} /> Upload MP4/WebM<input type="file" accept="video/mp4,video/webm" onChange={handleIntroUpload} className="hidden" /></label></div>
          {introMessage && <p className="text-xs text-emerald-400">{introMessage}</p>}
          <video key={introUrl} src={introUrl} controls playsInline preload="metadata" aria-label="Selected intro preview" className="w-full aspect-video rounded-xl bg-black" />
        </div>
      </div>

      {/* ═══════════════ Change Password Card ═══════════════ */}
      <div className="bg-[#1a1a2e] rounded-2xl border border-slate-800 overflow-hidden">
        <div className="p-6 border-b border-slate-800 flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-violet-500/10 text-violet-400">
            <Lock size={20} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Change Password</h2>
            <p className="text-xs text-slate-400">Update your admin login password</p>
          </div>
        </div>

        <form onSubmit={handleChangePassword} className="p-6 space-y-5">
          {message && (
            <div className={`p-4 rounded-xl flex items-center gap-2 text-sm ${message.type === 'success' ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400' : 'bg-red-500/10 border border-red-500/30 text-red-400'}`}>
              {message.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
              {message.text}
            </div>
          )}

          {/* Current Password */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Current Password</label>
            <div className="relative">
              <input
                type={showCurrent ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                placeholder="Enter current password"
                className="w-full bg-[#0f0f1a] border border-slate-800 rounded-xl p-3 pr-12 text-white focus:outline-none focus:border-violet-500 transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowCurrent(!showCurrent)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                {showCurrent ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* New Password */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">New Password</label>
            <div className="relative">
              <input
                type={showNew ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={6}
                placeholder="Minimum 6 characters"
                className="w-full bg-[#0f0f1a] border border-slate-800 rounded-xl p-3 pr-12 text-white focus:outline-none focus:border-violet-500 transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                {showNew ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* Confirm Password */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Confirm New Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              placeholder="Re-enter new password"
              className={`w-full bg-[#0f0f1a] border rounded-xl p-3 text-white focus:outline-none transition-colors ${confirmPassword && confirmPassword !== newPassword ? 'border-red-500' : 'border-slate-800 focus:border-violet-500'}`}
            />
            {confirmPassword && confirmPassword !== newPassword && (
              <p className="text-red-400 text-xs mt-1">Passwords do not match</p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading || !currentPassword || !newPassword || newPassword !== confirmPassword}
            className="w-full py-3 bg-violet-600 hover:bg-violet-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-violet-600/20 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Changing Password...' : 'Change Password'}
          </button>
        </form>
      </div>
    </div>
  );
}
