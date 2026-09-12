'use client';
import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { Trash2, PlusCircle, ChevronDown, ChevronUp, UploadCloud, ArrowLeft, Server as ServerIcon, Download, Video, Film, CheckCircle2, Loader2, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { adminFetch } from '@/lib/adminApi';
import UploadQualityFields from '@/components/UploadQualityFields';

interface Season { id: number; anime_id: number; season_number: number; title: string; }
interface Episode { id: number; anime_id: number; season_id: number; episode_number: number; title: string; thumbnail: string; }
interface StreamServer { id: number; episode_id: number; server_name: string; server_type: string; stream_url: string; server_order: number; }
interface DownloadLink { id: number; episode_id: number; quality: string; download_url: string; file_size: string; }

export default function EpisodesPage() {
  const params = useParams();
  const animeId = params.id as string;

  const [anime, setAnime] = useState<{ title: string } | null>(null);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [selectedSeason, setSelectedSeason] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  // Add season form
  const [newSeasonNum, setNewSeasonNum] = useState(1);
  const [newSeasonTitle, setNewSeasonTitle] = useState('');

  // Add episode form
  const [newEpNum, setNewEpNum] = useState(1);
  const [newEpTitle, setNewEpTitle] = useState('');
  const [sourceQuality,setSourceQuality]=useState('0');
  const [displayQuality,setDisplayQuality]=useState('');
  const [serverSourceQuality,setServerSourceQuality]=useState('0');
  const [serverDisplayQuality,setServerDisplayQuality]=useState('');
  const [newEpThumb, setNewEpThumb] = useState<File | null>(null);
  const [newEpVideo, setNewEpVideo] = useState<File | null>(null);
  const [newEpStreamUrl, setNewEpStreamUrl] = useState('');
  const [addingEp, setAddingEp] = useState(false);
  const [newEpProgress, setNewEpProgress] = useState<{ pct: number; text: string } | null>(null);

  // Expanded episode (for server/download management)
  const [expandedEp, setExpandedEp] = useState<number | null>(null);
  const [epServers, setEpServers] = useState<StreamServer[]>([]);
  const [epDownloads, setEpDownloads] = useState<DownloadLink[]>([]);

  // Direct video upload into existing episode
  const [serverVideoFile, setServerVideoFile] = useState<File | null>(null);
  const [serverVideoName, setServerVideoName] = useState('Server 1 (Uploaded Video)');
  const [uploadingServerVideo, setUploadingServerVideo] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ pct: number; text: string } | null>(null);
  const [transcodeJobs, setTranscodeJobs] = useState<Record<number, { status: string; progress_text: string; error?: string; actual_height?: number; video_codec?: string; audio_codec?: string; quality_warning?: string }>>({});

  // Add external server form
  const [newServerName, setNewServerName] = useState('Server 2 - External');
  const [newServerType, setNewServerType] = useState('embed');
  const [newServerUrl, setNewServerUrl] = useState('');

  // Add download form
  const [newDlQuality, setNewDlQuality] = useState('720p');
  const [newDlUrl, setNewDlUrl] = useState('');
  const [newDlSize, setNewDlSize] = useState('');

  const fetchAnime = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/anime/${animeId}`);
      const data = await res.json();
      setAnime({ title: data.title });
    } catch { /* ignore */ }
  }, [animeId]);

  const fetchSeasons = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/seasons?anime_id=${animeId}`);
      const data = await res.json();
      setSeasons(data);
      if (data.length > 0 && !selectedSeason) {
        setSelectedSeason(data[0].id);
      }
    } catch { /* ignore */ }
  }, [animeId, selectedSeason]);

  const fetchEpisodes = useCallback(async () => {
    if (!selectedSeason) return;
    try {
      const res = await fetch(`/api/admin/episodes?season_id=${selectedSeason}`);
      const data = await res.json();
      setEpisodes(data);
      if (data.length > 0) {
        setNewEpNum(Math.max(...data.map((e: Episode) => e.episode_number)) + 1);
      }
    } catch { /* ignore */ }
  }, [selectedSeason]);

  useEffect(() => {
    fetchAnime().then(() => fetchSeasons().then(() => setLoading(false)));
  }, [fetchAnime, fetchSeasons]);

  useEffect(() => {
    if (selectedSeason) fetchEpisodes();
  }, [selectedSeason, fetchEpisodes]);

  const addSeason = async () => {
    if (!newSeasonTitle.trim()) return;
    await adminFetch('/api/admin/seasons', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ anime_id: parseInt(animeId), season_number: newSeasonNum, title: newSeasonTitle }),
    });
    setNewSeasonTitle('');
    setNewSeasonNum(seasons.length + 2);
    await fetchSeasons();
  };

  const deleteSeason = async (sid: number) => {
    if (!confirm('Delete this season and all its episodes?')) return;
    await adminFetch(`/api/admin/seasons?id=${sid}`, { method: 'DELETE' });
    if (selectedSeason === sid) setSelectedSeason(null);
    await fetchSeasons();
  };

  const addEpisode = async () => {
    if (!selectedSeason || !newEpTitle.trim()) {
      alert('Please provide an episode title');
      return;
    }
    setAddingEp(true);
    setNewEpProgress({ pct: 0, text: '0 MB' });

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

    // 1. Upload video in 4MB chunks if provided
    let preUploadedVideoUrl = '';
    if (newEpVideo) {
      try {
        const { uploadVideoInChunks } = await import('@/lib/chunkedUpload');
        preUploadedVideoUrl = await uploadVideoInChunks(newEpVideo, token, (pct, loadedMb, totalMb) => {
          setNewEpProgress({ pct, text: `${loadedMb} / ${totalMb} MB` });
        });
      } catch (uploadErr: any) {
        releaseWakeLock();
        setAddingEp(false);
        setNewEpProgress(null);
        alert('Video upload error: ' + (uploadErr.message || 'Connection dropped'));
        return;
      }
    }

    // 2. Submit episode details
    const fd = new FormData();
    fd.append('anime_id', animeId);
    fd.append('season_id', String(selectedSeason));
    fd.append('episode_number', String(newEpNum));
    fd.append('title', newEpTitle);
    fd.append('source_quality',sourceQuality);
    fd.append('display_quality',displayQuality);
    if (newEpThumb) fd.append('thumbnail', newEpThumb);
    if (preUploadedVideoUrl) fd.append('video_url', preUploadedVideoUrl);
    if (newEpStreamUrl) fd.append('stream_url', newEpStreamUrl);

    try {
      const res = await fetch('/api/admin/episodes', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: fd,
      });

      releaseWakeLock();
      setAddingEp(false);
      setNewEpProgress(null);

      if (res.ok) {
        setNewEpTitle('');
        setNewEpThumb(null);
        setNewEpVideo(null);
        setNewEpStreamUrl('');
        setNewEpNum(newEpNum + 1);
        await fetchEpisodes();
      } else {
        const err = await res.json().catch(() => ({}));
        alert('Failed to add episode: ' + (err.error || 'Server error'));
      }
    } catch (err: any) {
      releaseWakeLock();
      setAddingEp(false);
      setNewEpProgress(null);
      alert('Network error adding episode: ' + (err.message || 'Failed'));
    }
  };

  const deleteEpisode = async (eid: number) => {
    if (!confirm('Delete this episode?')) return;
    await adminFetch(`/api/admin/episodes?id=${eid}`, { method: 'DELETE' });
    await fetchEpisodes();
  };

  const pollTranscodeJob = (sid: number) => {
    const timer = setInterval(async () => {
      try {
        const res = await fetch(`/api/admin/transcode-status?server_id=${sid}`);
        const data = await res.json();
        if (data.status && data.status !== 'none') {
          setTranscodeJobs((prev) => ({
            ...prev,
            [sid]: data,
          }));
          if (data.status === 'complete' || data.status === 'failed' || data.status === 'cancelled') {
            clearInterval(timer);
          }
        } else {
          clearInterval(timer);
        }
      } catch {
        clearInterval(timer);
      }
    }, 2500);
  };

  const toggleExpand = async (eid: number) => {
    if (expandedEp === eid) { setExpandedEp(null); return; }
    setExpandedEp(eid);
    setServerSourceQuality('0');setServerDisplayQuality('');
    try {
      const res = await adminFetch(`/api/admin/episodes/${eid}`);
      const data = await res.json();
      const srvs: StreamServer[] = data.servers || [];
      setServerDisplayQuality(data.display_quality || '');
      setEpServers(srvs);
      setEpDownloads(data.downloads || []);

      // Check transcode status for direct / HLS servers
      srvs.forEach((s) => {
        if (s.server_type === 'direct' || s.stream_url.includes('.m3u8')) {
          fetch(`/api/admin/transcode-status?server_id=${s.id}`)
            .then((r) => r.json())
            .then((job) => {
              if (job.status && job.status !== 'none') {
                setTranscodeJobs((prev) => ({
                  ...prev,
                  [s.id]: job,
                }));
                if (job.status === 'processing' || job.status === 'pending') {
                  pollTranscodeJob(s.id);
                }
              }
            })
            .catch(() => {});
        }
      });
    } catch { /* ignore */ }
  };

  // Upload a video file directly to existing episode with chunked upload & progress tracking
  const uploadVideoToServer = async () => {
    if (!expandedEp || !serverVideoFile) return;
    setUploadingServerVideo(true);
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

    // 1. Upload video file first in 4MB chunks
    let preUploadedVideoUrl = '';
    try {
      const { uploadVideoInChunks } = await import('@/lib/chunkedUpload');
      preUploadedVideoUrl = await uploadVideoInChunks(serverVideoFile, token, (pct, loadedMb, totalMb) => {
        setUploadProgress({ pct, text: `${loadedMb} / ${totalMb} MB` });
      });
    } catch (uploadErr: any) {
      releaseWakeLock();
      setUploadingServerVideo(false);
      setUploadProgress(null);
      alert('Video upload error: ' + (uploadErr.message || 'Connection dropped'));
      return;
    }

    // 2. Register video server with episode
    const fd = new FormData();
    fd.append('video_url', preUploadedVideoUrl);
    fd.append('episode_id', String(expandedEp));
    fd.append('source_quality',serverSourceQuality);
    fd.append('display_quality',serverDisplayQuality);
    fd.append('server_name', serverVideoName || 'Multi-Quality HD (2K/1080p/720p/360p)');

    try {
      const res = await fetch('/api/admin/upload-video', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: fd,
      });

      releaseWakeLock();
      setUploadingServerVideo(false);
      setUploadProgress(null);

      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        setServerVideoFile(null);
        if (data.serverId) {
          setTranscodeJobs((prev) => ({
            ...prev,
            [data.serverId]: {
              status: 'processing',
              progress_text: 'Starting background multi-quality HLS transcoding...',
            },
          }));
          pollTranscodeJob(data.serverId);
        }
        toggleExpand(expandedEp);
      } else {
        alert(`Server registration failed (Status: ${res.status}).`);
      }
    } catch (err: any) {
      releaseWakeLock();
      setUploadingServerVideo(false);
      setUploadProgress(null);
      alert('Network error: ' + (err.message || 'Failed'));
    }
  };

  const cleanInputUrl = (url: string) => {
    if (!url) return '';
    let clean = url.trim();
    if (clean.includes('<iframe') || clean.includes('src=')) {
      const match = clean.match(/src=["']([^"']+)["']/i);
      if (match && match[1]) {
        return match[1];
      }
    }
    return clean;
  };

  const addExternalServer = async () => {
    if (!expandedEp || !newServerUrl.trim()) return;
    const finalUrl = cleanInputUrl(newServerUrl);
    await adminFetch('/api/admin/servers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        episode_id: expandedEp, 
        server_name: newServerName || 'Archive Server', 
        server_type: 'embed', 
        stream_url: finalUrl, 
        server_order: epServers.length 
      }),
    });
    setNewServerUrl('');
    toggleExpand(expandedEp);
  };

  const deleteServerItem = async (sid: number) => {
    await adminFetch(`/api/admin/servers?id=${sid}`, { method: 'DELETE' });
    if (expandedEp) toggleExpand(expandedEp);
  };

  const addDownload = async () => {
    if (!expandedEp || !newDlUrl.trim()) return;
    await adminFetch('/api/admin/downloads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ episode_id: expandedEp, quality: newDlQuality, download_url: newDlUrl, file_size: newDlSize }),
    });
    setNewDlUrl('');
    setNewDlSize('');
    toggleExpand(expandedEp);
  };

  const deleteDownloadItem = async (did: number) => {
    await adminFetch(`/api/admin/downloads?id=${did}`, { method: 'DELETE' });
    if (expandedEp) toggleExpand(expandedEp);
  };

  if (loading) return <div className="text-slate-400 text-center py-10">Loading...</div>;

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      <div className="flex items-center gap-4">
        <Link href="/admin/anime" className="p-2 rounded-lg bg-[#1a1a2e] text-slate-400 hover:text-white"><ArrowLeft size={20} /></Link>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-white">Episodes & Video Uploads</h1>
          <p className="text-slate-400 text-sm">{anime?.title}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Seasons Panel */}
        <div className="bg-[#1a1a2e] p-5 rounded-2xl border border-slate-800 space-y-4">
          <h2 className="text-lg font-semibold text-white">Seasons</h2>
          <div className="space-y-2">
            {seasons.map(s => (
              <div key={s.id} onClick={() => setSelectedSeason(s.id)}
                className={`flex justify-between items-center p-3 rounded-lg cursor-pointer border transition-colors ${selectedSeason === s.id ? 'bg-violet-600/20 border-violet-500 text-white' : 'bg-[#0f0f1a] border-slate-800 text-slate-300 hover:bg-slate-800'}`}>
                <span className="font-medium">{s.title || `Season ${s.season_number}`}</span>
                <button onClick={(e) => { e.stopPropagation(); deleteSeason(s.id); }} className="text-red-400 hover:text-red-300 p-1"><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
          <div className="space-y-2 pt-3 border-t border-slate-800">
            <div className="flex gap-2">
              <input type="number" min="1" value={newSeasonNum} onChange={e => setNewSeasonNum(parseInt(e.target.value) || 1)} placeholder="#" className="w-16 bg-[#0f0f1a] border border-slate-800 rounded-lg p-2 text-white text-center text-sm outline-none" />
              <input type="text" value={newSeasonTitle} onChange={e => setNewSeasonTitle(e.target.value)} placeholder="Season Title" className="flex-1 bg-[#0f0f1a] border border-slate-800 rounded-lg p-2 text-white text-sm outline-none" />
            </div>
            <button onClick={addSeason} className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg flex items-center justify-center gap-2 text-sm transition-colors">
              <PlusCircle size={16} /> Add Season
            </button>
          </div>
        </div>

        {/* Episodes Panel */}
        <div className="lg:col-span-2 space-y-4">
          {/* Add Episode Form with Video File Upload */}
          {selectedSeason && (
            <div className="bg-[#1a1a2e] p-5 rounded-2xl border border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  <PlusCircle size={18} className="text-violet-400" /> Add New Episode
                </h3>
                <span className="text-xs text-slate-400">Upload video file directly or add link</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <input 
                  type="number" 
                  min="1" 
                  value={newEpNum} 
                  onChange={e => setNewEpNum(parseInt(e.target.value) || 1)} 
                  className="bg-[#0f0f1a] border border-slate-800 rounded-lg p-2.5 text-white text-sm outline-none" 
                  placeholder="Ep #" 
                />
                <input 
                  type="text" 
                  value={newEpTitle} 
                  onChange={e => setNewEpTitle(e.target.value)} 
                  className="md:col-span-3 bg-[#0f0f1a] border border-slate-800 rounded-lg p-2.5 text-white text-sm outline-none" 
                  placeholder="Episode Title (e.g. Episode 1, The Awakening...)" 
                />
              </div>

              {/* Video File Upload Box for Episode */}
              <UploadQualityFields source={sourceQuality} display={displayQuality} onSource={setSourceQuality} onDisplay={setDisplayQuality} />
              <div className="p-3.5 bg-[#0f0f1a] rounded-xl border border-slate-800 space-y-2">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Video size={16} className="text-violet-400" /> Upload Anime Episode Video File (.mp4, .mkv, .webm):
                </label>
                
                <div className="flex flex-col sm:flex-row gap-3 items-center">
                  <label className="flex-1 w-full flex items-center justify-center gap-2 bg-[#1a1a2e] border border-dashed border-slate-700 hover:border-violet-500 rounded-lg p-3 cursor-pointer text-slate-300 text-sm transition-colors">
                    <Film size={18} className="text-violet-400" />
                    <span className="truncate">{newEpVideo ? `Selected: ${newEpVideo.name}` : 'Click to Select Anime Video File'}</span>
                    <input 
                      type="file" 
                      className="hidden" 
                      accept="video/*,.ts,.mp4,.mkv,.webm"
                      onChange={e => { if (e.target.files?.[0]) setNewEpVideo(e.target.files[0]); }} 
                    />
                  </label>

                  {newEpVideo && (
                    <button 
                      type="button" 
                      onClick={() => setNewEpVideo(null)} 
                      className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg"
                    >
                      Remove
                    </button>
                  )}

                  {/* Thumbnail Selector */}
                  <label className="sm:w-36 w-full flex items-center justify-center gap-1 bg-[#1a1a2e] border border-slate-800 rounded-lg p-3 cursor-pointer text-slate-400 text-sm hover:text-white">
                    <UploadCloud size={16} /> {newEpThumb ? 'Thumb OK' : 'Add Thumb'}
                    <input type="file" className="hidden" accept="image/*" onChange={e => { if (e.target.files?.[0]) setNewEpThumb(e.target.files[0]); }} />
                  </label>
                </div>

                {/* Alternative stream URL */}
                <input 
                  type="text" 
                  value={newEpStreamUrl} 
                  onChange={e => setNewEpStreamUrl(e.target.value)} 
                  placeholder="Or paste external stream/embed link (if not uploading file)" 
                  className="w-full bg-[#1a1a2e] border border-slate-800 rounded-lg p-2 text-xs text-white outline-none focus:border-violet-500" 
                />
              </div>

              {newEpProgress && (
                <div className="p-4 bg-violet-600/20 border border-violet-500/40 rounded-xl space-y-2">
                  <div className="flex items-center justify-between text-xs text-violet-300">
                    <span className="flex items-center gap-2 font-medium">
                      <Loader2 className="animate-spin" size={14} />
                      {newEpProgress.pct < 100 ? 'Uploading Episode File...' : 'Server processing...'}
                    </span>
                    <span className="font-bold">{newEpProgress.pct}%</span>
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-violet-600 to-fuchsia-500 rounded-full transition-all duration-300 ease-out"
                      style={{ width: `${newEpProgress.pct}%` }}
                    />
                  </div>
                  <div className="flex justify-between items-center text-xs text-slate-400">
                    <span className="text-[11px] text-amber-400/90">📱 Screen ON rakhein</span>
                    <span>{newEpProgress.text}</span>
                  </div>
                </div>
              )}

              <button 
                onClick={addEpisode} 
                disabled={addingEp} 
                className="w-full py-2.5 bg-violet-600 hover:bg-violet-700 text-white font-bold rounded-lg text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {addingEp ? <><Loader2 className="animate-spin" size={16} /> Uploading ({newEpProgress ? `${newEpProgress.pct}%` : 'Please wait'})...</> : 'Save & Add Episode'}
              </button>
            </div>
          )}

          {/* Episode List */}
          <div className="space-y-3">
            {episodes.length === 0 && selectedSeason && (
              <div className="bg-[#1a1a2e] p-8 rounded-2xl border border-slate-800 text-center text-slate-400">
                No episodes yet. Upload an episode video file above!
              </div>
            )}
            {!selectedSeason && (
              <div className="bg-[#1a1a2e] p-8 rounded-2xl border border-slate-800 text-center text-slate-400">
                Select a season or create one first.
              </div>
            )}

            {episodes.map(ep => (
              <div key={ep.id} className="bg-[#1a1a2e] rounded-xl border border-slate-800 overflow-hidden">
                {/* Episode Header */}
                <div className="flex items-center justify-between p-4 hover:bg-slate-800/20 cursor-pointer" onClick={() => toggleExpand(ep.id)}>
                  <div className="flex items-center gap-3">
                    {ep.thumbnail ? (
                      <img src={ep.thumbnail} alt="" className="w-14 h-9 object-cover rounded" />
                    ) : (
                      <div className="w-14 h-9 bg-slate-800 rounded flex items-center justify-center font-bold text-white text-sm">
                        {ep.episode_number}
                      </div>
                    )}
                    <div>
                      <h4 className="font-medium text-white text-sm">{ep.title || `Episode ${ep.episode_number}`}</h4>
                      <span className="text-xs text-slate-400">Episode #{ep.episode_number}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={(e) => { e.stopPropagation(); deleteEpisode(ep.id); }} className="p-1.5 text-red-400 hover:bg-red-500/10 rounded"><Trash2 size={16} /></button>
                    {expandedEp === ep.id ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
                  </div>
                </div>

                {/* Expanded: Servers & Downloads */}
                {expandedEp === ep.id && (
                  <div className="border-t border-slate-800 p-5 space-y-5 bg-[#0f0f1a]">
                    
                    {/* 🎬 DIRECT VIDEO UPLOAD FOR THIS EPISODE */}
                    <UploadQualityFields source={serverSourceQuality} display={serverDisplayQuality} onSource={setServerSourceQuality} onDisplay={setServerDisplayQuality} />
                    <button type="button" className="rounded bg-slate-700 px-3 py-2 text-sm text-white" onClick={async()=>{
                      const body=new FormData();body.set('display_quality',serverDisplayQuality);
                      try {
                        const response=await adminFetch(`/api/admin/episodes/${ep.id}`,{method:'PUT',body});
                        if(!response.ok)throw new Error('Could not save quality label');
                        await fetchEpisodes();alert('Display quality saved.');
                      } catch {alert('Could not save display quality.');}
                    }}>Save display quality without uploading</button>
                    <div className="p-4 bg-[#1a1a2e] rounded-xl border border-violet-500/30 space-y-3">
                      <h5 className="text-sm font-semibold text-white flex items-center gap-2">
                        <Video size={16} className="text-violet-400" /> Upload Video File to this Episode:
                      </h5>
                      
                      <div className="flex flex-col sm:flex-row gap-2">
                        <input 
                          value={serverVideoName} 
                          onChange={e => setServerVideoName(e.target.value)} 
                          placeholder="Server Name (e.g. Hindi Dub 1080p)" 
                          className="sm:w-56 bg-[#0f0f1a] border border-slate-800 rounded-lg p-2 text-white text-xs outline-none focus:border-violet-500" 
                        />
                        <label className="flex-1 flex items-center justify-center gap-2 bg-[#0f0f1a] border border-dashed border-slate-700 hover:border-violet-500 rounded-lg p-2 cursor-pointer text-slate-300 text-xs transition-colors">
                          <Film size={16} className="text-violet-400" />
                          <span className="truncate">{serverVideoFile ? `File: ${serverVideoFile.name}` : 'Choose .mp4 / .webm Video File'}</span>
                          <input 
                            type="file" 
                            className="hidden" 
                            accept="video/*,.ts,.mp4,.mkv,.webm"
                            onChange={e => { if (e.target.files?.[0]) setServerVideoFile(e.target.files[0]); }} 
                          />
                        </label>
                        <button 
                          onClick={uploadVideoToServer} 
                          disabled={uploadingServerVideo || !serverVideoFile} 
                          className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-xs font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
                        >
                          {uploadingServerVideo ? <><Loader2 size={14} className="animate-spin" /> Uploading...</> : 'Upload & Attach'}
                        </button>
                      </div>

                      {/* Real-time Upload Progress Bar */}
                      {uploadProgress && (
                        <div className="space-y-1.5 p-3 bg-[#0f0f1a] border border-violet-500/30 rounded-lg">
                          <div className="flex justify-between text-xs font-bold text-violet-300">
                            <span className="flex items-center gap-1.5">
                              <Loader2 size={12} className="animate-spin text-violet-400" /> Uploading video file...
                            </span>
                            <span>{uploadProgress.pct}% ({uploadProgress.text})</span>
                          </div>
                          <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                            <div
                              className="bg-gradient-to-r from-violet-600 to-indigo-400 h-2 rounded-full transition-all duration-150"
                              style={{ width: `${uploadProgress.pct}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Servers List */}
                    <div>
                      <h5 className="text-sm font-semibold text-violet-400 mb-2 flex items-center gap-1">
                        <ServerIcon size={14} /> Active Video Servers ({epServers.length}):
                      </h5>
                      
                      {epServers.length === 0 && (
                        <p className="text-xs text-slate-500 italic mb-2">No servers added yet. Upload a video file above or add an external URL below.</p>
                      )}

                      {epServers.map(s => {
                        const job = transcodeJobs[s.id];
                        return (
                          <div key={s.id} className="flex items-center justify-between bg-[#1a1a2e] p-2.5 rounded-lg mb-1.5 text-sm border border-slate-800">
                            <div className="flex items-center gap-2 text-slate-300 min-w-0 flex-wrap">
                              <span className="font-semibold text-white whitespace-nowrap">{s.server_name}</span>
                              <span className="text-xs px-2 py-0.5 bg-violet-600/20 text-violet-300 rounded font-mono">{s.server_type}</span>
                              
                              {job?.actual_height && <span className="text-xs">Actual: {job.actual_height}p · {job.video_codec} / {job.audio_codec || 'no audio'}</span>}
                              {job?.quality_warning && <span className="text-xs text-amber-300">{job.quality_warning}</span>}
                              {job?.error && <span className="text-xs text-red-300 break-all">{job.error}</span>}
                              {job && job.status==='failed' && <button type="button" className="px-2 py-1 bg-violet-600 rounded" onClick={async()=>{
                                const response=await adminFetch('/api/admin/transcode-status',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({server_id:s.id})});
                                const result=await response.json();
                                if(!response.ok){alert(result.error || 'Retry failed');return;}
                                setTranscodeJobs(prev=>({...prev,[s.id]:{...prev[s.id],status:'pending',error:'',progress_text:'Retry queued'}}));
                                pollTranscodeJob(s.id);
                              }}>Retry</button>}
                              {/* Transcode Status Badge */}
                              {job ? (
                                job.status === 'processing' ? (
                                  <span className="text-[11px] bg-violet-500/20 text-violet-300 px-2 py-0.5 rounded flex items-center gap-1 font-medium border border-violet-500/30">
                                    <Loader2 size={11} className="animate-spin text-violet-400" /> {job.progress_text}
                                  </span>
                                ) : job.status === 'complete' ? (
                                  <span className="text-[11px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded flex items-center gap-1 font-bold border border-emerald-500/30">
                                    <CheckCircle2 size={11} className="text-emerald-400" /> {job.progress_text}
                                  </span>
                                ) : (
                                  <span className="text-[11px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded flex items-center gap-1 font-medium">
                                    <AlertTriangle size={11} className="text-amber-400" /> {job.progress_text}
                                  </span>
                                )
                              ) : s.stream_url.includes('.m3u8') ? (
                                <span className="text-[11px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded flex items-center gap-1 font-bold border border-emerald-500/30">
                                  <CheckCircle2 size={11} className="text-emerald-400" /> Multi-Quality HLS Ready
                                </span>
                              ) : null}

                              <span className="truncate text-xs text-slate-400">{s.stream_url}</span>
                            </div>
                            <button onClick={() => deleteServerItem(s.id)} className="text-red-400 hover:text-red-300 p-1 shrink-0"><Trash2 size={14} /></button>
                          </div>
                        );
                      })}

                      {/* Add External Server */}
                      <div className="flex flex-col sm:flex-row gap-2 mt-3 pt-3 border-t border-slate-800/80">
                        <input value={newServerName} onChange={e => setNewServerName(e.target.value)} placeholder="Server Name" className="sm:w-32 bg-[#1a1a2e] border border-slate-800 rounded-lg p-2 text-white text-xs outline-none" />
                        <select value={newServerType} onChange={e => setNewServerType(e.target.value)} className="bg-[#1a1a2e] border border-slate-800 rounded-lg p-2 text-white text-xs outline-none">
                          <option value="embed">Embed (iframe)</option>
                          <option value="direct">Direct (.mp4)</option>
                        </select>
                        <input value={newServerUrl} onChange={e => setNewServerUrl(e.target.value)} placeholder="External Stream / Embed URL" className="flex-1 bg-[#1a1a2e] border border-slate-800 rounded-lg p-2 text-white text-xs outline-none" />
                        <button onClick={addExternalServer} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold">Add URL</button>
                      </div>
                    </div>

                    {/* Downloads */}
                    <div>
                      <h5 className="text-sm font-semibold text-green-400 mb-2 flex items-center gap-1"><Download size={14} /> Download Links</h5>
                      {epDownloads.map(d => (
                        <div key={d.id} className="flex items-center justify-between bg-[#1a1a2e] p-2.5 rounded-lg mb-1.5 text-sm border border-slate-800">
                          <div className="flex items-center gap-2 text-slate-300 min-w-0">
                            <span className="font-semibold text-white">{d.quality}</span>
                            <span className="truncate text-xs text-slate-400">{d.download_url}</span>
                            {d.file_size && <span className="text-xs text-slate-500">({d.file_size})</span>}
                          </div>
                          <button onClick={() => deleteDownloadItem(d.id)} className="text-red-400 hover:text-red-300 p-1"><Trash2 size={14} /></button>
                        </div>
                      ))}
                      <div className="flex flex-col sm:flex-row gap-2 mt-2">
                        <select value={newDlQuality} onChange={e => setNewDlQuality(e.target.value)} className="sm:w-28 bg-[#1a1a2e] border border-slate-800 rounded-lg p-2 text-white text-xs outline-none">
                          <option value="480p">480p</option><option value="720p">720p</option><option value="1080p">1080p</option><option value="4K">4K</option>
                        </select>
                        <input value={newDlUrl} onChange={e => setNewDlUrl(e.target.value)} placeholder="Download URL" className="flex-1 bg-[#1a1a2e] border border-slate-800 rounded-lg p-2 text-white text-xs outline-none" />
                        <input value={newDlSize} onChange={e => setNewDlSize(e.target.value)} placeholder="Size (e.g. 150MB)" className="sm:w-28 bg-[#1a1a2e] border border-slate-800 rounded-lg p-2 text-white text-xs outline-none" />
                        <button onClick={addDownload} className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-semibold">Add Download</button>
                      </div>
                    </div>

                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
