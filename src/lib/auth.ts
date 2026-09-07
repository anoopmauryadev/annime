import crypto from "crypto";

const SECRET_KEY = process.env.ADMIN_SECRET_KEY || "anime-world-secret-jwt-key-2026-secure-session";

export interface AdminPayload {
  username: string;
  id: number;
  exp: number;
}

export interface UserPayload {
  id: number;
  username: string;
  email: string;
  is_vip: number;
  exp: number;
}

// Generate secure signed user token valid for 30 days
export function generateUserToken(user: { id: number; username: string; email: string; is_vip?: number }): string {
  const payload: UserPayload = {
    id: user.id,
    username: user.username,
    email: user.email,
    is_vip: user.is_vip || 0,
    exp: Date.now() + 30 * 24 * 60 * 60 * 1000,
  };

  const dataStr = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto
    .createHmac("sha256", SECRET_KEY)
    .update(dataStr)
    .digest("base64url");

  return `${dataStr}.${signature}`;
}

// Verify user token from Authorization header, x-user-token or cookie
export function verifyUserToken(token: string | null | undefined): UserPayload | null {
  if (!token) return null;

  const parts = token.split(".");
  if (parts.length !== 2) return null;

  const [dataStr, signature] = parts;
  const expectedSig = crypto
    .createHmac("sha256", SECRET_KEY)
    .update(dataStr)
    .digest("base64url");

  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(dataStr, "base64url").toString("utf-8")) as UserPayload;
    if (payload.exp < Date.now()) return null; // Token expired
    return payload;
  } catch {
    return null;
  }
}

// Get user from Request
export function getUserFromRequest(request: Request): UserPayload | null {
  const authHeader = request.headers.get("authorization");
  let token = "";
  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.substring(7);
  }
  if (!token) {
    token = request.headers.get("x-user-token") || "";
  }
  if (!token) {
    const cookie = request.headers.get("cookie");
    if (cookie) {
      const match = cookie.match(/(?:^|;\s*)user_token=([^;]+)/);
      if (match) token = decodeURIComponent(match[1]);
    }
  }
  return verifyUserToken(token);
}

// Generate secure signed token valid for 7 days
export function generateAdminToken(user: { id: number; username: string }): string {
  const payload: AdminPayload = {
    id: user.id,
    username: user.username,
    exp: Date.now() + 7 * 24 * 60 * 60 * 1000,
  };

  const dataStr = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto
    .createHmac("sha256", SECRET_KEY)
    .update(dataStr)
    .digest("base64url");

  return `${dataStr}.${signature}`;
}

// Verify admin token from Authorization header or cookie
export function verifyAdminToken(token: string | null | undefined): AdminPayload | null {
  if (!token) return null;

  const parts = token.split(".");
  if (parts.length !== 2) return null;

  const [dataStr, signature] = parts;
  const expectedSig = crypto
    .createHmac("sha256", SECRET_KEY)
    .update(dataStr)
    .digest("base64url");

  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(dataStr, "base64url").toString("utf-8")) as AdminPayload;
    if (payload.exp < Date.now()) return null; // Token expired
    return payload;
  } catch {
    return null;
  }
}

// Request helper to authenticate admin requests
export function requireAdminAuth(request: Request): { authorized: boolean; error?: string; admin?: AdminPayload } {
  // 1. Check Authorization header
  const authHeader = request.headers.get("authorization");
  let token = "";
  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.substring(7);
  }

  // 2. Check adminToken header fallback
  if (!token) {
    token = request.headers.get("x-admin-token") || "";
  }

  const payload = verifyAdminToken(token);
  if (!payload) {
    return { authorized: false, error: "Unauthorized: Invalid or expired admin token" };
  }

  return { authorized: true, admin: payload };
}

