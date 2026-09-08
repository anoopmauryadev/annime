'use client';
import { useEffect, useState, useCallback } from 'react';
import {
  Activity, Server, Database, HardDrive, Cpu, MemoryStick,
  Clock, RefreshCw, CheckCircle2, XCircle, AlertTriangle,
  Zap, Globe, Shield, Key, Wrench, MonitorCog, Clapperboard
} from 'lucide-react';
import { adminFetch } from '@/lib/adminApi';

interface ServiceInfo {
  name: string;
  status: string;
  detail: string;
}

interface SystemStatus {
  timestamp: string;
  responseTime: string;
  system: {
    hostname: string;
    platform: string;
    nodeVersion: string;
    cpuModel: string;
    cpuCount: number;
    cpuUsage: number;
    memTotal: string;
    memUsed: string;
    memFree: string;
    memPercent: number;
    processUptime: string;
    systemUptime: string;
  };
  database: {
    status: string;
    size: string;
    path: string;
    tables: Record<string, number>;
  };
  storage: {
    disks?: Array<{
      filesystem: string;
      mount: string;
      name: string;
      total: string;
      used: string;
      free: string;
      percent: number;
    }>;
    totalDisk?: string;
    usedDisk?: string;
    freeDisk?: string;
    diskPercent?: number;
    uploadsSize: string;
    uploadFileCount: number;
    uploadsPath: string;
  };
  features: {
    maintenanceMode: boolean;
    keySystemEnabled: boolean;
    shortenerProvider: string;
    hasShortenerKey: boolean;
    autoTranscodeEnabled: boolean;
  };
  services: ServiceInfo[];
}

function StatusDot({ status }: { status: string }) {
  const color =
    status === 'online' || status === 'off'
      ? 'bg-emerald-400 shadow-emerald-400/50'
      : status === 'active'
        ? 'bg-amber-400 shadow-amber-400/50 animate-pulse'
        : status === 'disabled' || status === 'empty'
          ? 'bg-slate-500 shadow-slate-500/50'
          : 'bg-red-400 shadow-red-400/50';

  return <span className={`inline-block w-2.5 h-2.5 rounded-full ${color} shadow-md`} />;
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { bg: string; text: string; label: string }> = {
    online: { bg: 'bg-emerald-500/10 border-emerald-500/30', text: 'text-emerald-400', label: 'Online' },
    off: { bg: 'bg-emerald-500/10 border-emerald-500/30', text: 'text-emerald-400', label: 'Off' },
    active: { bg: 'bg-amber-500/10 border-amber-500/30', text: 'text-amber-400', label: 'Active' },
    disabled: { bg: 'bg-slate-500/10 border-slate-500/30', text: 'text-slate-400', label: 'Disabled' },
    empty: { bg: 'bg-slate-500/10 border-slate-500/30', text: 'text-slate-400', label: 'Empty' },
    error: { bg: 'bg-red-500/10 border-red-500/30', text: 'text-red-400', label: 'Error' },
    offline: { bg: 'bg-red-500/10 border-red-500/30', text: 'text-red-400', label: 'Offline' },
  };

  const c = config[status] || config.offline;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${c.bg} ${c.text}`}>
      <StatusDot status={status} />
      {c.label}
    </span>
  );
}

function ProgressBar({ percent, color }: { percent: number; color: string }) {
  return (
    <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-700 ease-out ${color}`}
        style={{ width: `${Math.min(percent, 100)}%` }}
      />
    </div>
  );
}

export default function SystemStatusPage() {
  const [data, setData] = useState<SystemStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await adminFetch('/api/admin/system-status');
      if (!res.ok) throw new Error('Failed to fetch');
      const json = await res.json();
      setData(json);
      setError('');
      setLastRefresh(new Date());
    } catch {
      setError('Failed to connect to server');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Auto-refresh every 10 seconds
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchStatus, 10000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchStatus]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <RefreshCw size={32} className="mx-auto text-violet-500 animate-spin mb-3" />
          <p className="text-slate-400 text-sm">Loading system status...</p>
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <XCircle size={40} className="mx-auto text-red-500 mb-3" />
          <p className="text-red-400 font-bold">{error}</p>
          <button onClick={fetchStatus} className="mt-4 px-4 py-2 bg-violet-600 rounded-lg text-white text-sm">
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const memColor = data.system.memPercent > 85 ? 'bg-red-500' : data.system.memPercent > 65 ? 'bg-amber-500' : 'bg-emerald-500';
  const cpuColor = data.system.cpuUsage > 85 ? 'bg-red-500' : data.system.cpuUsage > 65 ? 'bg-amber-500' : 'bg-emerald-500';

  const allOnline = data.services.filter(s => s.status === 'online' || s.status === 'off' || s.status === 'disabled').length;
  const overallHealth = allOnline === data.services.length ? 'healthy' : allOnline >= data.services.length - 1 ? 'warning' : 'critical';

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <MonitorCog size={28} className="text-violet-400" />
            System Status
          </h1>
          <p className="text-xs text-slate-400 mt-1">Real-time server health & service monitoring</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Auto refresh toggle */}
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${autoRefresh ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-slate-800 border-slate-700 text-slate-400'}`}
          >
            {autoRefresh ? '⚡ Live' : '⏸ Paused'}
          </button>
          <button
            onClick={fetchStatus}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            title="Refresh now"
          >
            <RefreshCw size={16} />
          </button>
          {lastRefresh && (
            <span className="text-[10px] text-slate-500">
              {lastRefresh.toLocaleTimeString()}
            </span>
          )}
        </div>
      </div>

      {/* Overall Health Banner */}
      <div className={`p-4 rounded-2xl border flex items-center gap-4 ${
        overallHealth === 'healthy'
          ? 'bg-emerald-950/30 border-emerald-500/30'
          : overallHealth === 'warning'
            ? 'bg-amber-950/30 border-amber-500/30'
            : 'bg-red-950/30 border-red-500/30'
      }`}>
        {overallHealth === 'healthy' ? (
          <CheckCircle2 size={24} className="text-emerald-400" />
        ) : overallHealth === 'warning' ? (
          <AlertTriangle size={24} className="text-amber-400" />
        ) : (
          <XCircle size={24} className="text-red-400" />
        )}
        <div>
          <p className={`font-bold text-sm ${
            overallHealth === 'healthy' ? 'text-emerald-400' : overallHealth === 'warning' ? 'text-amber-400' : 'text-red-400'
          }`}>
            {overallHealth === 'healthy' ? 'All Systems Operational' : overallHealth === 'warning' ? 'Partial Service Degradation' : 'Critical Issues Detected'}
          </p>
          <p className="text-xs text-slate-400">
            Response time: {data.responseTime} • {allOnline}/{data.services.length} services healthy
          </p>
        </div>
      </div>

      {/* Services Grid */}
      <div className="bg-[#1a1a2e] rounded-2xl border border-slate-800 overflow-hidden">
        <div className="p-5 border-b border-slate-800 flex items-center gap-2.5">
          <Activity size={18} className="text-violet-400" />
          <h2 className="font-bold text-white">Services</h2>
        </div>
        <div className="divide-y divide-slate-800/60">
          {data.services.map((svc, i) => (
            <div key={i} className="px-5 py-4 flex items-center justify-between hover:bg-slate-800/20 transition-colors">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-slate-800/50">
                  {svc.name.includes('Next') ? <Globe size={16} className="text-blue-400" /> :
                   svc.name.includes('Database') ? <Database size={16} className="text-emerald-400" /> :
                   svc.name.includes('Storage') ? <HardDrive size={16} className="text-purple-400" /> :
                   svc.name.includes('Key') ? <Key size={16} className="text-amber-400" /> :
                   svc.name.includes('Maintenance') ? <Shield size={16} className="text-red-400" /> :
                   svc.name.includes('Transcod') ? <Clapperboard size={16} className="text-cyan-400" /> :
                   <Server size={16} className="text-slate-400" />}
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">{svc.name}</p>
                  <p className="text-[11px] text-slate-500">{svc.detail}</p>
                </div>
              </div>
              <StatusBadge status={svc.status} />
            </div>
          ))}
        </div>
      </div>

      {/* CPU & Memory Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* CPU Card */}
        <div className="bg-[#1a1a2e] rounded-2xl border border-slate-800 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Cpu size={18} className="text-blue-400" />
              </div>
              <h3 className="font-bold text-white text-sm">CPU</h3>
            </div>
            <span className="text-2xl font-black text-white">{data.system.cpuUsage}%</span>
          </div>
          <ProgressBar percent={data.system.cpuUsage} color={cpuColor} />
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="bg-slate-800/40 rounded-lg p-3">
              <p className="text-slate-500 mb-0.5">Model</p>
              <p className="text-white font-medium truncate" title={data.system.cpuModel}>{data.system.cpuModel}</p>
            </div>
            <div className="bg-slate-800/40 rounded-lg p-3">
              <p className="text-slate-500 mb-0.5">Cores</p>
              <p className="text-white font-medium">{data.system.cpuCount} cores</p>
            </div>
          </div>
        </div>

        {/* Memory Card */}
        <div className="bg-[#1a1a2e] rounded-2xl border border-slate-800 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-purple-500/10">
                <MemoryStick size={18} className="text-purple-400" />
              </div>
              <h3 className="font-bold text-white text-sm">Memory (RAM)</h3>
            </div>
            <span className="text-2xl font-black text-white">{data.system.memPercent}%</span>
          </div>
          <ProgressBar percent={data.system.memPercent} color={memColor} />
          <div className="grid grid-cols-3 gap-3 text-xs">
            <div className="bg-slate-800/40 rounded-lg p-3">
              <p className="text-slate-500 mb-0.5">Used</p>
              <p className="text-white font-medium">{data.system.memUsed}</p>
            </div>
            <div className="bg-slate-800/40 rounded-lg p-3">
              <p className="text-slate-500 mb-0.5">Free</p>
              <p className="text-white font-medium">{data.system.memFree}</p>
            </div>
            <div className="bg-slate-800/40 rounded-lg p-3">
              <p className="text-slate-500 mb-0.5">Total</p>
              <p className="text-white font-medium">{data.system.memTotal}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Server Disks & Storage Drives Section (Multi-drive support) */}
      <div className="bg-[#1a1a2e] rounded-2xl border border-slate-800 p-5 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-amber-500/10">
              <HardDrive size={20} className="text-amber-400" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">Server Storage Drives & Partitions</h3>
              <p className="text-xs text-slate-400">
                {data.storage.disks?.length || 0} Physical / Mounted storage volume{data.storage.disks?.length === 1 ? '' : 's'} detected
              </p>
            </div>
          </div>
          {data.storage.totalDisk && (
            <div className="sm:text-right bg-slate-800/40 px-3.5 py-2 rounded-xl border border-slate-700/50">
              <p className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">Total Server Capacity</p>
              <p className="text-base font-black text-amber-400 font-mono">
                {data.storage.totalDisk}
                <span className="text-xs font-normal text-slate-400 font-sans ml-2">
                  ({data.storage.usedDisk} used • {data.storage.freeDisk} free)
                </span>
              </p>
            </div>
          )}
        </div>

        {/* Combined Storage Utilization Bar */}
        {data.storage.diskPercent !== undefined && (
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-slate-400 font-medium">Overall Storage Pool Utilization</span>
              <span className="text-white font-bold font-mono">{data.storage.diskPercent}%</span>
            </div>
            <ProgressBar
              percent={data.storage.diskPercent}
              color={data.storage.diskPercent > 85 ? 'bg-red-500' : data.storage.diskPercent > 70 ? 'bg-amber-500' : 'bg-emerald-500'}
            />
          </div>
        )}

        {/* Individual Storage Drives Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
          {data.storage.disks && data.storage.disks.length > 0 ? (
            data.storage.disks.map((disk, i) => {
              const diskColor = disk.percent > 85 ? 'bg-red-500' : disk.percent > 70 ? 'bg-amber-500' : 'bg-emerald-500';
              return (
                <div key={i} className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-4 space-y-3 hover:border-slate-700 transition-colors">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-white">{disk.name}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-600/20 text-violet-300 font-mono font-bold">
                          {disk.mount}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 font-mono mt-0.5">{disk.filesystem}</p>
                    </div>
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-lg border ${
                      disk.percent > 85 ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                      disk.percent > 70 ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                      'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                    }`}>
                      {disk.percent}% used
                    </span>
                  </div>

                  <ProgressBar percent={disk.percent} color={diskColor} />

                  <div className="grid grid-cols-3 gap-2 pt-1 text-xs">
                    <div className="bg-slate-800/40 rounded-lg p-2 text-center">
                      <p className="text-[10px] text-slate-500">Used</p>
                      <p className="text-white font-semibold font-mono text-xs mt-0.5">{disk.used}</p>
                    </div>
                    <div className="bg-slate-800/40 rounded-lg p-2 text-center">
                      <p className="text-[10px] text-slate-500">Free</p>
                      <p className="text-emerald-400 font-semibold font-mono text-xs mt-0.5">{disk.free}</p>
                    </div>
                    <div className="bg-slate-800/40 rounded-lg p-2 text-center">
                      <p className="text-[10px] text-slate-500">Capacity</p>
                      <p className="text-amber-400 font-semibold font-mono text-xs mt-0.5">{disk.total}</p>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="col-span-2 text-center py-6 text-xs text-slate-500 bg-slate-900/30 rounded-xl border border-slate-800">
              No individual disk volumes detected
            </div>
          )}
        </div>
      </div>

      {/* Server Info & Application Data Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Server Info */}
        <div className="bg-[#1a1a2e] rounded-2xl border border-slate-800 p-5 space-y-3">
          <div className="flex items-center gap-2.5 mb-2">
            <div className="p-2 rounded-lg bg-cyan-500/10">
              <Server size={18} className="text-cyan-400" />
            </div>
            <h3 className="font-bold text-white text-sm">Server & OS Info</h3>
          </div>
          <div className="space-y-2 text-xs">
            {[
              { label: 'Hostname', value: data.system.hostname },
              { label: 'Platform', value: data.system.platform },
              { label: 'Node.js', value: data.system.nodeVersion },
              { label: 'App Uptime', value: data.system.processUptime },
              { label: 'System Uptime', value: data.system.systemUptime },
            ].map((item, i) => (
              <div key={i} className="flex justify-between items-center py-1.5 border-b border-slate-800/50 last:border-0">
                <span className="text-slate-500">{item.label}</span>
                <span className="text-white font-medium font-mono">{item.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Database & Application Media */}
        <div className="bg-[#1a1a2e] rounded-2xl border border-slate-800 p-5 space-y-3">
          <div className="flex items-center gap-2.5 mb-2">
            <div className="p-2 rounded-lg bg-violet-500/10">
              <Database size={18} className="text-violet-400" />
            </div>
            <h3 className="font-bold text-white text-sm">App Database & Video Files</h3>
          </div>
          <div className="space-y-2 text-xs">
            {[
              { label: 'Database Status', value: data.database.status === 'online' ? '✅ Online' : '❌ Error' },
              { label: 'Database File Size', value: data.database.size },
              { label: 'Video Uploads Size', value: data.storage.uploadsSize },
              { label: 'Stored Video & Image Files', value: `${data.storage.uploadFileCount} files` },
              { label: 'Uploads Path', value: data.storage.uploadsPath },
            ].map((item, i) => (
              <div key={i} className="flex justify-between items-center py-1.5 border-b border-slate-800/50 last:border-0">
                <span className="text-slate-500">{item.label}</span>
                <span className="text-white font-medium font-mono truncate max-w-[220px]" title={String(item.value)}>{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Database Tables */}
      <div className="bg-[#1a1a2e] rounded-2xl border border-slate-800 overflow-hidden">
        <div className="p-5 border-b border-slate-800 flex items-center gap-2.5">
          <Database size={18} className="text-emerald-400" />
          <h2 className="font-bold text-white text-sm">Database Tables</h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-px bg-slate-800/30">
          {Object.entries(data.database.tables).map(([table, count]) => (
            <div key={table} className="bg-[#1a1a2e] p-4 text-center">
              <p className="text-2xl font-black text-white mb-1">
                {count === -1 ? '—' : count.toLocaleString()}
              </p>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">{table}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Feature Status */}
      <div className="bg-[#1a1a2e] rounded-2xl border border-slate-800 p-5">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="p-2 rounded-lg bg-violet-500/10">
            <Wrench size={18} className="text-violet-400" />
          </div>
          <h3 className="font-bold text-white text-sm">Feature Flags</h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {[
            {
              label: 'Maintenance Mode',
              enabled: data.features.maintenanceMode,
              icon: Shield,
              activeColor: 'text-red-400 bg-red-500/10',
            },
            {
              label: 'Key System',
              enabled: data.features.keySystemEnabled,
              icon: Key,
              activeColor: 'text-emerald-400 bg-emerald-500/10',
            },
            {
              label: 'Shortener API',
              enabled: data.features.hasShortenerKey,
              icon: Zap,
              activeColor: 'text-amber-400 bg-amber-500/10',
            },
            {
              label: `Provider: ${data.features.shortenerProvider}`,
              enabled: data.features.shortenerProvider !== 'none',
              icon: Globe,
              activeColor: 'text-blue-400 bg-blue-500/10',
            },
            {
              label: 'Auto Transcoding',
              enabled: data.features.autoTranscodeEnabled,
              icon: Clapperboard,
              activeColor: 'text-cyan-400 bg-cyan-500/10',
            },
          ].map((feature, i) => (
            <div key={i} className={`p-4 rounded-xl border text-center ${feature.enabled ? 'border-slate-700 bg-slate-800/20' : 'border-slate-800/50 bg-slate-900/30'}`}>
              <div className={`inline-flex p-2.5 rounded-lg mb-2 ${feature.enabled ? feature.activeColor : 'text-slate-600 bg-slate-800/40'}`}>
                <feature.icon size={18} />
              </div>
              <p className="text-xs font-medium text-slate-300">{feature.label}</p>
              <p className={`text-[10px] font-bold mt-1 ${feature.enabled ? 'text-emerald-400' : 'text-slate-600'}`}>
                {feature.enabled ? 'ENABLED' : 'DISABLED'}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
