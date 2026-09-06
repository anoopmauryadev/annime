'use client';

import { useState, useEffect, useCallback } from 'react';
import { adminFetch } from '@/lib/adminApi';
import {
  Key,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Trash2,
  Ban,
  Copy,
  Check,
  RefreshCw,
  Search,
  Sliders,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Clock,
  Eye,
  EyeOff,
} from 'lucide-react';

interface KeyRow {
  id: number;
  key_code: string;
  claim_token: string | null;
  status: 'pending' | 'used' | 'revoked';
  duration_hours: number;
  activated_at: string | null;
  expires_at: string | null;
  created_at: string;
  used_by_username: string | null;
  used_by_email: string | null;
  creator_username: string | null;
}

export default function AdminKeysPage() {
  const [loading, setLoading] = useState(true);
  const [keys, setKeys] = useState<KeyRow[]>([]);
  const [totalKeys, setTotalKeys] = useState(0);

  // Settings state
  const [keySystemEnabled, setKeySystemEnabled] = useState(true);
  const [shortenerProvider, setShortenerProvider] = useState('gplinks');
  const [shortenerApiUrl, setShortenerApiUrl] = useState('https://api.gplinks.com/api');
  const [shortenerApiToken, setShortenerApiToken] = useState('');
  const [sitePublicUrl, setSitePublicUrl] = useState('');
  const [keyDurationHours, setKeyDurationHours] = useState('48');
  const [showToken, setShowToken] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsNotice, setSettingsNotice] = useState<string | null>(null);
  const [testingToken, setTestingToken] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; shortenedUrl?: string } | null>(null);

  // Key Generation state
  const [genCount, setGenCount] = useState(5);
  const [genDuration, setGenDuration] = useState(48);
  const [customCode, setCustomCode] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedList, setGeneratedList] = useState<string[]>([]);
  const [copiedAll, setCopiedAll] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Table filters & pagination
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const limit = 20;

  // Load site settings
  const loadSettings = useCallback(async () => {
    try {
      const res = await adminFetch('/api/admin/settings');
      if (res.ok) {
        const data = await res.json();
        setKeySystemEnabled(data.key_system_enabled !== '0');
        setShortenerProvider(data.shortener_provider || 'gplinks');
        setShortenerApiUrl(data.shortener_api_url || 'https://api.gplinks.com/api');
        setShortenerApiToken(data.shortener_api_token || '');
        setSitePublicUrl(data.site_public_url || '');
        setKeyDurationHours(data.key_duration_hours || '48');
      }
    } catch (err) {
      console.error('Failed to fetch settings:', err);
    }
  }, []);

  // Load keys list
  const loadKeys = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        status: statusFilter,
        search: search.trim(),
      });
      const res = await adminFetch(`/api/admin/keys?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setKeys(data.keys || []);
        setTotalKeys(data.total || 0);
      }
    } catch (err) {
      console.error('Failed to fetch keys:', err);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, search]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    loadKeys();
  }, [loadKeys]);

  // Instant Toggle System ON / OFF
  const handleToggleSystem = async () => {
    const nextState = !keySystemEnabled;
    setKeySystemEnabled(nextState);
    try {
      await adminFetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key_system_enabled: nextState ? '1' : '0',
        }),
      });
      setSettingsNotice(nextState ? 'Key System is now ACTIVE.' : 'Key System is now PAUSED (All users can stream directly).');
      setTimeout(() => setSettingsNotice(null), 4000);
    } catch {
      setKeySystemEnabled(!nextState);
      alert('Failed to update system state');
    }
  };

  // Test Shortener Token Connection directly
  const handleTestShortener = async () => {
    if (!shortenerApiToken.trim()) {
      setTestResult({ success: false, message: 'Please enter your GPLinks API token above first.' });
      return;
    }
    setTestingToken(true);
    setTestResult(null);
    try {
      const res = await adminFetch('/api/admin/keys/test-shortener', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_url: shortenerApiUrl,
          api_token: shortenerApiToken,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setTestResult({
          success: true,
          message: 'GPLinks API Connected successfully! Real shortened link created:',
          shortenedUrl: data.shortenedUrl,
        });
      } else {
        setTestResult({
          success: false,
          message: data.error || 'Failed to connect with GPLinks API.',
        });
      }
    } catch {
      setTestResult({ success: false, message: 'Failed to communicate with test server.' });
    } finally {
      setTestingToken(false);
    }
  };

  // Save Settings
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    setSettingsNotice(null);

    try {
      const res = await adminFetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key_system_enabled: keySystemEnabled ? '1' : '0',
          shortener_provider: shortenerProvider,
          shortener_api_url: shortenerApiUrl,
          shortener_api_token: shortenerApiToken,
          site_public_url: sitePublicUrl.trim(),
          key_duration_hours: keyDurationHours,
        }),
      });

      if (res.ok) {
        setSettingsNotice('Key System settings saved successfully!');
        setTimeout(() => setSettingsNotice(null), 4000);
      } else {
        setSettingsNotice('Error saving settings.');
      }
    } catch {
      setSettingsNotice('Failed to connect to server.');
    } finally {
      setSavingSettings(false);
    }
  };

  // Generate Keys
  const handleGenerateKeys = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsGenerating(true);
    try {
      const res = await adminFetch('/api/admin/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          count: customCode.trim() ? 1 : genCount,
          duration_hours: genDuration,
          custom_code: customCode.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (res.ok && data.keys) {
        setGeneratedList(data.keys);
        setCustomCode('');
        loadKeys();
      } else {
        alert(data.error || 'Failed to generate keys');
      }
    } catch {
      alert('Error generating keys');
    } finally {
      setIsGenerating(false);
    }
  };

  // Revoke Key
  const handleRevoke = async (id: number) => {
    if (!confirm('Are you sure you want to revoke this key? It will immediately stop working.')) return;
    try {
      const res = await adminFetch('/api/admin/keys', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        loadKeys();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Delete Key
  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to permanently delete this key from the database?')) return;
    try {
      const res = await adminFetch('/api/admin/keys', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        loadKeys();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(text);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const copyAllGenerated = () => {
    navigator.clipboard.writeText(generatedList.join('\n'));
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  };

  const totalPages = Math.ceil(totalKeys / limit) || 1;

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Top Header */}
      <div>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold uppercase tracking-wider mb-2">
          <Sparkles className="w-3.5 h-3.5" /> 48-Hour Automated Monetization
        </div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white flex items-center gap-3">
          <Key className="text-amber-400" /> Key Subscription System
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Automate user access gating via high-CPM URL Shorteners (GPLinks, ShrinkMe) or generate manual keys for users.
        </p>
      </div>

      {/* Grid: Settings & Generator */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Shortener & System Settings (7 cols) */}
        <div className="lg:col-span-7 bg-[#1a1a2e] border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
            <div className="flex items-center gap-2.5">
              <Sliders className="text-violet-400 w-5 h-5" />
              <h2 className="text-base font-bold text-white">System & Shortener Setup</h2>
            </div>

            {/* Master Toggle */}
            <button
              type="button"
              onClick={handleToggleSystem}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all shadow-md flex items-center gap-2 ${
                keySystemEnabled
                  ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/30'
                  : 'bg-rose-500/20 border border-rose-500/40 text-rose-300 hover:bg-rose-500/30'
              }`}
            >
              <div
                className={`w-2.5 h-2.5 rounded-full ${
                  keySystemEnabled ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'
                }`}
              />
              <span>{keySystemEnabled ? 'SYSTEM: ON' : 'SYSTEM: OFF'}</span>
            </button>
          </div>

          <form onSubmit={handleSaveSettings} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Shortener Provider
                </label>
                <select
                  value={shortenerProvider}
                  onChange={(e) => {
                    const prov = e.target.value;
                    setShortenerProvider(prov);
                    if (prov === 'gplinks') setShortenerApiUrl('https://api.gplinks.com/api');
                    else if (prov === 'shrinkme') setShortenerApiUrl('https://shrinkme.io/api');
                    else if (prov === 'droplink') setShortenerApiUrl('https://droplink.co/api');
                  }}
                  className="w-full bg-[#0f0f1a] border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white focus:border-violet-500 focus:outline-none"
                >
                  <option value="gplinks">GPLinks.com (Top CPM / High Earnings)</option>
                  <option value="shrinkme">ShrinkMe.io (High Global CPM)</option>
                  <option value="droplink">Droplink.co</option>
                  <option value="custom">Custom Shortener API</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Access Validity (Hours)
                </label>
                <select
                  value={keyDurationHours}
                  onChange={(e) => setKeyDurationHours(e.target.value)}
                  className="w-full bg-[#0f0f1a] border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white focus:border-violet-500 focus:outline-none"
                >
                  <option value="24">24 Hours (1 Day)</option>
                  <option value="48">48 Hours (2 Days) - Recommended</option>
                  <option value="72">72 Hours (3 Days)</option>
                  <option value="168">168 Hours (7 Days)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                API Endpoint URL
              </label>
              <input
                type="text"
                value={shortenerApiUrl}
                onChange={(e) => setShortenerApiUrl(e.target.value)}
                placeholder="https://api.gplinks.com/api"
                className="w-full bg-[#0f0f1a] border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono focus:border-violet-500 focus:outline-none"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-300">
                  Publisher API Token
                </label>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleTestShortener}
                    disabled={testingToken || !shortenerApiToken}
                    className="text-[11px] font-semibold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 disabled:opacity-40"
                  >
                    {testingToken ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                    Test Token Now
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowToken(!showToken)}
                    className="text-[11px] text-slate-400 hover:text-slate-200 flex items-center gap-1"
                  >
                    {showToken ? <EyeOff size={13} /> : <Eye size={13} />}
                    {showToken ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>
              <input
                type={showToken ? 'text' : 'password'}
                value={shortenerApiToken}
                onChange={(e) => setShortenerApiToken(e.target.value)}
                placeholder="Paste your API token from GPLinks Developers API tool"
                className="w-full bg-[#0f0f1a] border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono focus:border-violet-500 focus:outline-none"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                * Note: If token is left empty, the site runs in Test Mode (redirects directly to verify page without ads).
              </p>
            </div>

            {/* Test Token Live Result Display */}
            {testResult && (
              <div
                className={`p-3 rounded-xl border text-xs flex flex-col gap-1.5 ${
                  testResult.success
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                    : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                }`}
              >
                <div className="flex items-center gap-2 font-semibold">
                  {testResult.success ? (
                    <CheckCircle2 size={15} className="text-emerald-400" />
                  ) : (
                    <AlertTriangle size={15} className="text-rose-400" />
                  )}
                  <span>{testResult.message}</span>
                </div>
                {testResult.shortenedUrl && (
                  <div className="flex items-center gap-2 pl-6 mt-0.5">
                    <span className="text-[11px] text-slate-400">Short URL:</span>
                    <a
                      href={testResult.shortenedUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="font-mono text-xs text-emerald-400 hover:underline flex items-center gap-1"
                    >
                      {testResult.shortenedUrl}
                      <ExternalLink size={11} />
                    </a>
                  </div>
                )}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Site Public Domain (Optional)
              </label>
              <input
                type="text"
                value={sitePublicUrl}
                onChange={(e) => setSitePublicUrl(e.target.value)}
                placeholder="e.g. https://youranimedomain.com (leave blank for local auto-detect)"
                className="w-full bg-[#0f0f1a] border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono focus:border-violet-500 focus:outline-none"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                * When running on localhost, it automatically maps to 127.0.0.1 so GPLinks validates destination URLs successfully.
              </p>
            </div>

            {settingsNotice && (
              <div className="p-2.5 rounded-xl bg-violet-500/15 border border-violet-500/30 text-xs text-violet-300 flex items-center gap-2">
                <CheckCircle2 size={14} className="text-violet-400" />
                {settingsNotice}
              </div>
            )}

            <button
              type="submit"
              disabled={savingSettings}
              className="w-full py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-violet-600/20 transition disabled:opacity-50"
            >
              {savingSettings ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
              Save System Settings
            </button>
          </form>
        </div>

        {/* Key Generator Card (5 cols) */}
        <div className="lg:col-span-5 bg-[#1a1a2e] border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="border-b border-slate-800/80 pb-4">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Key className="text-amber-400 w-5 h-5" /> Generate Manual Keys
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Create single or bulk keys for Telegram giveaways, support, or manual VIP promos.
            </p>
          </div>

          <form onSubmit={handleGenerateKeys} className="space-y-3.5">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Key Count
                </label>
                <select
                  value={genCount}
                  onChange={(e) => setGenCount(Number(e.target.value))}
                  disabled={!!customCode.trim()}
                  className="w-full bg-[#0f0f1a] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:border-amber-500 focus:outline-none disabled:opacity-40"
                >
                  <option value="1">1 Key</option>
                  <option value="5">5 Keys</option>
                  <option value="10">10 Keys</option>
                  <option value="25">25 Keys</option>
                  <option value="50">50 Keys</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Validity
                </label>
                <select
                  value={genDuration}
                  onChange={(e) => setGenDuration(Number(e.target.value))}
                  className="w-full bg-[#0f0f1a] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:border-amber-500 focus:outline-none"
                >
                  <option value="24">24 Hours</option>
                  <option value="48">48 Hours</option>
                  <option value="72">72 Hours</option>
                  <option value="168">7 Days</option>
                  <option value="720">30 Days</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Custom Key Code (Optional)
              </label>
              <input
                type="text"
                value={customCode}
                onChange={(e) => setCustomCode(e.target.value.toUpperCase())}
                placeholder="e.g. AZ-GIVEAWAY-2026"
                className="w-full bg-[#0f0f1a] border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white font-mono focus:border-amber-500 focus:outline-none uppercase"
              />
            </div>

            <button
              type="submit"
              disabled={isGenerating}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-neutral-950 font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition disabled:opacity-50"
            >
              {isGenerating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
              Generate {customCode.trim() ? '1 Custom Key' : `${genCount} Keys`}
            </button>
          </form>

          {/* Newly Generated Keys Display */}
          {generatedList.length > 0 && (
            <div className="mt-4 bg-[#0f0f1a] border border-amber-500/30 rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-amber-400">
                  🎉 {generatedList.length} New Keys Generated:
                </span>
                <button
                  type="button"
                  onClick={copyAllGenerated}
                  className="px-2 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-semibold text-[11px] flex items-center gap-1 transition"
                >
                  {copiedAll ? <Check size={12} /> : <Copy size={12} />}
                  {copiedAll ? 'Copied All' : 'Copy All'}
                </button>
              </div>
              <div className="max-h-32 overflow-y-auto space-y-1 font-mono text-xs text-slate-300 pr-1">
                {generatedList.map((code) => (
                  <div
                    key={code}
                    className="flex items-center justify-between py-0.5 px-1.5 rounded hover:bg-white/5"
                  >
                    <span>{code}</span>
                    <button
                      onClick={() => copyToClipboard(code)}
                      className="text-slate-400 hover:text-white"
                    >
                      {copiedKey === code ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Access Keys Management Table */}
      <div className="bg-[#1a1a2e] border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
        {/* Table Controls */}
        <div className="p-4 border-b border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-white">All Access Keys</span>
            <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 text-xs font-mono">
              {totalKeys}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
            {/* Search */}
            <div className="relative flex-1 sm:w-64">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Search key, user, email..."
                className="w-full bg-[#0f0f1a] border border-slate-700 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-violet-500"
              />
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="bg-[#0f0f1a] border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-violet-500"
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending (Unused)</option>
              <option value="used">Used (Redeemed)</option>
              <option value="revoked">Revoked</option>
            </select>

            {/* Refresh */}
            <button
              onClick={() => loadKeys()}
              className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
              title="Refresh"
            >
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* Table View */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#0f0f1a] text-slate-400 uppercase text-[11px] font-bold tracking-wider border-b border-slate-800">
              <tr>
                <th className="px-5 py-3.5">Key Code</th>
                <th className="px-4 py-3.5">Status</th>
                <th className="px-4 py-3.5">Duration</th>
                <th className="px-4 py-3.5">Redeemed By</th>
                <th className="px-4 py-3.5">Expires At</th>
                <th className="px-4 py-3.5">Created</th>
                <th className="px-4 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading && keys.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-slate-500">
                    <Loader2 size={24} className="animate-spin mx-auto mb-2 text-violet-400" />
                    Loading access keys...
                  </td>
                </tr>
              ) : keys.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-slate-500">
                    No keys found matching your criteria.
                  </td>
                </tr>
              ) : (
                keys.map((k) => (
                  <tr key={k.id} className="hover:bg-white/[0.02] transition">
                    {/* Key Code */}
                    <td className="px-5 py-3 font-mono font-bold text-white whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span>{k.key_code}</span>
                        <button
                          onClick={() => copyToClipboard(k.key_code)}
                          className="text-slate-500 hover:text-slate-300 transition"
                          title="Copy Key Code"
                        >
                          {copiedKey === k.key_code ? (
                            <Check size={13} className="text-emerald-400" />
                          ) : (
                            <Copy size={13} />
                          )}
                        </button>
                      </div>
                    </td>

                    {/* Status Badge */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      {k.status === 'used' ? (
                        <span className="px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold">
                          REDEEMED
                        </span>
                      ) : k.status === 'revoked' ? (
                        <span className="px-2.5 py-1 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-400 text-[10px] font-bold">
                          REVOKED
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 text-[10px] font-bold">
                          PENDING
                        </span>
                      )}
                    </td>

                    {/* Duration */}
                    <td className="px-4 py-3 text-slate-300 whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        <Clock size={12} className="text-slate-500" />
                        <span>{k.duration_hours}h</span>
                      </div>
                    </td>

                    {/* Redeemed By */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      {k.used_by_username ? (
                        <div>
                          <div className="font-semibold text-white">{k.used_by_username}</div>
                          <div className="text-[10px] text-slate-500">{k.used_by_email}</div>
                        </div>
                      ) : (
                        <span className="text-slate-600 font-mono text-[11px]">—</span>
                      )}
                    </td>

                    {/* Expires At */}
                    <td className="px-4 py-3 text-slate-400 whitespace-nowrap text-[11px]">
                      {k.expires_at ? k.expires_at.replace('T', ' ') : '—'}
                    </td>

                    {/* Created */}
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap text-[11px]">
                      {k.created_at ? k.created_at.replace('T', ' ') : '—'}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        {k.status !== 'revoked' && (
                          <button
                            onClick={() => handleRevoke(k.id)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition"
                            title="Revoke Key"
                          >
                            <Ban size={13} />
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(k.id)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition"
                          title="Delete Key"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="p-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <div>
            Showing Page <strong>{page}</strong> of <strong>{totalPages}</strong> ({totalKeys} total keys)
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white disabled:opacity-30 transition flex items-center gap-1"
            >
              <ChevronLeft size={14} /> Previous
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white disabled:opacity-30 transition flex items-center gap-1"
            >
              Next <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
