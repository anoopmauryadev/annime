import crypto from "crypto";

function signDirectoryUrl(url: string, securityKey: string, validitySeconds: number): string {
  const parsed = new URL(url);
  const lastSlash = parsed.pathname.lastIndexOf("/");
  const allowedPath = parsed.pathname.slice(0, lastSlash + 1);
  const expires = String(Math.floor(Date.now() / 1000) + validitySeconds);
  const signingData = `token_path=${allowedPath}`;
  const digest = crypto
    .createHmac("sha256", securityKey)
    .update(allowedPath)
    .update(expires)
    .update(signingData)
    .digest("base64url");
  const token = `HS256-${digest}`;
  return `${parsed.origin}/bcdn_token=${token}&token_path=${encodeURIComponent(allowedPath)}&expires=${expires}${parsed.pathname}`;
}

/** Resolve locally stored HLS URLs to the configured Bunny pull-zone host.
 * External/embed servers are left untouched.
 */
export function resolveStreamUrl(streamUrl: string): string {
  const enabled = process.env.BUNNY_CDN_ENABLED === "1";
  const host = process.env.BUNNY_CDN_HOST?.trim().replace(/\/$/, "");
  if (!enabled || !host || !streamUrl?.startsWith("/uploads/hls/")) return streamUrl;
  const url = `${host}${streamUrl}`;
  const tokenAuthEnabled = process.env.BUNNY_TOKEN_AUTH_ENABLED === "1";
  const securityKey = process.env.BUNNY_TOKEN_AUTH_KEY?.trim();
  if (!tokenAuthEnabled || !securityKey) return url;
  const configuredTtl = Number(process.env.BUNNY_TOKEN_TTL_SECONDS || 14400);
  const ttl = Number.isFinite(configuredTtl) ? Math.min(86400, Math.max(300, configuredTtl)) : 14400;
  return signDirectoryUrl(url, securityKey, ttl);
}

export function resolveStreamServers<T extends { stream_url: string }>(servers: T[]): T[] {
  return servers.map((server) => ({ ...server, stream_url: resolveStreamUrl(server.stream_url) }));
}
