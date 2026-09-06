'use client';
import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { UploadCloud, X, ArrowLeft } from 'lucide-react';
import { adminFetch } from '@/lib/adminApi';

const GENRES = ["Action", "Adventure", "Comedy", "Drama", "Fantasy", "Horror", "Romance", "Sci-Fi", "School", "Shounen", "Slice of Life", "Sports", "Supernatural", "Thriller"];
const LANGUAGES = ["Hindi", "English", "Japanese", "Tamil", "Telugu"];

export default function EditAnimePage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    title: '', type: 'series', synopsis: '', year: 2024, rating: '', status: 'ongoing', quality: 'HD',
    priority: 0, views: 0, is_spotlight: false
  });
  const [languages, setLanguages] = useState<string[]>([]);
  const [genres, setGenres] = useState<string[]>([]);

  const [poster, setPoster] = useState<File | null>(null);
  const [backdrop, setBackdrop] = useState<File | null>(null);
  const [thumbnail, setThumbnail] = useState<File | null>(null);

  const [currentPoster, setCurrentPoster] = useState('');
  const [currentBackdrop, setCurrentBackdrop] = useState('');
  const [currentThumbnail, setCurrentThumbnail] = useState('');

  useEffect(() => {
    fetch(`/api/admin/anime/${id}`)
      .then(res => res.json())
      .then(data => {
        setFormData({
          title: data.title || '',
          type: data.type || 'series',
          synopsis: data.synopsis || '',
          year: data.year || 2024,
          rating: data.rating || '',
          status: data.status || 'ongoing',
          quality: data.quality || 'HD',
          priority: data.priority || 0,
          views: data.views || 0,
          is_spotlight: data.is_spotlight === 1,
        });
        try { setLanguages(JSON.parse(data.languages || '[]')); } catch { setLanguages([]); }
        try { setGenres(JSON.parse(data.genres || '[]')); } catch { setGenres([]); }
        setCurrentPoster(data.poster || '');
        setCurrentBackdrop(data.backdrop || '');
        setCurrentThumbnail(data.thumbnail || '');
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [id]);

  const toggleArray = (val: string, arr: string[], setArr: (a: string[]) => void) => {
    setArr(arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    const data = new FormData();
    Object.entries(formData).forEach(([k, v]) => data.append(k, String(v)));
    data.append('languages', JSON.stringify(languages));
    data.append('genres', JSON.stringify(genres));
    if (poster) data.append('poster', poster);
    if (backdrop) data.append('backdrop', backdrop);
    if (thumbnail) data.append('thumbnail', thumbnail);

    try {
      const res = await adminFetch(`/api/admin/anime/${id}`, { method: 'PUT', body: data });
      if (res.ok) {
        alert('Anime updated successfully!');
        router.push('/admin/anime');
      } else {
        const error = await res.json();
        alert('Error: ' + (error.error || 'Update failed'));
      }
    } catch {
      alert('Update failed');
    } finally {
      setSaving(false);
    }
  };

  const FileUpload = ({ label, file, setFile, currentUrl }: { label: string; file: File | null; setFile: (f: File | null) => void; currentUrl: string }) => (
    <div className="bg-[#1a1a2e] p-4 rounded-xl border border-slate-800">
      <label className="block text-sm font-medium text-slate-300 mb-2">{label}</label>
      {!file && !currentUrl ? (
        <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-slate-700 rounded-lg cursor-pointer hover:bg-slate-800/50">
          <UploadCloud className="w-8 h-8 text-slate-400 mb-2" />
          <span className="text-sm text-slate-400">Click to upload</span>
          <input type="file" className="hidden" accept="image/*" onChange={(e) => { if (e.target.files?.[0]) setFile(e.target.files[0]); }} />
        </label>
      ) : (
        <div className="relative w-full h-32 rounded-lg overflow-hidden border border-slate-700">
          <img
            src={file ? URL.createObjectURL(file) : currentUrl}
            alt="preview"
            className="w-full h-full object-cover"
          />
          <div className="absolute top-2 right-2 flex gap-1">
            <label className="bg-blue-500 text-white p-1 rounded-full cursor-pointer text-xs px-2">
              Change
              <input type="file" className="hidden" accept="image/*" onChange={(e) => { if (e.target.files?.[0]) setFile(e.target.files[0]); }} />
            </label>
            {file && (
              <button type="button" onClick={() => setFile(null)} className="bg-red-500 text-white p-1 rounded-full">
                <X size={16} />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );

  if (loading) return <div className="text-slate-400 text-center py-10">Loading anime data...</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => router.back()} className="p-2 rounded-lg bg-[#1a1a2e] text-slate-400 hover:text-white">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-3xl font-bold text-white">Edit Anime</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 bg-[#0f0f1a] p-6 rounded-2xl border border-slate-800">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm text-slate-400 mb-1">Title *</label>
            <input type="text" required value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} className="w-full bg-[#1a1a2e] border border-slate-800 rounded-lg p-3 text-white focus:border-violet-500 outline-none" />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">Type</label>
            <select value={formData.type} onChange={e => setFormData({ ...formData, type: e.target.value })} className="w-full bg-[#1a1a2e] border border-slate-800 rounded-lg p-3 text-white focus:border-violet-500 outline-none">
              <option value="series">Series</option><option value="movie">Movie</option><option value="cartoon">Cartoon</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <FileUpload label="Poster Image" file={poster} setFile={setPoster} currentUrl={currentPoster} />
          <FileUpload label="Backdrop Image" file={backdrop} setFile={setBackdrop} currentUrl={currentBackdrop} />
          <FileUpload label="Thumbnail Image" file={thumbnail} setFile={setThumbnail} currentUrl={currentThumbnail} />
        </div>

        <div>
          <label className="block text-sm text-slate-400 mb-1">Synopsis</label>
          <textarea rows={4} value={formData.synopsis} onChange={e => setFormData({ ...formData, synopsis: e.target.value })} className="w-full bg-[#1a1a2e] border border-slate-800 rounded-lg p-3 text-white focus:border-violet-500 outline-none" />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm text-slate-400 mb-1">Year</label>
            <input type="number" value={formData.year} onChange={e => setFormData({ ...formData, year: parseInt(e.target.value) })} className="w-full bg-[#1a1a2e] border border-slate-800 rounded-lg p-3 text-white focus:border-violet-500 outline-none" />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">Rating</label>
            <input type="text" value={formData.rating} onChange={e => setFormData({ ...formData, rating: e.target.value })} placeholder="e.g. 8.5" className="w-full bg-[#1a1a2e] border border-slate-800 rounded-lg p-3 text-white focus:border-violet-500 outline-none" />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">Status</label>
            <select value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value })} className="w-full bg-[#1a1a2e] border border-slate-800 rounded-lg p-3 text-white focus:border-violet-500 outline-none">
              <option value="ongoing">Ongoing</option><option value="completed">Completed</option><option value="upcoming">Upcoming</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">Quality</label>
            <select value={formData.quality} onChange={e => setFormData({ ...formData, quality: e.target.value })} className="w-full bg-[#1a1a2e] border border-slate-800 rounded-lg p-3 text-white focus:border-violet-500 outline-none">
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

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
          <div>
            <label className="block text-sm text-slate-400 mb-1">Priority (0-100)</label>
            <input type="number" min="0" max="100" value={formData.priority} onChange={e => setFormData({ ...formData, priority: parseInt(e.target.value) || 0 })} className="w-full bg-[#1a1a2e] border border-slate-800 rounded-lg p-3 text-white focus:border-violet-500 outline-none" />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">Total Views</label>
            <input type="number" min="0" value={formData.views} onChange={e => setFormData({ ...formData, views: parseInt(e.target.value) || 0 })} className="w-full bg-[#1a1a2e] border border-slate-800 rounded-lg p-3 text-white font-mono focus:border-violet-500 outline-none" />
          </div>
          <div className="flex items-center space-x-3 md:mt-6">
            <label className="text-sm text-slate-400">Spotlight</label>
            <button type="button" onClick={() => setFormData({ ...formData, is_spotlight: !formData.is_spotlight })} className={`w-12 h-6 rounded-full transition-colors relative ${formData.is_spotlight ? 'bg-violet-600' : 'bg-slate-700'}`}>
              <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-all ${formData.is_spotlight ? 'left-6' : 'left-0.5'}`} />
            </button>
          </div>
        </div>

        <div className="pt-4 border-t border-slate-800">
          <button type="submit" disabled={saving} className="w-full md:w-auto px-8 py-3 bg-violet-600 hover:bg-violet-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50">
            {saving ? 'Saving...' : 'Update Anime'}
          </button>
        </div>
      </form>
    </div>
  );
}
