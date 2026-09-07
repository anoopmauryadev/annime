import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import fs from 'fs';
import path from 'path';
import { verifyAdminToken } from '@/lib/auth';

// ─── Maintenance Mode State ────────────────────────────────────────
// Reads from data/maintenance.json (or DB fallback) with 3s in-memory cache
let maintenanceCache = {
  enabled: false,
  lastChecked: 0,
};
const CACHE_TTL_MS = 3000; // 3 seconds

function isMaintenanceActive(): boolean {
  const now = Date.now();
  if (now - maintenanceCache.lastChecked < CACHE_TTL_MS) {
    return maintenanceCache.enabled;
  }

  // 1. Try reading data/maintenance.json (fastest, no DB locks)
  try {
    const filePath = path.join(process.cwd(), 'data', 'maintenance.json');
    if (fs.existsSync(filePath)) {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      maintenanceCache = {
        enabled: Boolean(data.enabled),
        lastChecked: now,
      };
      return maintenanceCache.enabled;
    }
  } catch {
    // ignore read error
  }

  // 2. Fallback to SQLite DB if JSON file doesn't exist
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getSiteSettings } = require('@/lib/db');
    const settings = getSiteSettings();
    maintenanceCache = {
      enabled: settings?.maintenance_mode === '1',
      lastChecked: now,
    };
  } catch {
    maintenanceCache.lastChecked = now;
  }

  return maintenanceCache.enabled;
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ─── 1. Never block Admin panel, APIs, static files, or internal Next.js assets ─
  if (
    pathname.startsWith('/admin') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/_next') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  const maintenanceOn = isMaintenanceActive();

  // ─── 2. If visitor is already on /maintenance ──────────────────────
  if (pathname === '/maintenance') {
    // If maintenance was turned OFF, send them back to home
    if (!maintenanceOn) {
      return NextResponse.redirect(new URL('/', request.url));
    }
    return NextResponse.next();
  }

  // ─── 3. If visitor has valid admin token cookie, bypass maintenance ─
  const adminCookie =
    request.cookies.get('admin_token')?.value ||
    request.cookies.get('adminToken')?.value;

  if (adminCookie) {
    const verified = verifyAdminToken(adminCookie);
    if (verified) {
      // Logged-in admin can browse the live site normally even during maintenance
      return NextResponse.next();
    }
  }

  // ─── 4. For regular users: redirect to /maintenance if enabled ─────
  if (maintenanceOn) {
    return NextResponse.redirect(new URL('/maintenance', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Apply proxy only to page routes; exclude API routes and static assets
    '/((?!api|_next/static|_next/image|favicon.ico|uploads/).*)',
  ],
};
