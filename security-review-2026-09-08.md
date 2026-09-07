Security review — Anime Zone — 8 September 2026

Scope: current local application, authentication and access controls, uploads/media, dependency lockfile and VPS setup script. Production code and the real database were not changed. The local web server remained stopped. The VPS configuration, logs and deployed database were not inspected; this review does not establish whether anyone has exploited these issues.

Priority: fix administrator access first, then public upload and player-proxy exposure, then enforce media and key authorization. The application currently has confirmed security issues despite the dependency audit being clean.

1. **Critical — A regular user token grants admin API access.**

   User and admin tokens share the signing secret. Admin verification checks the signature and expiry but never distinguishes a user token from an admin token or validates an admin identity. A normal registered user can therefore access administrative actions, including user/VIP management and content changes. An isolated test with a synthetic user token returned `authorized: true` from the actual admin authentication helper.

   Evidence: [auth.ts:119](/Users/anoopmaurya/Desktop/annime/src/lib/auth.ts:119), [auth.ts:150](/Users/anoopmaurya/Desktop/annime/src/lib/auth.ts:150).

   Fix: require explicit token type/audience, validate payload fields and admin identity, separate signing contexts, and invalidate existing admin sessions when correcting the boundary.

2. **High — The default admin password is still active locally.**

   Initialization creates an administrator with a fixed password in source code. A read-only password-hash comparison confirmed that the local administrator still uses this default. The password and stored hash are deliberately omitted here. The VPS password was not checked.

   Evidence: [db.ts:275](/Users/anoopmaurya/Desktop/annime/src/lib/db.ts:275).

   Fix: change the existing credential and require a unique initial password instead of automatically creating a known one.

3. **High — Player proxy executes third-party scripts with the website's origin.**

   The proxy returns arbitrary fetched HTML as the website's own HTML. Its CSP only controls embedding; it does not isolate scripts. A crafted proxy link opened by a logged-in user/admin can read locally stored tokens or perform authenticated requests. The player iframe is also unsandboxed. In a controlled Chrome test, the actual proxy response successfully read a dummy same-origin localStorage value. Upstream HTML and browser URLs were intercepted fixtures; no actual credentials were used.

   Evidence: [player-proxy/route.ts:101](/Users/anoopmaurya/Desktop/annime/src/app/api/player-proxy/route.ts:101), [VideoPlayer.tsx:659](/Users/anoopmaurya/Desktop/annime/src/components/VideoPlayer.tsx:659), [adminApi.ts:3](/Users/anoopmaurya/Desktop/annime/src/lib/adminApi.ts:3).

   Fix: remove same-origin HTML rehosting, or isolate untrusted players on a separate origin with an appropriate sandbox. A hostname allowlist alone does not isolate third-party scripts.

4. **High — Public upload endpoint accepts unauthenticated uploads.**

   `/api/upload` parses and saves files without checking login or admin authorization. The helper checks filename extensions, but not actual media content, size or storage quota. Repeated uploads can consume disk space and use the site as public file storage. An isolated test sent harmless nonmedia bytes with a video filename to the actual route without credentials: it returned 200 and saved the bytes. All file writes were confined to a disposable temporary directory.

   Evidence: [upload/route.ts:6](/Users/anoopmaurya/Desktop/annime/src/app/api/upload/route.ts:6), [upload.ts:21](/Users/anoopmaurya/Desktop/annime/src/lib/upload.ts:21), [upload.ts:38](/Users/anoopmaurya/Desktop/annime/src/lib/upload.ts:38).

   Fix: authenticate and authorize before parsing uploads; enforce request size, media validation, rate and storage limits.

5. **High — Direct media URLs bypass login, key and VIP gates.**

   The public episode API returns full stream/download URLs. The watch page also passes those URLs to client components. Original videos and HLS files live under public uploads, outside access checks; the supplied Nginx setup serves them directly. A visitor can request the raw URL instead of going through the gated player or VIP download route. The intro-download endpoint's checks do not protect these original files.

   Evidence: [episodes/[id]/route.ts:15](/Users/anoopmaurya/Desktop/annime/src/app/api/episodes/[id]/route.ts:15), [watch page:92](/Users/anoopmaurya/Desktop/annime/src/app/(public)/watch/[slug]/[episode]/page.tsx:92), [setup.sh:111](/Users/anoopmaurya/Desktop/annime/setup.sh:111).

   Fix: protect original media, playlists and segments with server-side authorization/private storage, and configure Nginx accordingly. Serve protected download links only after checking current membership. This finding is established by code/configuration tracing; the stopped site was not restarted to download real media.

6. **High — Player proxy can request internal network addresses (SSRF).**

   The URL filter checks hostname text only. Bracketed IPv6 loopback addresses pass; DNS resolution and redirect destinations are not validated. The endpoint needs no authentication. This can expose internal HTTP services reachable from the deployed server. Actual route tests confirmed IPv6 loopback URLs reached a stubbed fetch; no internal service was contacted.

   Evidence: [player-proxy/route.ts:49](/Users/anoopmaurya/Desktop/annime/src/app/api/player-proxy/route.ts:49), [player-proxy/route.ts:58](/Users/anoopmaurya/Desktop/annime/src/app/api/player-proxy/route.ts:58).

   Fix: remove unnecessary proxying, or strictly constrain destinations and validate resolved addresses and every redirect before connecting.

7. **High — Access keys can be activated without completing the shortener.**

   Even a successful shortener-generation response exposes the claim token. The claim endpoint immediately activates it without proving provider completion. Isolated tests using the actual routes and synthetic provider/database fixtures confirmed this sequence. A user can skip the intended key acquisition flow.

   Evidence: [keys/generate:115](/Users/anoopmaurya/Desktop/annime/src/app/api/keys/generate/route.ts:115), [keys/claim:42](/Users/anoopmaurya/Desktop/annime/src/app/api/keys/claim/route.ts:42).

   Fix: do not expose the completion credential before the intended return flow; require trustworthy server-verified provider completion where supported. A client timer or button check is insufficient.

8. **Medium — Admin login rate limits can be reset with a request header.**

   Login trusts client-supplied `x-client-ip`, and the supplied Nginx configuration does not overwrite that header. A controlled route test hit the lockout after ten failures, then changed this header and obtained another login attempt. Public user login also has no application rate limiter.

   Evidence: [admin/login:25](/Users/anoopmaurya/Desktop/annime/src/app/api/admin/login/route.ts:25), [setup.sh:143](/Users/anoopmaurya/Desktop/annime/setup.sh:143), [auth/login:6](/Users/anoopmaurya/Desktop/annime/src/app/api/auth/login/route.ts:6).

   Fix: use an address overwritten by a trusted proxy and add account-based limits; use shared state if multiple app processes run.

9. **Medium — Downloads listing ignores VIP expiry.**

   `/api/downloads` reads `is_vip` without checking `vip_expires_at`. Expiration is revoked lazily elsewhere, so direct API requests can avoid that update. A fixture with expired VIP and `is_vip=1` returned 200. This affects the listing/raw links; the newer intro-download route does perform an expiry-aware membership check.

   Evidence: [downloads/route.ts:18](/Users/anoopmaurya/Desktop/annime/src/app/api/downloads/route.ts:18).

   Fix: use the shared expiry-aware membership check on every VIP endpoint.

10. **Medium — Revoking a used key leaves the active pass working.**

    Revocation updates the key row, while access verification reads only the user's expiration timestamp. The UI promises immediate revocation, but a redeemed pass remains active until that timestamp expires. Confirmed by tracing the revocation and authorization functions.

    Evidence: [db.ts:1790](/Users/anoopmaurya/Desktop/annime/src/lib/db.ts:1790), [db.ts:1712](/Users/anoopmaurya/Desktop/annime/src/lib/db.ts:1712).

    Fix: make authorization honor revoked grants or update the affected entitlement transactionally while preserving any separate valid entitlement.

11. **Deployment risks — root process and HTTP-only initial setup.**

    The supplied installer runs Next/PM2 as root, increasing the impact of a web or media-processing compromise. It activates HTTP and leaves TLS as a manual follow-up. Login cookies also omit Secure. These are confirmed properties of the installer/code, not observations about the running VPS.

    Evidence: [setup.sh:87](/Users/anoopmaurya/Desktop/annime/setup.sh:87), [setup.sh:95](/Users/anoopmaurya/Desktop/annime/setup.sh:95), [setup.sh:189](/Users/anoopmaurya/Desktop/annime/setup.sh:189), [auth/login:42](/Users/anoopmaurya/Desktop/annime/src/app/api/auth/login/route.ts:42).

    Fix: run under a dedicated service user; enable HTTPS before accepting credentials and use secure cookie settings with a suitable session design.

Additional observations:

- Malformed token signatures can throw instead of returning unauthorized. The signer has a known fallback secret if configuration is absent; the local secret is configured and is not that fallback.
- Admin/user tokens are accessible to JavaScript through localStorage/non-HttpOnly cookies, increasing the impact of the confirmed proxy script issue.
- `npm audit --json --ignore-scripts` reported **0 known vulnerabilities across 448 dependencies**. This does not cover application logic defects.
- Targeted tracked-file/history checks found no tracked environment files, databases or private-key files. The secret scan was not exhaustive.
- No public path-traversal bypass was found in the new intro-download endpoint; it uses canonical path containment and current DB VIP checks. No shell injection was demonstrated in FFmpeg calls, which use argument arrays.

Only this report was added to the workspace. Security fixes have not been applied in this review.
