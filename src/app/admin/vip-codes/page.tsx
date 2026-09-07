'use client';

import { useState, useEffect, useCallback } from 'react';
import { adminFetch } from '@/lib/adminApi';
import {
  Ticket,
  Sparkles,
  Crown,
  CheckCircle2,
  AlertTriangle,
  Trash2,
  Copy,
  Check,
  RefreshCw,
  Search,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Calendar,
  UserCheck,
  Link as LinkIcon,
  ShieldCheck,
} from 'lucide-react';

interface VipCodeRow {
  id: number;
  code: string;
  duration_days: number;
  is_used: number;
  used_by_user_id: number | null;
  used_by_username: string | null;
  used_at: string | null;
  created_at: string;
  notes: string | null;
}

export default function AdminVipCodesPage() {
  const [loading, setLoading] = useState(true);
  const [codes, setCodes] = useState<VipCodeRow[]>([]);
  const [totalCodes, setTotalCodes] = useState(0);

  // Store link state
  const [storeUrl, setStoreUrl] = useState('https://t.me/');
  const [savingStore, setSavingStore] = useState(false);
  const [storeNotice, setStoreNotice] = useState<string | null>(null);

  // Code generation state
  const [genCount, setGenCount] = useState(5);
  const [genDuration, setGenDuration] = useState(30);
  const [genNotes, setGenNotes] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedList, setGeneratedList] = useState<string[]>([]);
  const [copiedAll, setCopiedAll] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Filters & pagination
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'unused' | 'used'>('all');
  const [page, setPage] = useState(1);
  const limit = 25;

  // Load store link setting
  const loadStoreSettings = useCallback(async () => {
    try {
      const res = await adminFetch('/api/admin/vip-codes/settings');
      if (res.ok) {
        const data = await res.json();
        if (data.vip_store_url) {
          setStoreUrl(data.vip_store_url);
        }
      }
    } catch (err) {
      console.error('Failed to fetch store settings:', err);
    }
  }, []);

  // Save store link
  const handleSaveStore = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingStore(true);
    setStoreNotice(null);
    try {
      const res = await adminFetch('/api/admin/vip-codes/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vip_store_url: storeUrl }),
      });
      const data = await res.json();
      if (res.ok) {
        setStoreNotice('VIP Store link saved successfully!');
      } else {
        setStoreNotice(`Error: ${data.error || 'Failed to save'}`);
      }
    } catch (err: any) {
      setStoreNotice(`Error: ${err.message}`);
    } finally {
      setSavingStore(false);
      setTimeout(() => setStoreNotice(null), 4000);
    }
  };

  // Load codes
  const loadCodes = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        status: statusFilter,
        search: search.trim(),
      });
      const res = await adminFetch(`/api/admin/vip-codes?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setCodes(data.codes || []);
        setTotalCodes(data.total || 0);
      }
    } catch (err) {
      console.error('Failed to load VIP codes:', err);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, search]);

  useEffect(() => {
    loadStoreSettings();
  }, [loadStoreSettings]);

  useEffect(() => {
    loadCodes();
  }, [loadCodes]);

  // Generate codes
  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsGenerating(true);
    try {
      const res = await adminFetch('/api/admin/vip-codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          count: genCount,
          duration_days: genDuration,
          notes: genNotes,
        }),
      });
      const data = await res.json();
      if (res.ok && data.codes) {
        setGeneratedList(data.codes);
        setGenNotes('');
        loadCodes();
      } else {
        alert(data.error || 'Failed to generate VIP codes');
      }
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  // Delete code
  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this VIP code?')) return;
    try {
      const res = await adminFetch(`/api/admin/vip-codes/${id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        loadCodes();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to delete code');
      }
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  // Copy helper
  const copyToClipboard = (text: string, codeStr?: string) => {
    navigator.clipboard.writeText(text);
    if (codeStr) {
      setCopiedCode(codeStr);
      setTimeout(() => setCopiedCode(null), 2000);
    } else {
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 2000);
    }
  };

  const totalPages = Math.ceil(totalCodes / limit) || 1;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2.5 text-white">
            <Ticket className="text-amber-400" size={28} />
            VIP Subscription Redeem Codes
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Generate single-use 1-month VIP codes, manage redemptions, and configure your VIP store link.
          </p>
        </div>
        <button
          onClick={() => {
            loadCodes();
            loadStoreSettings();
          }}
          disabled={loading}
          className="flex items-center gap-2 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm rounded-lg border border-slate-700 transition"
        >
          <RefreshCw size={15} className={loading ? 'animate-spin text-amber-400' : ''} />
          Refresh
        </button>
      </div>

      {/* Top Grid: Store Settings & Code Generator */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 1. VIP Store Link Settings */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 flex flex-col justify-between shadow-lg">
          <div>
            <div className="flex items-center gap-2.5 mb-2">
              <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
                <LinkIcon size={20} />
              </div>
              <h2 className="text-lg font-semibold text-white">VIP Store Link Configuration</h2>
            </div>
            <p className="text-xs text-slate-400 mb-4">
              When users click <span className="text-amber-300 font-medium">"Buy VIP Code"</span> on their account page, they will be redirected to this link (e.g. your Telegram contact, channel, or payment store).
            </p>

            <form onSubmit={handleSaveStore} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Store / Contact Link URL
                </label>
                <div className="relative">
                  <input
                    type="url"
                    value={storeUrl}
                    onChange={(e) => setStoreUrl(e.target.value)}
                    placeholder="https://t.me/YourTelegramChannel"
                    required
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500 transition"
                  />
                </div>
              </div>

              {storeNotice && (
                <div
                  className={`text-xs px-3 py-2 rounded-lg border ${
                    storeNotice.startsWith('Error')
                      ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                      : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                  }`}
                >
                  {storeNotice}
                </div>
              )}

              <div className="flex items-center justify-between pt-2">
                <a
                  href={storeUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-300 underline"
                >
                  Test Link <ExternalLink size={13} />
                </a>
                <button
                  type="submit"
                  disabled={savingStore}
                  className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-semibold text-sm rounded-lg flex items-center gap-2 transition disabled:opacity-50"
                >
                  {savingStore && <Loader2 size={16} className="animate-spin" />}
                  Save Store Link
                </button>
              </div>
            </form>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800 text-[11px] text-slate-500 flex items-center gap-1.5">
            <ShieldCheck size={14} className="text-emerald-400" />
            Users can directly purchase from you and redeem their single-use code instantly.
          </div>
        </div>

        {/* 2. Generate Single-Use VIP Codes */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-lg">
          <div className="flex items-center gap-2.5 mb-2">
            <div className="p-2 rounded-lg bg-violet-500/10 text-violet-400">
              <Sparkles size={20} />
            </div>
            <h2 className="text-lg font-semibold text-white">Generate VIP Codes</h2>
          </div>
          <p className="text-xs text-slate-400 mb-4">
            Codes format: <span className="font-mono text-amber-400">VIP-XXXX-XXXX-XXXX</span>. Each code is 100% single-use and extends the user's VIP membership.
          </p>

          <form onSubmit={handleGenerate} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Quantity
                </label>
                <select
                  value={genCount}
                  onChange={(e) => setGenCount(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500"
                >
                  <option value={1}>1 Code</option>
                  <option value={5}>5 Codes</option>
                  <option value={10}>10 Codes</option>
                  <option value={20}>20 Codes</option>
                  <option value={50}>50 Codes</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Validity Duration
                </label>
                <select
                  value={genDuration}
                  onChange={(e) => setGenDuration(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500"
                >
                  <option value={30}>30 Days (1 Month)</option>
                  <option value={60}>60 Days (2 Months)</option>
                  <option value={90}>90 Days (3 Months)</option>
                  <option value={180}>180 Days (6 Months)</option>
                  <option value={365}>365 Days (1 Year)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Note / Batch Tag (Optional)
              </label>
              <input
                type="text"
                value={genNotes}
                onChange={(e) => setGenNotes(e.target.value)}
                placeholder="e.g. Telegram Sale / User Rahul / Promo"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500"
              />
            </div>

            <button
              type="submit"
              disabled={isGenerating}
              className="w-full py-2.5 bg-violet-600 hover:bg-violet-500 text-white font-medium text-sm rounded-lg flex items-center justify-center gap-2 transition disabled:opacity-50"
            >
              {isGenerating ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Ticket size={16} />
                  Generate VIP Codes
                </>
              )}
            </button>
          </form>

          {/* Newly Generated Codes Popup/Display */}
          {generatedList.length > 0 && (
            <div className="mt-4 p-3 bg-violet-950/40 border border-violet-700/50 rounded-lg space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-violet-300 flex items-center gap-1.5">
                  <CheckCircle2 size={14} className="text-emerald-400" />
                  {generatedList.length} Code(s) Created:
                </span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(generatedList.join('\n'))}
                  className="inline-flex items-center gap-1 text-violet-400 hover:text-white font-mono text-[11px]"
                >
                  {copiedAll ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                  {copiedAll ? 'Copied All!' : 'Copy All'}
                </button>
              </div>
              <div className="max-h-28 overflow-y-auto space-y-1 pr-1 font-mono text-xs">
                {generatedList.map((c) => (
                  <div
                    key={c}
                    className="flex items-center justify-between bg-slate-900/90 px-2.5 py-1.5 rounded border border-slate-800"
                  >
                    <span className="text-amber-400 font-bold">{c}</span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(c, c)}
                      className="text-slate-400 hover:text-white"
                    >
                      {copiedCode === c ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Codes Table Section */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl shadow-lg overflow-hidden">
        {/* Table Filters */}
        <div className="p-4 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-white flex items-center gap-1.5">
              <Crown size={17} className="text-amber-400" />
              VIP Codes ({totalCodes})
            </span>
            <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
              {(['all', 'unused', 'used'] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => {
                    setStatusFilter(st);
                    setPage(1);
                  }}
                  className={`px-3 py-1 rounded capitalize transition ${
                    statusFilter === st
                      ? 'bg-violet-600 text-white font-medium'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          <div className="relative min-w-[220px]">
            <Search className="absolute left-3 top-2.5 text-slate-500" size={15} />
            <input
              type="text"
              placeholder="Search code or user..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-violet-500"
            />
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/60 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Code</th>
                <th className="py-3 px-4">Duration</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Redeemed By</th>
                <th className="py-3 px-4">Redeemed Date</th>
                <th className="py-3 px-4">Notes</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    <Loader2 size={24} className="animate-spin mx-auto mb-2 text-violet-500" />
                    Loading VIP codes...
                  </td>
                </tr>
              ) : codes.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    No VIP codes found.
                  </td>
                </tr>
              ) : (
                codes.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-3 px-4 font-mono font-bold text-amber-400">
                      <div className="flex items-center gap-2">
                        <span>{c.code}</span>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(c.code, c.code)}
                          title="Copy Code"
                          className="text-slate-500 hover:text-white"
                        >
                          {copiedCode === c.code ? (
                            <Check size={13} className="text-emerald-400" />
                          ) : (
                            <Copy size={13} />
                          )}
                        </button>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center gap-1 text-slate-300">
                        <Calendar size={13} className="text-slate-500" />
                        {c.duration_days} Days
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {c.is_used === 1 ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
                          Redeemed
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          Available
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-medium text-white">
                      {c.used_by_username ? (
                        <span className="inline-flex items-center gap-1.5 text-violet-300">
                          <UserCheck size={14} className="text-violet-400" />
                          {c.used_by_username}
                        </span>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-400">
                      {c.used_at ? new Date(c.used_at).toLocaleDateString() : '—'}
                    </td>
                    <td className="py-3 px-4 text-slate-400 max-w-[150px] truncate" title={c.notes || ''}>
                      {c.notes || '—'}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => handleDelete(c.id)}
                        className="p-1.5 text-slate-500 hover:text-rose-400 rounded hover:bg-slate-800 transition"
                        title="Delete code"
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <span>
              Page {page} of {totalPages}
            </span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-30"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-30"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
