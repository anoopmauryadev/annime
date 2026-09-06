const fs = require('fs');
const path = require('path');

const files = {
  "src/app/admin/layout.tsx": `'use client';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { LayoutDashboard, Film, PlusCircle, Star, Menu, X, LogOut } from 'lucide-react';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('adminToken');
    if (!token && !pathname.includes('/admin/login')) {
      router.push('/admin/login');
    } else {
      setIsAuthenticated(true);
    }
  }, [pathname, router]);

  if (!isAuthenticated && !pathname.includes('/admin/login')) return null;

  if (pathname.includes('/admin/login')) {
    return <div className="min-h-screen bg-[#0f0f1a] text-white">{children}</div>;
  }

  const navItems = [
    { name: 'Dashboard', href: '/admin', icon: LayoutDashboard },
    { name: 'Anime List', href: '/admin/anime', icon: Film },
    { name: 'Add Anime', href: '/admin/anime/new', icon: PlusCircle },
    { name: 'Spotlight', href: '/admin/spotlight', icon: Star },
  ];

  return (
    <div className="flex h-screen bg-[#0f0f1a] text-white overflow-hidden">
      {/* Sidebar Desktop */}
      <aside className="hidden md:flex flex-col w-64 bg-[#1a1a2e] border-r border-slate-800">
        <div className="p-6 border-b border-slate-800">
          <h1 className="text-xl font-bold text-violet-500">Admin Panel</h1>
        </div>
        <nav className="flex-1 p-4 space-y-2">
          {navItems.map((item) => (
            <Link key={item.name} href={item.href} className={\`flex items-center space-x-3 p-3 rounded-lg transition-colors \${pathname === item.href ? 'bg-violet-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}\`}>
              <item.icon size={20} />
              <span>{item.name}</span>
            </Link>
          ))}
        </nav>
        <div className="p-4 border-t border-slate-800">
          <button onClick={() => { localStorage.removeItem('adminToken'); router.push('/admin/login'); }} className="flex items-center space-x-3 p-3 w-full rounded-lg text-slate-400 hover:bg-red-500/10 hover:text-red-500 transition-colors">
            <LogOut size={20} />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile Header */}
        <header className="md:hidden flex items-center justify-between p-4 bg-[#1a1a2e] border-b border-slate-800">
          <h1 className="text-xl font-bold text-violet-500">Admin</h1>
          <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="text-slate-400 hover:text-white">
            {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </header>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden absolute top-16 left-0 right-0 z-50 bg-[#1a1a2e] border-b border-slate-800 p-4">
            <nav className="flex flex-col space-y-2">
              {navItems.map((item) => (
                <Link key={item.name} href={item.href} onClick={() => setIsMobileMenuOpen(false)} className={\`flex items-center space-x-3 p-3 rounded-lg \${pathname === item.href ? 'bg-violet-600 text-white' : 'text-slate-400'}\`}>
                  <item.icon size={20} />
                  <span>{item.name}</span>
                </Link>
              ))}
              <button onClick={() => { localStorage.removeItem('adminToken'); router.push('/admin/login'); }} className="flex items-center space-x-3 p-3 w-full rounded-lg text-red-500">
                <LogOut size={20} />
                <span>Logout</span>
              </button>
            </nav>
          </div>
        )}

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto bg-[#0f0f1a] p-4 md:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
`,
  "src/app/admin/login/page.tsx": `'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (res.ok && data.token) {
        localStorage.setItem('adminToken', data.token);
        router.push('/admin');
      } else {
        setError(data.error || 'Login failed');
      }
    } catch (err) {
      setError('An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0f0f1a] p-4">
      <div className="w-full max-w-md bg-[#1a1a2e] rounded-2xl p-8 border border-slate-800 shadow-2xl">
        <h1 className="text-3xl font-bold text-center mb-8 text-white">Admin <span className="text-violet-500">Login</span></h1>
        {error && <div className="bg-red-500/10 border border-red-500/50 text-red-500 p-3 rounded-lg mb-6 text-sm text-center">{error}</div>}
        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-2">Username</label>
            <input type="text" value={username} onChange={e => setUsername(e.target.value)} required className="w-full bg-[#0f0f1a] border border-slate-800 rounded-lg p-3 text-white focus:outline-none focus:border-violet-500 transition-colors" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-2">Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required className="w-full bg-[#0f0f1a] border border-slate-800 rounded-lg p-3 text-white focus:outline-none focus:border-violet-500 transition-colors" />
          </div>
          <button type="submit" disabled={loading} className="w-full bg-violet-600 hover:bg-violet-700 text-white font-medium py-3 rounded-lg transition-colors disabled:opacity-50">
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>
      </div>
    </div>
  );
}
`,
  "src/app/admin/page.tsx": `'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Film, ListVideo, Eye, Star, PlusCircle } from 'lucide-react';

export default function DashboardPage() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/stats')
      .then(res => res.json())
      .then(data => { setStats(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-slate-400">Loading stats...</div>;

  const statCards = [
    { label: 'Total Anime', value: stats?.totalAnime || 0, icon: Film, color: 'text-blue-500', bg: 'bg-blue-500/10' },
    { label: 'Total Episodes', value: stats?.totalEpisodes || 0, icon: ListVideo, color: 'text-green-500', bg: 'bg-green-500/10' },
    { label: 'Total Views', value: stats?.totalViews || 0, icon: Eye, color: 'text-purple-500', bg: 'bg-purple-500/10' },
    { label: 'Spotlight Items', value: stats?.spotlightCount || 0, icon: Star, color: 'text-yellow-500', bg: 'bg-yellow-500/10' },
  ];

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-white">Dashboard</h1>
        <div className="flex space-x-4">
          <Link href="/admin/spotlight" className="px-4 py-2 bg-[#1a1a2e] border border-slate-700 rounded-lg text-white hover:bg-slate-800 transition-colors">Manage Spotlight</Link>
          <Link href="/admin/anime/new" className="px-4 py-2 bg-violet-600 rounded-lg text-white hover:bg-violet-700 transition-colors flex items-center gap-2">
            <PlusCircle size={18} /> Add Anime
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat, i) => (
          <div key={i} className="bg-[#1a1a2e] p-6 rounded-2xl border border-slate-800 flex items-center space-x-4 hover:scale-105 transition-transform duration-200">
            <div className={\`p-4 rounded-xl \${stat.bg} \${stat.color}\`}>
              <stat.icon size={28} />
            </div>
            <div>
              <p className="text-slate-400 text-sm font-medium mb-1">{stat.label}</p>
              <h3 className="text-3xl font-bold text-white">{stat.value}</h3>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
`,
  "src/app/admin/anime/page.tsx": `'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Edit, ListVideo, Trash2, Search, PlusCircle } from 'lucide-react';

export default function AnimeListPage() {
  const [animeList, setAnimeList] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchAnime = (query = '') => {
    setLoading(true);
    fetch(\`/api/admin/anime?search=\${query}\`)
      .then(res => res.json())
      .then(data => { setAnimeList(data); setLoading(false); })
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
      await fetch(\`/api/admin/anime/\${id}\`, { method: 'DELETE' });
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
              <th className="px-6 py-4">Priority</th>
              <th className="px-6 py-4">Spotlight</th>
              <th className="px-6 py-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="px-6 py-4 text-center">Loading...</td></tr>
            ) : animeList.length === 0 ? (
              <tr><td colSpan={6} className="px-6 py-4 text-center">No anime found.</td></tr>
            ) : (
              animeList.map(anime => (
                <tr key={anime.id} className="border-b border-slate-800/50 hover:bg-slate-800/20">
                  <td className="px-6 py-4">
                    <img src={anime.poster || 'https://via.placeholder.com/50x70'} alt={anime.title} className="w-12 h-16 object-cover rounded" />
                  </td>
                  <td className="px-6 py-4 font-medium text-white">{anime.title}</td>
                  <td className="px-6 py-4 capitalize">{anime.type}</td>
                  <td className="px-6 py-4">{anime.priority}</td>
                  <td className="px-6 py-4">{anime.is_spotlight ? <span className="text-yellow-500 font-bold">Yes</span> : 'No'}</td>
                  <td className="px-6 py-4">
                    <div className="flex space-x-3">
                      <Link href={\`/admin/anime/\${anime.id}/edit\`} className="text-blue-400 hover:text-blue-300"><Edit size={18} /></Link>
                      <Link href={\`/admin/anime/\${anime.id}/episodes\`} className="text-green-400 hover:text-green-300"><ListVideo size={18} /></Link>
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
`,
  "src/app/admin/anime/new/page.tsx": `'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { UploadCloud, X } from 'lucide-react';

const GENRES = ["Action", "Adventure", "Comedy", "Drama", "Fantasy", "Horror", "Romance", "Sci-Fi", "School", "Shounen", "Slice of Life", "Sports", "Supernatural", "Thriller"];
const LANGUAGES = ["Hindi", "English", "Japanese", "Tamil", "Telugu"];

export default function NewAnimePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    title: '', type: 'series', synopsis: '', year: 2024, rating: '', status: 'ongoing', quality: 'HD',
    priority: 0, is_spotlight: false
  });
  const [languages, setLanguages] = useState<string[]>([]);
  const [genres, setGenres] = useState<string[]>([]);
  
  const [poster, setPoster] = useState<File | null>(null);
  const [backdrop, setBackdrop] = useState<File | null>(null);
  const [thumbnail, setThumbnail] = useState<File | null>(null);

  const toggleArray = (val: string, arr: string[], setArr: (a: string[]) => void) => {
    setArr(arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    const data = new FormData();
    Object.entries(formData).forEach(([k, v]) => data.append(k, String(v)));
    data.append('languages', JSON.stringify(languages));
    data.append('genres', JSON.stringify(genres));
    if (poster) data.append('poster', poster);
    if (backdrop) data.append('backdrop', backdrop);
    if (thumbnail) data.append('thumbnail', thumbnail);

    try {
      const res = await fetch('/api/admin/anime', { method: 'POST', body: data });
      if (res.ok) {
        alert('Anime created successfully!');
        router.push('/admin/anime');
      } else {
        const error = await res.json();
        alert('Error: ' + error.error);
      }
    } catch (err) {
      alert('Upload failed');
    } finally {
      setLoading(false);
    }
  };

  const FileUpload = ({ label, file, setFile }: { label: string, file: File | null, setFile: (f: File | null) => void }) => (
    <div className="bg-[#1a1a2e] p-4 rounded-xl border border-slate-800">
      <label className="block text-sm font-medium text-slate-300 mb-2">{label}</label>
      {!file ? (
        <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-slate-700 rounded-lg cursor-pointer hover:bg-slate-800/50">
          <UploadCloud className="w-8 h-8 text-slate-400 mb-2" />
          <span className="text-sm text-slate-400">Click to upload image</span>
          <input type="file" className="hidden" accept="image/*" onChange={(e) => { if(e.target.files?.[0]) setFile(e.target.files[0]) }} />
        </label>
      ) : (
        <div className="relative w-full h-32 rounded-lg overflow-hidden border border-slate-700">
          <img src={URL.createObjectURL(file)} alt="preview" className="w-full h-full object-cover" />
          <button type="button" onClick={() => setFile(null)} className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded-full"><X size={16} /></button>
        </div>
      )}
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold text-white">Add New Anime</h1>
      <form onSubmit={handleSubmit} className="space-y-6 bg-[#0f0f1a] p-6 rounded-2xl border border-slate-800">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm text-slate-400 mb-1">Title *</label>
            <input type="text" required value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} className="w-full bg-[#1a1a2e] border border-slate-800 rounded-lg p-3 text-white focus:border-violet-500 outline-none" />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">Type</label>
            <select value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})} className="w-full bg-[#1a1a2e] border border-slate-800 rounded-lg p-3 text-white focus:border-violet-500 outline-none">
              <option value="series">Series</option><option value="movie">Movie</option><option value="cartoon">Cartoon</option>
            </select>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <FileUpload label="Poster Image *" file={poster} setFile={setPoster} />
          <FileUpload label="Backdrop Image" file={backdrop} setFile={setBackdrop} />
          <FileUpload label="Thumbnail Image" file={thumbnail} setFile={setThumbnail} />
        </div>

        <div>
          <label className="block text-sm text-slate-400 mb-1">Synopsis</label>
          <textarea rows={4} value={formData.synopsis} onChange={e => setFormData({...formData, synopsis: e.target.value})} className="w-full bg-[#1a1a2e] border border-slate-800 rounded-lg p-3 text-white focus:border-violet-500 outline-none" />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm text-slate-400 mb-1">Year</label>
            <input type="number" value={formData.year} onChange={e => setFormData({...formData, year: parseInt(e.target.value)})} className="w-full bg-[#1a1a2e] border border-slate-800 rounded-lg p-3 text-white focus:border-violet-500 outline-none" />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">Rating</label>
            <input type="text" value={formData.rating} onChange={e => setFormData({...formData, rating: e.target.value})} placeholder="e.g. 8.5" className="w-full bg-[#1a1a2e] border border-slate-800 rounded-lg p-3 text-white focus:border-violet-500 outline-none" />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">Status</label>
            <select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})} className="w-full bg-[#1a1a2e] border border-slate-800 rounded-lg p-3 text-white focus:border-violet-500 outline-none">
              <option value="ongoing">Ongoing</option><option value="completed">Completed</option><option value="upcoming">Upcoming</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">Quality</label>
            <select value={formData.quality} onChange={e => setFormData({...formData, quality: e.target.value})} className="w-full bg-[#1a1a2e] border border-slate-800 rounded-lg p-3 text-white focus:border-violet-500 outline-none">
              <option value="HD">HD</option><option value="Full HD">Full HD</option><option value="4K">4K</option><option value="CAM">CAM</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm text-slate-400 mb-2">Languages</label>
          <div className="flex flex-wrap gap-2">
            {LANGUAGES.map(l => (
              <label key={l} className="flex items-center space-x-2 bg-[#1a1a2e] px-3 py-2 rounded-lg cursor-pointer">
                <input type="checkbox" checked={languages.includes(l)} onChange={() => toggleArray(l, languages, setLanguages)} className="accent-violet-500" />
                <span className="text-sm text-slate-300">{l}</span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm text-slate-400 mb-2">Genres</label>
          <div className="flex flex-wrap gap-2">
            {GENRES.map(g => (
              <label key={g} className="flex items-center space-x-2 bg-[#1a1a2e] px-3 py-2 rounded-lg cursor-pointer">
                <input type="checkbox" checked={genres.includes(g)} onChange={() => toggleArray(g, genres, setGenres)} className="accent-violet-500" />
                <span className="text-sm text-slate-300">{g}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="flex items-center space-x-6">
          <div className="flex-1">
            <label className="block text-sm text-slate-400 mb-1">Priority (0-100)</label>
            <input type="number" min="0" max="100" value={formData.priority} onChange={e => setFormData({...formData, priority: parseInt(e.target.value)})} className="w-full bg-[#1a1a2e] border border-slate-800 rounded-lg p-3 text-white focus:border-violet-500 outline-none" />
          </div>
          <div className="flex items-center space-x-3 mt-6">
            <label className="text-sm text-slate-400">Spotlight</label>
            <button type="button" onClick={() => setFormData({...formData, is_spotlight: !formData.is_spotlight})} className={\`w-12 h-6 rounded-full transition-colors relative \${formData.is_spotlight ? 'bg-violet-600' : 'bg-slate-700'}\`}>
              <div className={\`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-all \${formData.is_spotlight ? 'left-6' : 'left-0.5'}\`} />
            </button>
          </div>
        </div>

        <div className="pt-4 border-t border-slate-800">
          <button type="submit" disabled={loading} className="w-full md:w-auto px-8 py-3 bg-violet-600 hover:bg-violet-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50">
            {loading ? 'Uploading...' : 'Save Anime'}
          </button>
        </div>
      </form>
    </div>
  );
}
`,
  "src/app/admin/anime/[id]/edit/page.tsx": `'use client';
import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';

export default function EditAnimePage() {
  const params = useParams();
  const id = params.id;
  const router = useRouter();
  
  // Minimal placeholder implementation for brevity in the script.
  // Full implementation would be similar to new/page.tsx but with data fetching.
  return <div className="text-white">Edit page placeholder. Use the New page code as a base to populate.</div>;
}
`,
  "src/app/admin/spotlight/page.tsx": `'use client';
import { useEffect, useState } from 'react';

export default function SpotlightPage() {
  const [animeList, setAnimeList] = useState<any[]>([]);

  useEffect(() => {
    fetch('/api/admin/anime?sort=priority')
      .then(res => res.json())
      .then(data => setAnimeList(data));
  }, []);

  const updateAnime = async (id: number, data: any) => {
    await fetch(\`/api/admin/anime/\${id}\`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    fetch('/api/admin/anime?sort=priority').then(res => res.json()).then(setAnimeList);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-white">Spotlight & Priority Manager</h1>
      <div className="bg-[#1a1a2e] rounded-xl border border-slate-800 p-4 space-y-4">
        {animeList.map(anime => (
          <div key={anime.id} className={\`flex items-center justify-between p-4 bg-[#0f0f1a] rounded-lg border \${anime.is_spotlight ? 'border-yellow-500/50 shadow-[0_0_15px_rgba(234,179,8,0.1)]' : 'border-slate-800'}\`}>
            <div className="flex items-center space-x-4">
              <img src={anime.poster || 'https://via.placeholder.com/40'} className="w-10 h-14 object-cover rounded" />
              <h3 className="font-medium text-white">{anime.title}</h3>
            </div>
            <div className="flex items-center space-x-6">
              <div className="flex items-center space-x-2">
                <span className="text-sm text-slate-400">Priority:</span>
                <input type="number" value={anime.priority} onChange={(e) => updateAnime(anime.id, { priority: parseInt(e.target.value) })} className="w-16 bg-[#1a1a2e] border border-slate-700 rounded px-2 py-1 text-white text-sm" />
                <button onClick={() => updateAnime(anime.id, { priority: animeList[0].priority + 1 })} className="text-xs bg-slate-800 hover:bg-slate-700 text-white px-2 py-1 rounded">Top</button>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-sm text-slate-400">Spotlight:</span>
                <button onClick={() => updateAnime(anime.id, { is_spotlight: !anime.is_spotlight })} className={\`w-10 h-5 rounded-full relative transition-colors \${anime.is_spotlight ? 'bg-yellow-500' : 'bg-slate-700'}\`}>
                  <div className={\`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-all \${anime.is_spotlight ? 'left-5' : 'left-0.5'}\`} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
`,
  "src/app/api/admin/anime/route.ts": `import { NextResponse } from 'next/server';
import { getAllAnime, createAnime } from '@/lib/db';
import { writeFile } from 'fs/promises';
import path from 'path';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const search = searchParams.get('search') || '';
  const sort = searchParams.get('sort') || '';
  const anime = getAllAnime({ search, sort: sort === 'priority' ? undefined : sort });
  if (sort === 'priority') {
    anime.sort((a, b) => b.priority - a.priority);
  }
  return NextResponse.json(anime);
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const data: any = {};
    const keys = ['title', 'type', 'synopsis', 'year', 'rating', 'status', 'quality', 'priority'];
    keys.forEach(k => { if (formData.has(k)) data[k] = formData.get(k); });
    if (formData.has('languages')) data.languages = formData.get('languages');
    if (formData.has('genres')) data.genres = formData.get('genres');
    data.is_spotlight = formData.get('is_spotlight') === 'true' ? 1 : 0;
    
    // Quick slug generation
    data.slug = (data.title as string).toLowerCase().replace(/[^a-z0-9]+/g, '-');
    
    // File uploads handler (simplified)
    const saveFile = async (file: any) => {
      if (!file || typeof file === 'string') return '';
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const filename = Date.now() + '_' + file.name.replace(/\\s/g, '_');
      const filepath = path.join(process.cwd(), 'public', 'uploads', filename);
      await writeFile(filepath, buffer);
      return '/uploads/' + filename;
    };

    data.poster = await saveFile(formData.get('poster'));
    data.backdrop = await saveFile(formData.get('backdrop'));
    data.thumbnail = await saveFile(formData.get('thumbnail'));

    const id = createAnime(data);
    return NextResponse.json({ success: true, id });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
`,
  "src/app/api/admin/anime/[id]/route.ts": `import { NextResponse } from 'next/server';
import { updateAnime, deleteAnime } from '@/lib/db';

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    const data = await req.json();
    updateAnime(parseInt(params.id), data);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  deleteAnime(parseInt(params.id));
  return NextResponse.json({ success: true });
}
`,
  "src/app/api/admin/stats/route.ts": `import { NextResponse } from 'next/server';
import { getAdminStats } from '@/lib/db';

export async function GET() {
  const stats = getAdminStats();
  return NextResponse.json(stats);
}
`
};

for (const [filepath, content] of Object.entries(files)) {
  const fullPath = path.join(process.cwd(), filepath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content, 'utf8');
  console.log('Created:', filepath);
}
