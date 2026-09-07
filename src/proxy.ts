import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// ─── In-memory maintenance cache ──────────────────────────────────
// We cache maintenance status to avoid DB reads on every single request.
// The cache refreshes every 5 seconds so admin toggle takes effect quickly.
let maintenanceCache: { enabled: boolean; message: string; lastChecked: number } = {
  enabled: false,
  message: '',
  lastChecked: 0,
};
const CACHE_TTL_MS = 5000; // 5 seconds

async function checkMaintenanceMode(request: NextRequest): Promise<{ enabled: boolean; message: string }> {
  const now = Date.now();
  if (now - maintenanceCache.lastChecked < CACHE_TTL_MS) {
    return { enabled: maintenanceCache.enabled, message: maintenanceCache.message };
  }

  try {
    // Internal fetch to the maintenance status API
    const baseUrl = request.nextUrl.origin;
    const res = await fetch(`${baseUrl}/api/maintenance/status`, {
      headers: { 'Cache-Control': 'no-cache' },
    });
    if (res.ok) {
      const data = await res.json();
      maintenanceCache = {
        enabled: data.maintenance === true,
        message: data.message || '',
        lastChecked: now,
      };
    }
  } catch {
    // On error, use cached value (fail-open so site doesn't break)
  }

  return { enabled: maintenanceCache.enabled, message: maintenanceCache.message };
}

/**
 * Server-side proxy for:
 * 1. Maintenance mode — redirect user pages to /maintenance
 * 2. Admin page protection — redirect unauthenticated to /admin/login
 * 3. Rate limiting headers — pass client IP to login route
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ─── Maintenance Mode ──────────────────────────────────────────
  // Skip maintenance check for: admin pages, admin API, maintenance page itself,
  // public APIs, static assets, and internal Next.js routes
  const isExemptFromMaintenance =
    pathname.startsWith('/admin') ||
    pathname.startsWith('/api/admin') ||
    pathname.startsWith('/api/maintenance') ||
    pathname === '/maintenance' ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/') ||
    pathname.includes('.');

  if (!isExemptFromMaintenance) {
    const { enabled } = await checkMaintenanceMode(request);
    if (enabled) {
      // Redirect all user-facing pages to the maintenance page
      const maintenanceUrl = new URL('/maintenance', request.url);
      return NextResponse.redirect(maintenanceUrl);
    }
  }

  // If user is on /maintenance but maintenance is OFF, redirect to home
  if (pathname === '/maintenance') {
    const { enabled } = await checkMaintenanceMode(request);
    if (!enabled) {
      return NextResponse.redirect(new URL('/', request.url));
    }
  }

  // ─── Admin Page Protection ─────────────────────────────────────
  // Protect all /admin/* page routes EXCEPT /admin/login itself
  if (pathname.startsWith('/admin') && !pathname.startsWith('/admin/login')) {
    const adminToken = request.cookies.get('adminToken')?.value
      || request.headers.get('x-admin-token')
      || extractBearerToken(request.headers.get('authorization'));

    if (!adminToken) {
      const loginUrl = new URL('/admin/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  // ─── Admin API Rate Limiting Headers ───────────────────────────
  if (pathname === '/api/admin/login' && request.method === 'POST') {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip')
      || 'unknown';

    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-client-ip', ip);

    return NextResponse.next({
      request: { headers: requestHeaders },
    });
  }

  return NextResponse.next();
}

function extractBearerToken(authHeader: string | null): string | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  return authHeader.substring(7) || null;
}

export const config = {
  matcher: [
    // Match everything except static files and internal Next.js routes
    '/((?!_next/static|_next/image|favicon.ico|uploads/).*)',
  ],
};

