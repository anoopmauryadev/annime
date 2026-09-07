# Security retest — 8 September 2026

This review covers the local working tree after the earlier security fixes. The tests ran against disposable accounts, databases and media on a temporary loopback server. No live domain or VPS was attacked or changed. No production data was used as an attack fixture.

An independent attacker agent reviewed the current auth, key, VIP, public episode and proxy flows. It found and reported the cumulative key-revocation issue and the cross-site logout issue below; the primary agent implemented and retested the fixes.

The attacker independently retested the final code in a fresh disposable SQLite database: stacked 48+2+3 hour keys now leave 5 hours after oldest-key revocation, 51 after middle-key revocation and 50 after latest-key revocation; deletion, repeated revocation and partially consumed grants pass. Wrong-account manual redemption and claims fail, owner claims succeed. Foreign-origin logout returns 403 without clearing the cookie. Unsafe or malformed shortener URLs fail closed with the pending key deleted; HTTPS redirects are accepted. The review found no additional confirmed privilege bypass in the inspected auth, key, VIP, public API, watch SSR or media paths.

## Confirmed findings and fixes

1. **High — Encoded URLs bypassed protected static media.** Requests such as `/uploads/%76ideos/proof.mp4`, `/%75ploads/videos/proof.mp4`, `/uploads%2fvideos%2fproof.mp4` and encoded download paths returned **HTTP 200 with private fixture bytes without login** before the fix. The proxy now decodes and normalizes the same path the static server resolves, then rewrites to the authenticated media handler. Retests return **401**, including encoded dot segments and attempted middleware-subrequest bypass headers.

2. **High — Partial uploads were public.** `/uploads/temp/proof.tmp` and its encoded equivalent returned private fixture bytes with **200** before the fix. New chunks are staged under `data/upload-temp/<admin id>/`; old public temporary paths return **404** through Next and are blocked in the Nginx installer. Both directories are excluded from Git. Chunk IDs, index range and total accumulated video size are validated.

3. **High — Encoded separators could change the media permission check.** The media handler checked VIP status against the first route parameter, then allowed that parameter to contain a decoded slash during filesystem resolution. A key-only user could therefore target the downloads directory through a differently shaped parameter. The handler now restricts categories and rejects embedded slashes, backslashes, NULs and traversal segments. Production HTTP tests confirm rejection while legitimate key streaming and VIP downloads still work.

4. **Medium — Cookie mutations had no origin check.** SameSite cookies alone do not separate a sibling subdomain from the main site. User/admin authorization and login/register now reject cross-origin browser mutations, including `Sec-Fetch-Site: same-site` from another origin. A production HTTP test using a valid disposable admin cookie and a foreign Origin cannot update settings. Same-origin login works and returns a Secure, HttpOnly cookie without exposing a token in JSON.

5. **Medium — Media validation and cleanup had gaps.** FFprobe exit success did not prove a video stream existed. Upload validation now checks the selected video stream and restricts input containers and protocols; audio-only files and a disguised concat playlist are rejected. Registering an already uploaded video now requires a canonical file inside the video directory. Cleanup now enforces directory boundaries and rejects deleting the entire uploads directory, sibling-prefix paths and paths resolving outside uploads. A normal disposable media file is still deleted successfully.

6. **Abuse controls.** Manual key/VIP redemption lacked request throttles, and user-login limits could be spread across arbitrary account names on one IP. Added redemption limits, an aggregate login IP limit, input type/length checks and a comment-posting limit. Tests verify redemption requests reach **429** after the configured allowance.

7. **Medium — Revoking stacked keys preserved revoked time.** When several access keys were stacked, each later key stored a cumulative expiry. Revoking an earlier key previously kept that expiry in later rows, so the revoked hours remained usable. Database logic now subtracts the revoked key's unused interval from later stacked grants, preserves time already consumed, handles expired grants, and is idempotent. Bound keys are also enforced inside the database helper so manual redemption cannot move a key to another account.

8. **Low — Cross-site logout could be forced.** The logout endpoint cleared the session cookie without checking the request origin. It now applies the same mutation origin check as login and admin mutations; admin session deletion uses it too.

9. **Deployment safeguards.** The installer binds Next to loopback so remote clients cannot bypass Nginx or forge its trusted client-IP header. Ordinary requests are limited to 64 KB, with separate larger allowances for authorized upload endpoints. API routes skip Next's proxy body clone, avoiding truncation of uploads over its default 10 MB buffer. Environment-file permissions are restricted. Removing an old root-owned PM2 process also updates its saved process list.

10. **Database backup integrity.** The security migration now uses SQLite's online backup rather than copying only the database file, which can omit committed WAL transactions. A test keeps the source connection open, inserts a WAL fixture, runs migration, then verifies that the backup contains the fixture, passes SQLite integrity checking and has mode 0600.

## Verification

- `npm run build`: passed, including TypeScript and production route generation.
- `node scripts/test_security_fixes.mjs`: passed; isolated auth, media validation, cleanup, key ownership/revocation, throttling and WAL backup tests.
- `node scripts/test_vip_download.mjs`: passed; real FFmpeg intro composition, content order, duration, multiple audio tracks, seeking/ranges, intro disabled, missing files and membership revocation.
- `scripts/test_security_http.mjs`: passed against the production build. **94** admin requests with no credentials or a regular-user token were rejected. Encoded media paths, SSR URL protection, origin rejection, real login, immediate key/VIP grants and revocation passed.
- The same HTTP test passed a complete two-chunk video upload with private staging and an upload over 10 MB without truncation.
- With `PLAYWRIGHT_MODULE` configured, the same test passed in Chrome: login gate → key gate → VIP access → intro → actual protected episode playback.
- `npm audit --omit=dev --json`: **0 known vulnerabilities** in the audited production dependency tree.
- `bash -n setup.sh` and `git diff --check`: passed. Full Nginx/systemd/Certbot execution requires the target Linux VPS and was not performed here.
- Standard targeted ESLint still reports pre-existing explicit-`any` violations in touched legacy code. With that existing rule disabled for the check, it reports no errors and one existing unused-catch-variable warning. No lint-clean claim is made.

## Scope and remaining verification

These fixes are local; they require deployment before protecting the live site. The live VPS configuration, operating-system packages, firewall, TLS, CDN caches and production logs were not inspected. Real third-party player and shortener completion flows were not attacked. A clean dependency audit and these passing tests do not establish that every possible vulnerability is absent.

The independent attacker review was source-based plus isolated key/logout proofs, not a live VPS penetration test. An authorized viewer necessarily receives playback bytes; application VIP download restrictions cannot prevent recording or saving an authorized stream. External providers also control access to their own public media URLs.

The temporary test servers are stopped after each run. The original local development site remains stopped.
