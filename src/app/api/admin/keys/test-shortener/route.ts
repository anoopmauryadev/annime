import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/auth";
import { getSiteSettings } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const auth = requireAdminAuth(request);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const settings = getSiteSettings();

    let apiUrl = (body.api_url || settings.shortener_api_url || "https://api.gplinks.com/api").trim();
    if (apiUrl.includes("gplinks.in/api")) {
      apiUrl = apiUrl.replace("gplinks.in/api", "api.gplinks.com/api");
    }

    const apiToken = (body.api_token || settings.shortener_api_token || "").trim();
    if (!apiToken) {
      return NextResponse.json(
        { success: false, error: "Please provide or save an API token first." },
        { status: 400 }
      );
    }

    // GPLinks rejects literal "localhost", but accepts 127.0.0.1 or any public URL
    const testDestination = "http://127.0.0.1:3000/verify-key?claim=test_connection_ping";

    const queryParams = new URLSearchParams({
      api: apiToken,
      url: testDestination,
      format: "json",
    });

    const targetUrl = `${apiUrl}?${queryParams.toString()}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const res = await fetch(targetUrl, {
      method: "GET",
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      return NextResponse.json({
        success: false,
        error: `Provider returned HTTP ${res.status} ${res.statusText}`,
      });
    }

    const data = await res.json();

    if (data.status === "success" && data.shortenedUrl) {
      return NextResponse.json({
        success: true,
        shortenedUrl: data.shortenedUrl,
        message: "Connection successful! Link shortened properly.",
        raw: data,
      });
    }

    const errorMsg = Array.isArray(data.message)
      ? data.message.join(", ")
      : data.message || "Provider returned an unknown error or empty shortenedUrl.";

    return NextResponse.json({
      success: false,
      error: errorMsg,
      raw: data,
    });
  } catch (err: any) {
    console.error("[TestShortener] Error:", err);
    return NextResponse.json({
      success: false,
      error: err.name === "AbortError" ? "Connection timed out (10s)." : err.message || "Failed to reach provider.",
    });
  }
}
