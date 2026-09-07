type Entry = { count: number; resetAt: number };
const store = new Map<string, Entry>();
const MAX_ENTRIES = 10000;

export function requestIdentity(request: Request): string {
  if (process.env.TRUST_PROXY === "1") return request.headers.get("x-real-ip")?.trim() || "unknown";
  return "direct-client";
}

export function rateLimit(request: Request, scope: string, limit: number, windowMs: number, account = ""): Response | null {
  const now = Date.now();
  const key = `${scope}:${requestIdentity(request)}:${account.trim().toLowerCase().slice(0, 160)}`;
  let entry = store.get(key);
  if (!entry || entry.resetAt <= now) entry = { count: 0, resetAt: now + windowMs };
  entry.count += 1;
  store.set(key, entry);
  if (store.size > MAX_ENTRIES) {
    for (const [candidate, value] of store) {
      if (value.resetAt <= now || store.size > MAX_ENTRIES) store.delete(candidate);
      if (store.size <= MAX_ENTRIES) break;
    }
  }
  if (entry.count <= limit) return null;
  return Response.json({ error: "Too many requests. Please try again later." }, {
    status: 429, headers: { "Retry-After": String(Math.ceil((entry.resetAt - now) / 1000)) },
  });
}
