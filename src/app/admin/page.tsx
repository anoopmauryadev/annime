'use client';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Film, ListVideo, Eye, Star, PlusCircle, AlertTriangle, CheckCircle2, RefreshCw, Users, Crown } from 'lucide-react';
import { adminFetch } from '@/lib/adminApi';

interface Report {
  id: number;
  episode_id: number;
  server_id: number | null;
  issue_type: string;
  details: string;
  status: string;
  created_at: string;
  episode_number?: number;
  episode_title?: string;
  anime_title?: string;
  server_name?: string;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<any>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolvingId, setResolvingId] = useState<number | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const statsRes = await adminFetch('/api/admin/stats');
      const statsData = await statsRes.json();
      setStats(statsData);

      const reportsRes = await adminFetch('/api/admin/reports');
      if (reportsRes.ok) {
        const reportsData = await reportsRes.json();
        setReports(Array.isArray(reportsData) ? reportsData : []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const timer=setInterval(()=>{adminFetch('/api/admin/stats').then(async res=>{if(res.ok)setStats(await res.json());}).catch(()=>{});},15000);
    return ()=>clearInterval(timer);
  }, [fetchData]);

  const handleResolve = async (id: number) => {
    setResolvingId(id);
    try {
      const res = await adminFetch(`/api/admin/reports?id=${id}`, {
        method: 'PATCH',
      });
      if (res.ok) {
        setReports((prev) =>
          prev.map((r) => (r.id === id ? { ...r, status: 'resolved' } : r))
        );
      }
    } catch {
      alert('Failed to resolve report');
    } finally {
      setResolvingId(null);
    }
  };

  if (loading) return <div className="text-slate-400 text-center py-12">Loading stats...</div>;

  const pendingReportsCount = reports.filter((r) => r.status === 'pending').length;

  const statCards = [
    { label: 'Active on site (45s)', value: Number(stats?.activeUsers || 0).toLocaleString(), icon: Users, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
    { label: 'Watching now (45s)', value: Number(stats?.watchingUsers || 0).toLocaleString(), icon: Eye, color: 'text-orange-500', bg: 'bg-orange-500/10' },
    { label: 'Total Anime', value: Number(stats?.totalAnime || 0).toLocaleString(), icon: Film, color: 'text-blue-500', bg: 'bg-blue-500/10' },
    { label: 'Total Episodes', value: Number(stats?.totalEpisodes || 0).toLocaleString(), icon: ListVideo, color: 'text-green-500', bg: 'bg-green-500/10' },
    { label: 'Total Views', value: Number(stats?.totalViews || 0).toLocaleString(), icon: Eye, color: 'text-purple-500', bg: 'bg-purple-500/10' },
    { label: 'Total Users', value: Number(stats?.totalUsers || 0).toLocaleString(), icon: Users, color: 'text-cyan-500', bg: 'bg-cyan-500/10' },
    { label: 'VIP Members', value: Number(stats?.totalVipUsers || 0).toLocaleString(), icon: Crown, color: 'text-amber-400', bg: 'bg-amber-500/10' },
    {
      label: 'Pending Reports',
      value: pendingReportsCount.toLocaleString(),
      icon: AlertTriangle,
      color: pendingReportsCount > 0 ? 'text-amber-400' : 'text-slate-400',
      bg: pendingReportsCount > 0 ? 'bg-amber-500/10' : 'bg-slate-800/40',
    },
  ];

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-12">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-white">Dashboard</h1>
          <p className="text-xs text-slate-400 mt-1">Platform overview & incident response</p>
        </div>
        <div className="flex space-x-3">
          <Link
            href="/admin/spotlight"
            className="px-4 py-2 bg-[#1a1a2e] border border-slate-700 rounded-xl text-white text-xs font-semibold hover:bg-slate-800 transition-colors"
          >
            Manage Spotlight
          </Link>
          <Link
            href="/admin/anime/new"
            className="px-4 py-2 bg-violet-600 rounded-xl text-white text-xs font-bold hover:bg-violet-700 transition-colors flex items-center gap-1.5 shadow-lg shadow-violet-600/20"
          >
            <PlusCircle size={16} /> Add Anime
          </Link>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {statCards.map((stat, i) => (
          <div
            key={i}
            className="bg-[#1a1a2e] p-6 rounded-2xl border border-slate-800 flex items-center space-x-4 shadow-sm"
          >
            <div className={`p-4 rounded-xl ${stat.bg} ${stat.color}`}>
              <stat.icon size={26} />
            </div>
            <div>
              <p className="text-slate-400 text-xs font-medium mb-1">{stat.label}</p>
              <h3 className="text-2xl font-black text-white">{stat.value}</h3>
            </div>
          </div>
        ))}
      </div>

      {/* User Bug / Stream Reports Section */}
      <div className="bg-[#1a1a2e] p-6 rounded-2xl border border-slate-800 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
              <AlertTriangle size={18} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">User Stream & Bug Reports</h2>
              <p className="text-xs text-slate-400">
                Issues reported by users while streaming episodes
              </p>
            </div>
          </div>
          <button
            onClick={fetchData}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            title="Refresh reports"
          >
            <RefreshCw size={15} />
          </button>
        </div>

        {reports.length === 0 ? (
          <div className="text-center py-10 text-slate-500 text-xs">
            <CheckCircle2 size={32} className="mx-auto text-emerald-500/50 mb-2" />
            <p>No user reports submitted yet. Everything is streaming smoothly!</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="text-[11px] text-slate-400 uppercase bg-slate-900/60 border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Anime & Episode</th>
                  <th className="py-3 px-4">Issue Type</th>
                  <th className="py-3 px-4">Details</th>
                  <th className="py-3 px-4">Reported</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {reports.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 px-4 whitespace-nowrap">
                      {r.status === 'resolved' ? (
                        <span className="inline-flex items-center gap-1 bg-emerald-500/10 text-emerald-400 font-bold px-2 py-0.5 rounded text-[10px]">
                          <CheckCircle2 size={11} /> Resolved
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 bg-amber-500/10 text-amber-400 font-bold px-2 py-0.5 rounded text-[10px]">
                          Pending
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-bold text-white">
                        {r.anime_title || 'Episode #' + r.episode_id}
                      </span>
                      {r.episode_number && (
                        <span className="text-slate-400 ml-1">(Ep {r.episode_number})</span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono font-medium text-amber-300">
                      {r.issue_type}
                    </td>
                    <td className="py-3 px-4 max-w-xs truncate text-slate-400">
                      {r.details || <span className="italic text-slate-600">None</span>}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap text-slate-500">
                      {r.created_at?.slice(0, 16) || 'Recently'}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      {r.status !== 'resolved' ? (
                        <button
                          onClick={() => handleResolve(r.id)}
                          disabled={resolvingId === r.id}
                          className="px-3 py-1 bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-300 font-bold rounded text-[11px] transition-colors border border-emerald-500/30"
                        >
                          {resolvingId === r.id ? 'Saving...' : 'Mark Resolved'}
                        </button>
                      ) : (
                        <span className="text-slate-600 text-[11px]">Done</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
