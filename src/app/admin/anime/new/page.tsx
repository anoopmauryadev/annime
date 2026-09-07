'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { UploadCloud, X, Video, Film, CheckCircle2 } from 'lucide-react';
import { adminFetch } from '@/lib/adminApi';

const GENRES = ["Action", "Adventure", "Comedy", "Drama", "Fantasy", "Horror", "Romance", "Sci-Fi", "School", "Shounen", "Slice of Life", "Sports", "Supernatural", "Thriller"];
const LANGUAGES = ["Hindi", "English", "Japanese", "Tamil", "Telugu"];

export default function NewAnimePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  const [uploadProgress, setUploadProgress] = useState<{ pct: number; text: string } | null>(null);
  
  const [formData, setFormData] = useState({
    title: '', type: 'series', synopsis: '', year: 2024, rating: '', status: 'ongoing', quality: 'HD',
    priority: 0, is_spotlight: false, duration: '', server_name: 'Server 1 - Main', stream_url: ''
  });
  const [languages, setLanguages] = useState<string[]>(['Hindi', 'English']);
  const [genres, setGenres] = useState<string[]>(['Action', 'Adventure']);
  
  // Image files
  const [poster, setPoster] = useState<File | null>(null);
  const [backdrop, setBackdrop] = useState<File | null>(null);
  const [thumbnail, setThumbnail] = useState<File | null>(null);

  // Video file
  const [videoFile, setVideoFile] = useState<File | null>(null);

  const toggleArray = (val: string, arr: string[], setArr: (a: string[]) => void) => {
    setArr(arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setUploadStatus(videoFile ? 'Preparing video upload...' : 'Saving anime...');
    setUploadProgress({ pct: 0, text: '0 MB' });

    let wakeLock: any = null;
    if (typeof navigator !== 'undefined' && 'wakeLock' in navigator) {
      try {
        wakeLock = await (navigator as any).wakeLock.request('screen');
      } catch {}
    }
    const releaseWakeLock = () => {
      if (wakeLock) {
        wakeLock.release().catch(() => {});
        wakeLock = null;
      }
    };

    const token = '';

    // 1. Upload video file first in 4MB chunks (prevents 1.4MB freeze on mobile & Mac)
    let preUploadedVideoUrl = '';
    if (videoFile) {
      setUploadStatus('Uploading video in 4MB fast chunks (0%)...');
      try {
        const { uploadVideoInChunks } = await import('@/lib/chunkedUpload');
        preUploadedVideoUrl = await uploadVideoInChunks(videoFile, token, (pct, loadedMb, totalMb) => {
          setUploadProgress({ pct, text: `${loadedMb} / ${totalMb} MB` });
          setUploadStatus(pct < 100 ? `Uploading video: ${pct}% (${loadedMb} / ${totalMb} MB)` : 'Video uploaded! Saving anime details...');
        });
      } catch (uploadErr: any) {
        releaseWakeLock();
        setLoading(false);
        setUploadProgress(null);
        setUploadStatus('');
        alert('Video upload error: ' + (uploadErr.message || 'Connection dropped'));
        return;
      }
    }

    // 2. Submit anime metadata and images
    setUploadStatus('Saving anime details and images...');
    const data = new FormData();
    Object.entries(formData).forEach(([k, v]) => data.append(k, String(v)));
    data.append('languages', JSON.stringify(languages));
    data.append('genres', JSON.stringify(genres));
    if (poster) data.append('poster', poster);
    if (backdrop) data.append('backdrop', backdrop);
    if (thumbnail) data.append('thumbnail', thumbnail);
    if (preUploadedVideoUrl) {
      data.append('video_url', preUploadedVideoUrl);
    }

    try {
      const res = await fetch('/api/admin/anime', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: data,
      });

      releaseWakeLock();
      setLoading(false);
      setUploadProgress(null);
      setUploadStatus('');

      if (res.ok) {
        alert('Anime & files uploaded successfully!');
        router.push('/admin/anime');
      } else {
        const error = await res.json().catch(() => ({}));
        alert('Error: ' + (error.error || 'Failed to create anime'));
      }
    } catch (err: any) {
      releaseWakeLock();
      setLoading(false);
      setUploadProgress(null);
      setUploadStatus('');
      alert('Network error saving anime: ' + (err.message || 'Failed'));
    }
  };

  const FileUpload = ({ label, file, setFile }: { label: string, file: File | null, setFile: (f: File | null) => void }) => (
    <div className="bg-[#1a1a2e] p-4 rounded-xl border border-slate-800">
      <label className="block text-sm font-medium text-slate-300 mb-2">{label}</label>
      {!file ? (
        <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-slate-700 rounded-lg cursor-pointer hover:bg-slate-800/50 transition-colors">
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
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Add New Anime</h1>
          <p className="text-slate-400 text-sm mt-1">Upload anime title, posters, thumbnail, and optional video file.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 bg-[#0f0f1a] p-6 rounded-2xl border border-slate-800">
        {/* Title & Type */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2">
            <label className="block text-sm text-slate-400 mb-1">Anime Title *</label>
            <input 
              type="text" 
              required 
              placeholder="e.g. Solo Leveling, Naruto, Dragon Ball..." 
              value={formData.title} 
              onChange={e => setFormData({...formData, title: e.target.value})} 
              className="w-full bg-[#1a1a2e] border border-slate-800 rounded-lg p-3 text-white focus:border-violet-500 outline-none" 
            />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">Content Type</label>
            <select 
              value={formData.type} 
              onChange={e => setFormData({...formData, type: e.target.value})} 
              className="w-full bg-[#1a1a2e] border border-slate-800 rounded-lg p-3 text-white focus:border-violet-500 outline-none"
            >
              <option value="series">Series (TV / Anime)</option>
              <option value="movie">Movie</option>
              <option value="cartoon">Cartoon</option>
            </select>
          </div>
        </div>

        {/* 🎬 VIDEO FILE UPLOAD SECTION */}
        <div className="bg-[#1a1a2e] p-5 rounded-xl border-2 border-dashed border-violet-500/40 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Video className="text-violet-400" size={22} />
              <h3 className="text-base font-semibold text-white">Upload Anime Video File (Optional - for Movie / Episode 1)</h3>
            </div>
            <span className="text-xs px-2.5 py-1 bg-violet-600/20 text-violet-300 rounded-full font-medium">Direct Video File</span>
          </div>

          <p className="text-xs text-slate-400">
            Aap yahan se direct anime ki <b>video file (.mp4, .webm, .mkv)</b> upload kar sakte hain, ya niche external embed/stream URL de sakte hain.
          </p>

          {!videoFile ? (
            <label className="flex flex-col items-center justify-center w-full py-8 px-4 border-2 border-dashed border-slate-700 hover:border-violet-500 rounded-lg cursor-pointer bg-[#0f0f1a] transition-all">
              <Film className="w-10 h-10 text-violet-400 mb-2" />
              <span className="text-sm font-medium text-white">Click here or Drag & Drop Anime Video File</span>
              <span className="text-xs text-slate-400 mt-1">Supports MP4, WebM, MKV, AVI (Stored in local uploads)</span>
              <input 
                type="file" 
                className="hidden" 
                accept="video/*,.mp4,.mkv,.webm,.mov" 
                onChange={(e) => { if (e.target.files?.[0]) setVideoFile(e.target.files[0]); }} 
              />
            </label>
          ) : (
            <div className="flex items-center justify-between p-4 bg-[#0f0f1a] rounded-lg border border-violet-500/50">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="text-green-400" size={24} />
                <div>
                  <h4 className="text-sm font-medium text-white">{videoFile.name}</h4>
                  <span className="text-xs text-slate-400">Size: {(videoFile.size / (1024 * 1024)).toFixed(2)} MB • Ready to upload</span>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => setVideoFile(null)} 
                className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>
          )}

          {/* OR Stream URL input */}
          <div className="pt-2 border-t border-slate-800">
            <label className="block text-xs text-slate-400 mb-1">...OR Paste External Video Embed / Stream URL (e.g. YouTube / Doodstream / Abyss / Streamwish)</label>
            <input 
              type="text" 
              placeholder="https://..." 
              value={formData.stream_url} 
              onChange={e => setFormData({...formData, stream_url: e.target.value})} 
              className="w-full bg-[#0f0f1a] border border-slate-800 rounded-lg p-2.5 text-sm text-white focus:border-violet-500 outline-none" 
            />
          </div>
        </div>
        
        {/* Images Upload */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <FileUpload label="Poster Image (Cover) *" file={poster} setFile={setPoster} />
          <FileUpload label="Backdrop Banner (Wide)" file={backdrop} setFile={setBackdrop} />
          <FileUpload label="Thumbnail Image (Square/Small)" file={thumbnail} setFile={setThumbnail} />
        </div>

        {/* Synopsis */}
        <div>
          <label className="block text-sm text-slate-400 mb-1">Synopsis / Story</label>
          <textarea 
            rows={4} 
            placeholder="Anime story summary..." 
            value={formData.synopsis} 
            onChange={e => setFormData({...formData, synopsis: e.target.value})} 
            className="w-full bg-[#1a1a2e] border border-slate-800 rounded-lg p-3 text-white focus:border-violet-500 outline-none" 
          />
        </div>

        {/* Year, Rating, Status, Quality */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm text-slate-400 mb-1">Release Year</label>
            <input 
              type="number" 
              value={formData.year} 
              onChange={e => setFormData({...formData, year: parseInt(e.target.value) || 2024})} 
              className="w-full bg-[#1a1a2e] border border-slate-800 rounded-lg p-3 text-white focus:border-violet-500 outline-none" 
            />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">Rating</label>
            <input 
              type="text" 
              value={formData.rating} 
              onChange={e => setFormData({...formData, rating: e.target.value})} 
              placeholder="e.g. 8.5" 
              className="w-full bg-[#1a1a2e] border border-slate-800 rounded-lg p-3 text-white focus:border-violet-500 outline-none" 
            />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">Status</label>
            <select 
              value={formData.status} 
              onChange={e => setFormData({...formData, status: e.target.value})} 
              className="w-full bg-[#1a1a2e] border border-slate-800 rounded-lg p-3 text-white focus:border-violet-500 outline-none"
            >
              <option value="ongoing">Ongoing</option>
              <option value="completed">Completed</option>
              <option value="upcoming">Upcoming</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1">Quality</label>
            <select 
              value={formData.quality} 
              onChange={e => setFormData({...formData, quality: e.target.value})} 
              className="w-full bg-[#1a1a2e] border border-slate-800 rounded-lg p-3 text-white focus:border-violet-500 outline-none"
            >
              <option value="HD">HD</option>
              <option value="Full HD">Full HD</option>
              <option value="4K">4K</option>
              <option value="CAM">CAM</option>
            </select>
          </div>
        </div>

        {/* Audio Languages */}
        <div>
          <label className="block text-sm text-slate-400 mb-2">Available Audio Languages (Hindi, Tamil, Telugu, English, Jap)</label>
          <div className="flex flex-wrap gap-2">
            {LANGUAGES.map(l => (
              <label key={l} className="flex items-center space-x-2 bg-[#1a1a2e] px-3 py-2 rounded-lg cursor-pointer hover:bg-slate-800 transition-colors">
                <input 
                  type="checkbox" 
                  checked={languages.includes(l)} 
                  onChange={() => toggleArray(l, languages, setLanguages)} 
                  className="accent-violet-500" 
                />
                <span className="text-sm text-slate-300">{l}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Genres */}
        <div>
          <label className="block text-sm text-slate-400 mb-2">Genres</label>
          <div className="flex flex-wrap gap-2">
            {GENRES.map(g => (
              <label key={g} className="flex items-center space-x-2 bg-[#1a1a2e] px-3 py-2 rounded-lg cursor-pointer hover:bg-slate-800 transition-colors">
                <input 
                  type="checkbox" 
                  checked={genres.includes(g)} 
                  onChange={() => toggleArray(g, genres, setGenres)} 
                  className="accent-violet-500" 
                />
                <span className="text-sm text-slate-300">{g}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Priority & Spotlight ("upar fast lana") */}
        <div className="flex items-center space-x-6 p-4 bg-[#1a1a2e] rounded-xl border border-slate-800">
          <div className="flex-1">
            <label className="block text-sm text-slate-300 font-semibold mb-1">Priority Rank (0 - 100+)</label>
            <p className="text-xs text-slate-400 mb-2">High number dalo taaki anime sabse upar fast dikhe!</p>
            <input 
              type="number" 
              min="0" 
              max="9999" 
              value={formData.priority} 
              onChange={e => setFormData({...formData, priority: parseInt(e.target.value) || 0})} 
              className="w-32 bg-[#0f0f1a] border border-slate-700 rounded-lg p-2.5 text-white font-bold text-center focus:border-violet-500 outline-none" 
            />
          </div>
          <div className="flex flex-col items-center">
            <label className="text-sm font-semibold text-slate-300 mb-2">Spotlight (Hero Banner)</label>
            <button 
              type="button" 
              onClick={() => setFormData({...formData, is_spotlight: !formData.is_spotlight})} 
              className={`w-14 h-7 rounded-full transition-colors relative ${formData.is_spotlight ? 'bg-violet-600' : 'bg-slate-700'}`}
            >
              <div className={`w-6 h-6 bg-white rounded-full absolute top-0.5 transition-all ${formData.is_spotlight ? 'left-7' : 'left-0.5'}`} />
            </button>
            <span className="text-xs text-slate-400 mt-1">{formData.is_spotlight ? 'Featured ON' : 'OFF'}</span>
          </div>
        </div>

        {(uploadStatus || uploadProgress) && (
          <div className="p-4 bg-violet-600/20 border border-violet-500/40 rounded-xl space-y-3">
            <div className="flex items-center gap-2 text-violet-300 text-sm">
              <div className="w-4 h-4 border-2 border-violet-400 border-t-transparent rounded-full animate-spin"></div>
              {uploadStatus}
            </div>
            {uploadProgress && (
              <div className="space-y-1.5">
                <div className="w-full bg-slate-800 rounded-full h-3 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-violet-600 to-fuchsia-500 rounded-full transition-all duration-300 ease-out"
                    style={{ width: `${uploadProgress.pct}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-slate-400">
                  <span>{uploadProgress.text}</span>
                  <span className="font-bold text-violet-300">{uploadProgress.pct}%</span>
                </div>
                <div className="text-[11px] text-amber-400/90 flex items-center gap-1.5 pt-1">
                  <span>📱</span> Phone se upload karte waqt: Screen on rakhein aur tab change na karein.
                </div>
              </div>
            )}
          </div>
        )}

        {/* Submit */}
        <div className="pt-4 border-t border-slate-800">
          <button 
            type="submit" 
            disabled={loading} 
            className="w-full md:w-auto px-10 py-3.5 bg-violet-600 hover:bg-violet-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-violet-600/20 disabled:opacity-50"
          >
            {loading ? 'Uploading Anime & Files...' : 'Upload Anime & Save'}
          </button>
        </div>
      </form>
    </div>
  );
}
