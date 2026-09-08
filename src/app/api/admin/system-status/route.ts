import { requireAdminAuth } from "@/lib/auth";
import { getDb, getSiteSettings } from "@/lib/db";
import { NextResponse } from "next/server";
import os from "os";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";

export const dynamic = "force-dynamic";

// Get directory size recursively
function getDirSize(dirPath: string): number {
  let totalSize = 0;
  try {
    if (!fs.existsSync(dirPath)) return 0;
    const items = fs.readdirSync(dirPath);
    for (const item of items) {
      const fullPath = path.join(dirPath, item);
      try {
        const stat = fs.statSync(fullPath);
        if (stat.isFile()) {
          totalSize += stat.size;
        } else if (stat.isDirectory()) {
          totalSize += getDirSize(fullPath);
        }
      } catch { /* skip unreadable files */ }
    }
  } catch { /* dir doesn't exist */ }
  return totalSize;
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function getUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

export interface DiskInfo {
  filesystem: string;
  mount: string;
  name: string;
  total: string;
  used: string;
  free: string;
  percent: number;
  totalBytes: number;
  usedBytes: number;
  freeBytes: number;
}

function getDisksInfo(): DiskInfo[] {
  const disks: DiskInfo[] = [];

  try {
    // POSIX standard df command in 1K blocks
    const stdout = execSync("df -P -k", { encoding: "utf-8", timeout: 4000 });
    const lines = stdout.trim().split("\n").slice(1);
    const seenMounts = new Set<string>();

    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      if (parts.length < 6) continue;

      const fsName = parts[0];
      const totalK = parseInt(parts[1], 10);
      const usedK = parseInt(parts[2], 10);
      const availK = parseInt(parts[3], 10);
      const percentStr = parts[4].replace("%", "");
      const percent = parseInt(percentStr, 10) || 0;
      const mount = parts.slice(5).join(" ");

      if (isNaN(totalK) || totalK <= 0) continue;

      // Filter to keep only physical & mounted storage volumes
      const isRealDevice =
        fsName.startsWith("/dev/") ||
        fsName.startsWith("/dev/mapper/") ||
        fsName.includes("disk") ||
        fsName.includes("nvme") ||
        fsName.includes("sd") ||
        fsName.includes("vd") ||
        fsName.includes("xvd");

      if (!isRealDevice) continue;

      // Filter out snap loops, udev, tmpfs, devfs
      if (
        fsName.includes("/loop") ||
        fsName === "devfs" ||
        fsName === "udev" ||
        fsName === "tmpfs"
      ) {
        continue;
      }

      // Filter out internal macOS system sub-volumes or transient mount points
      if (
        mount.startsWith("/dev") ||
        mount.startsWith("/sys") ||
        mount.startsWith("/proc") ||
        mount.startsWith("/run") ||
        mount.startsWith("/snap") ||
        mount.startsWith("/boot/efi") ||
        mount.includes("/Preboot") ||
        mount.includes("/VM") ||
        mount.includes("/Update") ||
        mount.includes("/xarts") ||
        mount.includes("/iSCPreboot") ||
        mount.includes("/Hardware")
      ) {
        continue;
      }

      if (seenMounts.has(mount)) continue;
      seenMounts.add(mount);

      const totalBytes = totalK * 1024;
      const usedBytes = usedK * 1024;
      const freeBytes = availK * 1024;

      // Friendly disk title
      let displayName = mount === "/" ? "Primary Disk (/)" : `Storage Volume (${mount})`;
      if (mount.includes("Volumes/Data")) displayName = "Data Volume";

      disks.push({
        filesystem: fsName,
        mount,
        name: displayName,
        total: formatBytes(totalBytes),
        used: formatBytes(usedBytes),
        free: formatBytes(freeBytes),
        percent,
        totalBytes,
        usedBytes,
        freeBytes,
      });
    }
  } catch {
    // df failed or restricted environment
  }

  // Fallback: use fs.statfsSync if available
  if (disks.length === 0) {
    try {
      if (typeof (fs as any).statfsSync === "function") {
        const stats = (fs as any).statfsSync("/");
        const totalBytes = stats.blocks * stats.bsize;
        const freeBytes = stats.bavail * stats.bsize;
        const usedBytes = totalBytes - freeBytes;
        const percent = Math.round((usedBytes / totalBytes) * 100);
        disks.push({
          filesystem: "/dev/root",
          mount: "/",
          name: "Primary Storage (/)",
          total: formatBytes(totalBytes),
          used: formatBytes(usedBytes),
          free: formatBytes(freeBytes),
          percent,
          totalBytes,
          usedBytes,
          freeBytes,
        });
      }
    } catch {}
  }

  // Check additional mount points that commonly host second disks on VPS (e.g. /mnt, /data, /home, /var, /opt, /storage)
  const additionalPaths = ["/data", "/mnt", "/home", "/var", "/opt", "/storage", process.cwd()];
  for (const p of additionalPaths) {
    try {
      if (fs.existsSync(p) && typeof (fs as any).statfsSync === "function") {
        const stats = (fs as any).statfsSync(p);
        const totalBytes = stats.blocks * stats.bsize;
        if (totalBytes > 1024 * 1024 * 1024) { // > 1 GB
          const alreadyExists = disks.some(d => Math.abs(d.totalBytes - totalBytes) < 500 * 1024 * 1024);
          if (!alreadyExists) {
            const freeBytes = stats.bavail * stats.bsize;
            const usedBytes = totalBytes - freeBytes;
            const percent = Math.round((usedBytes / totalBytes) * 100);
            disks.push({
              filesystem: `Drive (${path.basename(p) || p})`,
              mount: p,
              name: `Attached Storage (${p})`,
              total: formatBytes(totalBytes),
              used: formatBytes(usedBytes),
              free: formatBytes(freeBytes),
              percent,
              totalBytes,
              usedBytes,
              freeBytes,
            });
          }
        }
      }
    } catch {}
  }

  return disks;
}

export async function GET(request: Request) {
  const auth = requireAdminAuth(request);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  const startTime = Date.now();

  try {
    // ─── System Info ─────────────────────────────────
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const memPercent = Math.round((usedMem / totalMem) * 100);

    const cpus = os.cpus();
    const cpuModel = cpus[0]?.model || "Unknown";
    const cpuCount = cpus.length;

    // CPU usage (average across cores)
    const cpuUsage = cpus.reduce((acc, cpu) => {
      const total = Object.values(cpu.times).reduce((a, b) => a + b, 0);
      const idle = cpu.times.idle;
      return acc + ((total - idle) / total) * 100;
    }, 0) / cpuCount;

    // ─── Database Status ─────────────────────────────
    let dbStatus = "offline";
    let dbSize = "0 B";
    let dbPath = "";
    try {
      const db = getDb();
      db.prepare("SELECT 1").get();
      dbStatus = "online";

      const possiblePaths = [
        path.join(process.cwd(), "data", "anime.db"),
        path.join(process.cwd(), "anime.db"),
      ];
      for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
          dbSize = formatBytes(fs.statSync(p).size);
          dbPath = p;
          break;
        }
      }
    } catch {
      dbStatus = "error";
    }

    // ─── Physical Storage Drives & Uploads ───────────
    const disks = getDisksInfo();
    const totalDiskBytes = disks.reduce((acc, d) => acc + d.totalBytes, 0);
    const usedDiskBytes = disks.reduce((acc, d) => acc + d.usedBytes, 0);
    const freeDiskBytes = disks.reduce((acc, d) => acc + d.freeBytes, 0);
    const diskPercent = totalDiskBytes > 0 ? Math.round((usedDiskBytes / totalDiskBytes) * 100) : 0;

    const uploadsDir = path.join(process.cwd(), "public", "uploads");
    const uploadsSize = getDirSize(uploadsDir);
    let uploadFileCount = 0;
    try {
      if (fs.existsSync(uploadsDir)) {
        const countFiles = (dir: string): number => {
          let count = 0;
          for (const item of fs.readdirSync(dir)) {
            const fullPath = path.join(dir, item);
            try {
              const stat = fs.statSync(fullPath);
              if (stat.isFile()) count++;
              else if (stat.isDirectory()) count += countFiles(fullPath);
            } catch {}
          }
          return count;
        };
        uploadFileCount = countFiles(uploadsDir);
      }
    } catch {}

    // ─── Site Settings / Features ────────────────────
    const settings = getSiteSettings();
    const maintenanceMode = settings.maintenance_mode === "1";
    const keySystemEnabled = settings.key_system_enabled === "1";
    const shortenerProvider = settings.shortener_provider || "none";
    const hasShortenerKey = !!settings.shortener_api_token;
    const autoTranscodeEnabled = settings.auto_transcode_enabled !== "0";

    // ─── Database Table Counts ───────────────────────
    let tableCounts: Record<string, number> = {};
    try {
      const db = getDb();
      const tables = ["anime", "episodes", "servers", "users", "admin_users", "access_keys", "reports", "broadcasts", "site_settings"];
      for (const table of tables) {
        try {
          const row = db.prepare(`SELECT COUNT(*) as count FROM ${table}`).get() as { count: number };
          tableCounts[table] = row.count;
        } catch {
          tableCounts[table] = -1;
        }
      }
    } catch {}

    // ─── Node.js / Next.js Info ──────────────────────
    const nodeVersion = process.version;
    const platform = `${os.type()} ${os.release()}`;
    const hostname = os.hostname();
    const processUptime = process.uptime();
    const systemUptime = os.uptime();

    // ─── Response Time ───────────────────────────────
    const responseTime = Date.now() - startTime;

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      responseTime: `${responseTime}ms`,

      system: {
        hostname,
        platform,
        nodeVersion,
        cpuModel,
        cpuCount,
        cpuUsage: Math.round(cpuUsage),
        memTotal: formatBytes(totalMem),
        memUsed: formatBytes(usedMem),
        memFree: formatBytes(freeMem),
        memPercent,
        processUptime: getUptime(processUptime),
        systemUptime: getUptime(systemUptime),
      },

      database: {
        status: dbStatus,
        size: dbSize,
        path: dbPath,
        tables: tableCounts,
      },

      storage: {
        disks,
        totalDisk: formatBytes(totalDiskBytes),
        usedDisk: formatBytes(usedDiskBytes),
        freeDisk: formatBytes(freeDiskBytes),
        diskPercent,
        uploadsSize: formatBytes(uploadsSize),
        uploadFileCount,
        uploadsPath: uploadsDir,
      },

      features: {
        maintenanceMode,
        keySystemEnabled,
        shortenerProvider,
        hasShortenerKey,
        autoTranscodeEnabled,
      },

      services: [
        {
          name: "Next.js App",
          status: "online",
          detail: `Node ${nodeVersion} | Uptime: ${getUptime(processUptime)}`,
        },
        {
          name: "SQLite Database",
          status: dbStatus,
          detail: `Size: ${dbSize} | ${Object.keys(tableCounts).length} tables`,
        },
        {
          name: "Storage Drives",
          status: disks.length > 0 ? "online" : "error",
          detail: `${formatBytes(usedDiskBytes)} used of ${formatBytes(totalDiskBytes)} (${disks.length} volume${disks.length !== 1 ? 's' : ''})`,
        },
        {
          name: "Video Uploads",
          status: uploadsSize > 0 ? "online" : "empty",
          detail: `${formatBytes(uploadsSize)} | ${uploadFileCount} files`,
        },
        {
          name: "Key System",
          status: keySystemEnabled ? "online" : "disabled",
          detail: keySystemEnabled
            ? `Provider: ${shortenerProvider} | API Key: ${hasShortenerKey ? "✓ Set" : "✗ Missing"}`
            : "Disabled in settings",
        },
        {
          name: "Maintenance Mode",
          status: maintenanceMode ? "active" : "off",
          detail: maintenanceMode ? "Site is offline for users" : "Site is live",
        },
        {
          name: "Auto Transcoding",
          status: autoTranscodeEnabled ? "online" : "disabled",
          detail: autoTranscodeEnabled ? "Videos auto-convert to HLS after upload" : "Transcoding disabled — videos served as-is",
        },
      ],
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Failed to fetch system status", detail: err.message },
      { status: 500 }
    );
  }
}
