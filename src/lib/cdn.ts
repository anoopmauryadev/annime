/** Resolve locally stored media URLs to the configured Bunny pull-zone host.
 * Only relative HLS URLs are rewritten; external/embed servers are untouched.
 */
export function resolveStreamUrl(streamUrl: string): string {
  const enabled = process.env.BUNNY_CDN_ENABLED === "1";
  const host = process.env.BUNNY_CDN_HOST?.trim().replace(/\/$/, "");
  if (!enabled || !host || !streamUrl?.startsWith("/uploads/hls/")) return streamUrl;
  return `${host}${streamUrl}`;
}

export function resolveStreamServers<T extends { stream_url: string }>(servers: T[]): T[] {
  return servers.map((server) => ({ ...server, stream_url: resolveStreamUrl(server.stream_url) }));
}
