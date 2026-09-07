'use client';
import { useState } from 'react';
import { Lock, Eye, EyeOff, CheckCircle2, AlertTriangle } from 'lucide-react';
import { adminFetch } from '@/lib/adminApi';

export default function AdminSettingsPage() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

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
        <p className="text-xs text-slate-400 mt-1">Admin account settings & security</p>
      </div>

      {/* Change Password Card */}
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
