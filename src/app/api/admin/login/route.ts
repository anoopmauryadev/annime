import { NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/db';
import { generateAdminToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// ─── Rate Limiting ───────────────────────────────────────────────
// In-memory store for login attempt tracking (resets on server restart)
const loginAttempts = new Map<string, { count: number; firstAttempt: number; lockedUntil: number }>();

const MAX_ATTEMPTS = 10;         // Max failed attempts before lockout
const WINDOW_MS = 15 * 60 * 1000; // 15 minute window
const LOCKOUT_MS = 15 * 60 * 1000; // 15 minute lockout after max attempts

// Cleanup stale entries every 30 minutes to prevent memory leak
setInterval(() => {
  const now = Date.now();
  for (const [ip, data] of loginAttempts.entries()) {
    if (now - data.firstAttempt > WINDOW_MS && now > data.lockedUntil) {
      loginAttempts.delete(ip);
    }
  }
}, 30 * 60 * 1000);

function getClientIp(req: Request): string {
  return req.headers.get('x-client-ip')
    || req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('x-real-ip')
    || 'unknown';
}

export async function POST(req: Request) {
  const ip = getClientIp(req);
  const now = Date.now();

  // Check rate limit
  const attempt = loginAttempts.get(ip);
  if (attempt) {
    // Currently locked out?
    if (now < attempt.lockedUntil) {
      const remainingSec = Math.ceil((attempt.lockedUntil - now) / 1000);
      return NextResponse.json(
        { error: `Too many login attempts. Try again in ${remainingSec} seconds.` },
        { status: 429 }
      );
    }

    // Reset window if expired
    if (now - attempt.firstAttempt > WINDOW_MS) {
      loginAttempts.delete(ip);
    }
  }

  try {
    const { username, password } = await req.json();

    if (!username || !password) {
      return NextResponse.json({ error: 'Username and password are required' }, { status: 400 });
    }

    const user = verifyAdmin(username.trim(), password);
    if (user) {
      // Successful login — clear rate limit for this IP
      loginAttempts.delete(ip);
      const token = generateAdminToken(user);
      const response = NextResponse.json({ success: true, token, username: user.username });
      response.cookies.set('admin_token', token, {
        path: '/',
        httpOnly: false,
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60,
      });
      return response;
    }

    // Failed login — track attempt
    const current = loginAttempts.get(ip) || { count: 0, firstAttempt: now, lockedUntil: 0 };
    current.count += 1;

    if (current.count >= MAX_ATTEMPTS) {
      current.lockedUntil = now + LOCKOUT_MS;
      loginAttempts.set(ip, current);
      return NextResponse.json(
        { error: `Account locked for 15 minutes due to too many failed attempts.` },
        { status: 429 }
      );
    }

    loginAttempts.set(ip, current);
    const remaining = MAX_ATTEMPTS - current.count;
    return NextResponse.json(
      { error: `Invalid username or password. ${remaining} attempt(s) remaining.` },
      { status: 401 }
    );
  } catch (err: any) {
    return NextResponse.json({ error: 'Failed to process login' }, { status: 500 });
  }
}

