import { requireAdminAuth } from "@/lib/auth";
import { getDb, getSiteSettings } from "@/lib/db";
import { NextResponse } from "next/server";
import os from "os";
import fs from "fs";
import path from "path";

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
  if (bytes === 0) return "0 B";
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
      // Quick health check query
      db.prepare("SELECT 1").get();
      dbStatus = "online";

      // Find DB file size
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

    // ─── Storage / Uploads ───────────────────────────
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
          tableCounts[table] = -1; // table doesn't exist
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
        uploadsSize: formatBytes(uploadsSize),
        uploadFileCount,
        uploadsPath: uploadsDir,
      },

      features: {
        maintenanceMode,
        keySystemEnabled,
        shortenerProvider,
        hasShortenerKey,
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
          name: "Video Storage",
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
      ],
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Failed to fetch system status", detail: err.message },
      { status: 500 }
    );
  }
}
