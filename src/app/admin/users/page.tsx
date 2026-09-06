'use client';
import { useEffect, useState, useCallback } from 'react';
import { adminFetch } from '@/lib/adminApi';
import { Users, Search, Crown, Shield, RefreshCw, ChevronLeft, ChevronRight, UserPlus, Mail, Calendar, Hash } from 'lucide-react';

interface UserData {
  id: number;
  username: string;
  email: string;
  avatar: string;
  is_vip: number;
  created_at: string;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserData[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [vipOnly, setVipOnly] = useState(false);
  const [page, setPage] = useState(0);
  const [togglingId, setTogglingId] = useState<number | null>(null);

  // Quick-add VIP
  const [showAddVip, setShowAddVip] = useState(false);
  const [addVipInput, setAddVipInput] = useState('');
  const [addVipMsg, setAddVipMsg] = useState('');

  const pageSize = 20;

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (vipOnly) params.set('vipOnly', 'true');
      params.set('limit', String(pageSize));
      params.set('offset', String(page * pageSize));

      const res = await adminFetch(`/api/admin/users?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
        setTotal(data.total || 0);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [search, vipOnly, page]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const toggleVip = async (user: UserData) => {
    setTogglingId(user.id);
    const newVipStatus = user.is_vip === 1 ? 0 : 1;
    try {
      const res = await adminFetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, is_vip: newVipStatus }),
      });
      if (res.ok) {
        // Refresh from server to get accurate state
        await fetchUsers();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to update VIP status');
      }
    } catch {
      alert('Failed to update VIP status');
    } finally {
      setTogglingId(null);
    }
  };

  const handleQuickAddVip = async () => {
    if (!addVipInput.trim()) return;
    setAddVipMsg('');
    try {
      const isEmail = addVipInput.includes('@');
      const body = isEmail
        ? { email: addVipInput.trim(), is_vip: 1 }
        : { username: addVipInput.trim(), is_vip: 1 };

      const res = await adminFetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (res.ok) {
        setAddVipMsg('✅ VIP status granted successfully!');
        setAddVipInput('');
        fetchUsers();
      } else {
        setAddVipMsg(`❌ ${data.error || 'User not found'}`);
      }
    } catch {
      setAddVipMsg('❌ Failed to update');
    }
  };

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <Users className="text-violet-500" size={28} /> User Management
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            {total} total user{total !== 1 ? 's' : ''} registered
          </p>
        </div>
        <button
          onClick={() => setShowAddVip(!showAddVip)}
          className="px-4 py-2.5 bg-gradient-to-r from-amber-500 to-orange-600 rounded-xl text-white text-xs font-bold hover:from-amber-600 hover:to-orange-700 transition-all flex items-center gap-2 shadow-lg shadow-amber-500/20"
        >
          <Crown size={16} /> {showAddVip ? 'Close' : 'Quick Add VIP'}
        </button>
      </div>

      {/* Quick Add VIP Panel */}
      {showAddVip && (
        <div className="bg-gradient-to-br from-amber-500/5 to-orange-500/5 border border-amber-500/20 rounded-2xl p-6 space-y-4">
          <h3 className="text-sm font-bold text-amber-400 flex items-center gap-2">
            <Crown size={16} /> Grant VIP Access
          </h3>
          <p className="text-xs text-slate-400">
            Enter username or email address to grant VIP membership
          </p>
          <div className="flex gap-3">
            <input
              type="text"
              value={addVipInput}
              onChange={(e) => setAddVipInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleQuickAddVip()}
              placeholder="Enter username or email..."
              className="flex-1 bg-[#0f0f1a] border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-amber-500 focus:outline-none transition-colors"
            />
            <button
              onClick={handleQuickAddVip}
              className="px-6 py-3 bg-amber-500 hover:bg-amber-600 text-black font-bold text-sm rounded-xl transition-colors"
            >
              Grant VIP
            </button>
          </div>
          {addVipMsg && (
            <p className="text-sm font-medium mt-1">{addVipMsg}</p>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            placeholder="Search by username or email..."
            className="w-full bg-[#1a1a2e] border border-slate-700 rounded-xl pl-11 pr-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-violet-500 focus:outline-none transition-colors"
          />
        </div>
        <button
          onClick={() => { setVipOnly(!vipOnly); setPage(0); }}
          className={`px-4 py-3 rounded-xl text-xs font-bold border transition-all flex items-center gap-2 ${
            vipOnly
              ? 'bg-amber-500/10 border-amber-500/40 text-amber-400'
              : 'bg-[#1a1a2e] border-slate-700 text-slate-400 hover:border-slate-600'
          }`}
        >
          <Crown size={14} /> {vipOnly ? 'VIP Only ✓' : 'VIP Only'}
        </button>
        <button
          onClick={fetchUsers}
          className="px-4 py-3 bg-[#1a1a2e] border border-slate-700 rounded-xl text-slate-400 hover:text-white hover:border-slate-600 transition-colors"
        >
          <RefreshCw size={16} />
        </button>
      </div>

      {/* Users Table */}
      <div className="bg-[#1a1a2e] rounded-2xl border border-slate-800 overflow-hidden">
        {loading ? (
          <div className="text-center py-16 text-slate-500 text-sm">Loading users...</div>
        ) : users.length === 0 ? (
          <div className="text-center py-16 text-slate-500">
            <Users size={40} className="mx-auto text-slate-600 mb-3" />
            <p className="text-sm">No users found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="text-[11px] text-slate-400 uppercase bg-slate-900/60 border-b border-slate-800">
                <tr>
                  <th className="py-3.5 px-5"><Hash size={12} className="inline mr-1" />ID</th>
                  <th className="py-3.5 px-5">User</th>
                  <th className="py-3.5 px-5"><Mail size={12} className="inline mr-1" />Email</th>
                  <th className="py-3.5 px-5">Status</th>
                  <th className="py-3.5 px-5"><Calendar size={12} className="inline mr-1" />Joined</th>
                  <th className="py-3.5 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3.5 px-5 text-slate-500 font-mono">#{user.id}</td>
                    <td className="py-3.5 px-5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white font-bold text-xs">
                          {user.avatar ? (
                            <img src={user.avatar} alt="" className="w-8 h-8 rounded-full object-cover" />
                          ) : (
                            user.username.charAt(0).toUpperCase()
                          )}
                        </div>
                        <div>
                          <span className="font-bold text-white text-sm">{user.username}</span>
                          {user.is_vip ? (
                            <span className="ml-2 inline-flex items-center gap-1 bg-amber-500/15 text-amber-400 font-bold px-1.5 py-0.5 rounded text-[9px]">
                              <Crown size={9} /> VIP
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-5 text-slate-400 font-mono text-[11px]">{user.email}</td>
                    <td className="py-3.5 px-5">
                      {user.is_vip ? (
                        <span className="inline-flex items-center gap-1 bg-amber-500/10 text-amber-400 font-bold px-2.5 py-1 rounded-lg text-[10px]">
                          <Crown size={10} /> VIP Member
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 bg-slate-800/60 text-slate-400 font-medium px-2.5 py-1 rounded-lg text-[10px]">
                          <Shield size={10} /> Regular
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-5 text-slate-500 text-[11px] whitespace-nowrap">
                      {user.created_at?.slice(0, 10) || 'Unknown'}
                    </td>
                    <td className="py-3.5 px-5 text-right">
                      <button
                        onClick={() => toggleVip(user)}
                        disabled={togglingId === user.id}
                        className={`px-3.5 py-1.5 rounded-lg text-[11px] font-bold transition-all border ${
                          user.is_vip
                            ? 'bg-red-500/10 hover:bg-red-500/20 text-red-400 border-red-500/30'
                            : 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border-amber-500/30'
                        } ${togglingId === user.id ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        {togglingId === user.id
                          ? 'Updating...'
                          : user.is_vip
                          ? 'Remove VIP'
                          : 'Make VIP'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between p-4 border-t border-slate-800">
            <p className="text-xs text-slate-500">
              Showing {page * pageSize + 1}–{Math.min((page + 1) * pageSize, total)} of {total}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(Math.max(0, page - 1))}
                disabled={page === 0}
                className="p-2 rounded-lg bg-slate-800 text-slate-400 hover:text-white disabled:opacity-30 transition-colors"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="px-3 py-2 text-xs text-slate-400 bg-slate-800/50 rounded-lg">
                {page + 1} / {totalPages}
              </span>
              <button
                onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
                disabled={page >= totalPages - 1}
                className="p-2 rounded-lg bg-slate-800 text-slate-400 hover:text-white disabled:opacity-30 transition-colors"
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
