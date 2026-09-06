'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Edit, ListVideo, Trash2, Search, PlusCircle } from 'lucide-react';
import { adminFetch } from '@/lib/adminApi';

export default function AnimeListPage() {
  const [animeList, setAnimeList] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchAnime = (query = '') => {
    setLoading(true);
    adminFetch(`/api/admin/anime?search=${query}`)
      .then(res => res.json())
      .then(data => { setAnimeList(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    fetchAnime();
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchAnime(search);
  };

  const handleDelete = async (id: number) => {
    if (confirm('Are you sure you want to delete this anime?')) {
      await adminFetch(`/api/admin/anime/${id}`, { method: 'DELETE' });
      fetchAnime(search);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
        <h1 className="text-3xl font-bold text-white">Anime List</h1>
        <Link href="/admin/anime/new" className="px-4 py-2 bg-violet-600 rounded-lg text-white hover:bg-violet-700 transition-colors flex items-center gap-2 max-w-max">
          <PlusCircle size={18} /> Add New
        </Link>
      </div>

      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input
            type="text"
            placeholder="Search anime..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#1a1a2e] border border-slate-800 rounded-lg pl-10 pr-4 py-2 text-white focus:outline-none focus:border-violet-500"
          />
        </div>
        <button type="submit" className="px-4 py-2 bg-[#1a1a2e] border border-slate-800 rounded-lg text-white hover:bg-slate-800">Search</button>
      </form>

      <div className="bg-[#1a1a2e] rounded-xl border border-slate-800 overflow-x-auto">
        <table className="w-full text-left text-sm text-slate-300">
          <thead className="text-xs text-slate-400 uppercase bg-slate-800/50">
            <tr>
              <th className="px-6 py-4">Poster</th>
              <th className="px-6 py-4">Title</th>
              <th className="px-6 py-4">Type</th>
              <th className="px-6 py-4">Views</th>
              <th className="px-6 py-4">Priority</th>
              <th className="px-6 py-4">Spotlight</th>
              <th className="px-6 py-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="px-6 py-4 text-center">Loading...</td></tr>
            ) : animeList.length === 0 ? (
              <tr><td colSpan={7} className="px-6 py-4 text-center">No anime found.</td></tr>
            ) : (
              animeList.map(anime => (
                <tr key={anime.id} className="border-b border-slate-800/50 hover:bg-slate-800/20">
                  <td className="px-6 py-4">
                    <img src={anime.poster || 'https://via.placeholder.com/50x70'} alt={anime.title} className="w-12 h-16 object-cover rounded" />
                  </td>
                  <td className="px-6 py-4 font-medium text-white">{anime.title}</td>
                  <td className="px-6 py-4 capitalize">{anime.type}</td>
                  <td className="px-6 py-4 font-mono font-semibold text-purple-400">
                    {(anime.views || 0).toLocaleString()}
                  </td>
                  <td className="px-6 py-4">{anime.priority}</td>
                  <td className="px-6 py-4">{anime.is_spotlight ? <span className="text-yellow-500 font-bold">Yes</span> : 'No'}</td>
                  <td className="px-6 py-4">
                    <div className="flex space-x-3">
                      <Link href={`/admin/anime/${anime.id}/edit`} className="text-blue-400 hover:text-blue-300"><Edit size={18} /></Link>
                      <Link href={`/admin/anime/${anime.id}/episodes`} className="text-green-400 hover:text-green-300"><ListVideo size={18} /></Link>
                      <button onClick={() => handleDelete(anime.id)} className="text-red-400 hover:text-red-300"><Trash2 size={18} /></button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
