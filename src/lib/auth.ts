import crypto from "crypto";

type TokenType = "user" | "admin";
const configuredSecret = () => {
  const value = process.env.ADMIN_SECRET_KEY?.trim();
  if (value && value.length >= 32) return value;
  if (process.env.NODE_ENV === "production") throw new Error("ADMIN_SECRET_KEY must be at least 32 characters");
  return `dev-only-${process.pid}-${process.cwd()}`;
};
const key = (type: TokenType) => crypto.createHmac("sha256", configuredSecret()).update(`anime-zone:${type}:v2`).digest();

export interface AdminPayload { type: "admin"; version: 2; username: string; id: number; sessionVersion: number; exp: number }
export interface UserPayload { type: "user"; version: 2; id: number; username: string; email: string; is_vip: number; exp: number }

function sign(payload: UserPayload | AdminPayload, type: TokenType) {
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto.createHmac("sha256", key(type)).update(data).digest("base64url");
  return `${data}.${signature}`;
}
function decode(token: string | null | undefined, type: TokenType): Record<string, unknown> | null {
  if (!token || token.length > 4096) return null;
  const parts = token.split("."); if (parts.length !== 2) return null;
  const expected = Buffer.from(crypto.createHmac("sha256", key(type)).update(parts[0]).digest("base64url"));
  const actual = Buffer.from(parts[1]);
  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) return null;
  try {
    const parsed: unknown = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null;
  } catch { return null; }
}
const cookie = (request: Request, name: string) => {
  const match = request.headers.get("cookie")?.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  if (!match) return ""; try { return decodeURIComponent(match[1]); } catch { return ""; }
};

export function generateUserToken(user: { id: number; username: string; email: string; is_vip?: number }) {
  return sign({ type: "user", version: 2, id: user.id, username: user.username, email: user.email,
    is_vip: user.is_vip || 0, exp: Date.now() + 30 * 86400000 }, "user");
}
export function verifyUserToken(token: string | null | undefined): UserPayload | null {
  const p = decode(token, "user");
  return p?.type === "user" && p.version === 2 && Number.isSafeInteger(p.id) && typeof p.username === "string" &&
    typeof p.email === "string" && typeof p.exp === "number" && p.exp > Date.now() ? p as unknown as UserPayload : null;
}
export function getUserFromRequest(request: Request) {
  const auth = request.headers.get("authorization");
  const header = auth?.startsWith("Bearer ") ? auth.slice(7) : request.headers.get("x-user-token");
  return verifyUserToken(header) || verifyUserToken(cookie(request, "user_token"));
}
export function generateAdminToken(user: { id: number; username: string; session_version?: number }) {
  return sign({ type: "admin", version: 2, id: user.id, username: user.username,
    sessionVersion: user.session_version || 1, exp: Date.now() + 7 * 86400000 }, "admin");
}
export function verifyAdminToken(token: string | null | undefined): AdminPayload | null {
  const p = decode(token, "admin");
  return p?.type === "admin" && p.version === 2 && Number.isSafeInteger(p.id) && Number.isSafeInteger(p.sessionVersion) &&
    typeof p.username === "string" && typeof p.exp === "number" && p.exp > Date.now() ? p as unknown as AdminPayload : null;
}
export function requireAdminAuth(request: Request): { authorized: boolean; error?: string; admin?: AdminPayload } {
  const auth = request.headers.get("authorization");
  const header = auth?.startsWith("Bearer ") ? auth.slice(7) : request.headers.get("x-admin-token");
  const admin = verifyAdminToken(header) || verifyAdminToken(cookie(request, "admin_token"));
  if (!admin) return { authorized: false, error: "Unauthorized: Invalid or expired admin session" };
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getDb } = require("@/lib/db") as typeof import("@/lib/db");
    const row = getDb().prepare("SELECT username, session_version FROM admin_users WHERE id=?").get(admin.id) as { username: string; session_version: number } | undefined;
    if (!row || row.username !== admin.username || row.session_version !== admin.sessionVersion) return { authorized: false, error: "Unauthorized: Admin session revoked" };
  } catch { return { authorized: false, error: "Unauthorized: Admin identity check failed" }; }
  return { authorized: true, admin };
}
export const userCookieOptions = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict" as const, path: "/", maxAge: 30 * 86400, priority: "high" as const };
export const adminCookieOptions = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict" as const, path: "/", maxAge: 7 * 86400, priority: "high" as const };
