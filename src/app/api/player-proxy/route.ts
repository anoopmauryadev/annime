import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function isPrivateIpOrHost(hostname: string): boolean {
  const lower = hostname.toLowerCase().trim();
  
  if (
    lower === "localhost" ||
    lower === "127.0.0.1" ||
    lower === "0.0.0.0" ||
    lower === "::1" ||
    lower.endsWith(".local") ||
    lower.endsWith(".internal")
  ) {
    return true;
  }

  // IPv4 private ranges check
  const ipParts = lower.split(".").map(Number);
  if (ipParts.length === 4 && ipParts.every((p) => !isNaN(p) && p >= 0 && p <= 255)) {
    const [a, b] = ipParts;
    if (a === 10) return true; // 10.0.0.0/8
    if (a === 127) return true; // 127.0.0.0/8 loopback
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
    if (a === 192 && b === 168) return true; // 192.168.0.0/16
    if (a === 169 && b === 254) return true; // 169.254.0.0/16 (Link local / AWS metadata)
  }

  return false;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const targetUrl = searchParams.get("url");

  if (!targetUrl) {
    return new NextResponse("Missing url parameter", { status: 400 });
  }

  try {
    const parsed = new URL(targetUrl);

    // 1. Strict protocol check
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return new NextResponse("Invalid protocol: only HTTP/HTTPS permitted", { status: 400 });
    }

    // 2. SSRF Protection: Block private network access
    if (isPrivateIpOrHost(parsed.hostname)) {
      return new NextResponse("Forbidden: Access to private or internal network addresses is blocked", { status: 403 });
    }

    // 3. Fetch with timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(targetUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Referer": "https://watchanimeworld.one/",
        "Origin": "https://watchanimeworld.one",
      },
    });
    clearTimeout(timeout);

    let html = await res.text();

    const origin = parsed.origin;

    // 4. Inject base tag for relative player assets
    if (!html.includes("<base ")) {
      html = html.replace("<head>", `<head><base href="${origin}/">`);
    }

    // 5. Neutralize popup ad scripts and transparent overlays
    const antiAdScript = `
      <script>
        window.open = function() { console.warn("[AntiAd] Blocked popup"); return null; };
        window.devtoolsDetector = { addListener: function(){}, launch: function(){} };
        window.popactive = false;
        window.popurl = "";
        document.addEventListener("DOMContentLoaded", function() {
          const badEls = document.querySelectorAll(".pppx, .rek, [class*='pop'], [id*='pop']");
          badEls.forEach(el => el.remove());
        });
      </script>
      <style>
        .pppx, .rek, [class*="pop"], [id*="pop"] {
          display: none !important;
          pointer-events: none !important;
          visibility: hidden !important;
        }
      </style>
    `;

    html = html.replace("<head>", `<head>${antiAdScript}`);

    return new NextResponse(html, {
      status: res.status,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Security-Policy": "frame-ancestors *",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (err: any) {
    return new NextResponse(`Proxy error: ${err.message || "Failed to load"}` , { status: 502 });
  }
}
