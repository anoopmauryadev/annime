'use client';
import { useEffect, useState } from 'react';
import { Star, ArrowUp, Loader2 } from 'lucide-react';
import { adminFetch } from '@/lib/adminApi';

export default function SpotlightPage() {
  const [animeList, setAnimeList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<number | null>(null);

  const fetchAll = () => {
    adminFetch('/api/admin/anime')
      .then(res => res.json())
      .then(data => {
        const arr = Array.isArray(data) ? data : [];
        const sorted = [...arr].sort((a: any, b: any) => (b.priority || 0) - (a.priority || 0));
        setAnimeList(sorted);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => { fetchAll(); }, []);

  const updateAnime = async (id: number, fields: Record<string, string | number>) => {
    setUpdating(id);
    const fd = new FormData();
    Object.entries(fields).forEach(([k, v]) => fd.append(k, String(v)));
    await adminFetch(`/api/admin/anime/${id}`, { method: 'PUT', body: fd });
    await new Promise(r => setTimeout(r, 300));
    fetchAll();
    setUpdating(null);
  };

  const moveToTop = (id: number) => {
    const maxPriority = Math.max(...animeList.map(a => a.priority || 0), 0);
    updateAnime(id, { priority: maxPriority + 1 });
  };

  const toggleSpotlight = (anime: any) => {
    updateAnime(anime.id, { is_spotlight: anime.is_spotlight ? 0 : 1 });
  };

  const changePriority = (id: number, val: string) => {
    const num = parseInt(val);
    if (!isNaN(num)) updateAnime(id, { priority: num });
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-violet-500" size={32} /></div>;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3">
        <Star className="text-yellow-500" size={28} />
        <h1 className="text-3xl font-bold text-white">Spotlight & Priority Manager</h1>
      </div>
      <p className="text-slate-400 text-sm">Higher priority = site pe upar dikhega. Spotlight ON = Hero carousel me dikhega.</p>

      <div className="space-y-3">
        {animeList.map((anime, index) => (
          <div key={anime.id}
            className={`flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl border transition-all ${
              anime.is_spotlight
                ? 'bg-yellow-500/5 border-yellow-500/30 shadow-[0_0_20px_rgba(234,179,8,0.05)]'
                : 'bg-[#1a1a2e] border-slate-800'
            } ${updating === anime.id ? 'opacity-60' : ''}`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="text-slate-500 font-bold text-lg w-8 text-center shrink-0">#{index + 1}</div>
              <img src={anime.poster || '/placeholder.jpg'} className="w-10 h-14 object-cover rounded shrink-0" alt="" />
              <div className="min-w-0">
                <h3 className="font-semibold text-white truncate">{anime.title}</h3>
                <span className="text-xs text-slate-400 capitalize">{anime.type} • {anime.year}</span>
              </div>
            </div>

            <div className="flex items-center gap-4 flex-wrap shrink-0">
              {/* Priority Control */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">Priority:</span>
                <input
                  type="number"
                  min="0"
                  value={anime.priority || 0}
                  onBlur={(e) => changePriority(anime.id, e.target.value)}
                  onChange={(e) => {
                    setAnimeList(prev => prev.map(a => a.id === anime.id ? { ...a, priority: parseInt(e.target.value) || 0 } : a));
                  }}
                  className="w-16 bg-[#0f0f1a] border border-slate-700 rounded px-2 py-1 text-white text-sm text-center outline-none focus:border-violet-500"
                />
                <button
                  onClick={() => moveToTop(anime.id)}
                  className="flex items-center gap-1 text-xs bg-violet-600 hover:bg-violet-700 text-white px-2.5 py-1.5 rounded transition-colors"
                  title="Move to Top"
                >
                  <ArrowUp size={12} /> Top
                </button>
              </div>

              {/* Spotlight Toggle */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">Spotlight:</span>
                <button
                  onClick={() => toggleSpotlight(anime)}
                  className={`w-11 h-6 rounded-full relative transition-colors ${anime.is_spotlight ? 'bg-yellow-500' : 'bg-slate-700'}`}
                >
                  <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-all ${anime.is_spotlight ? 'left-5' : 'left-0.5'}`} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
