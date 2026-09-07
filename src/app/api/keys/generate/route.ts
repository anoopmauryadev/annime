import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import {
  createAccessKey,
  deleteAccessKey,
  getSiteSettings,
  isUserKeyActive,
} from "@/lib/db";
import crypto from "crypto";
import { rateLimit } from "@/lib/rateLimit";

export async function POST(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { error: "Please log in to generate an access key." },
        { status: 401 }
      );
    }
    const limited = rateLimit(request, "key-generate", 5, 60 * 60 * 1000, String(user.id));
    if (limited) return limited;

    // 1. Check if user is already VIP
    const currentAccess = isUserKeyActive(user.id);
    if (currentAccess.is_vip) {
      return NextResponse.json({
        status: "vip",
        is_vip: true,
        message: "You are a VIP member! No access keys needed to watch.",
      });
    }

    // 2. Check if key system is enabled
    const settings = getSiteSettings();
    if (settings.key_system_enabled === "0") {
      return NextResponse.json({
        status: "disabled",
        active: true,
        message: "Key verification system is currently turned off.",
      });
    }

    // 3. Check if user already has an active 48h pass
    const keyStatus = currentAccess;
    if (keyStatus.active) {
      return NextResponse.json({
        status: "already_active",
        active: true,
        remaining_hours: keyStatus.remaining_hours,
        expires_at: keyStatus.expires_at,
        message: `Your 48-Hour access pass is already active (${keyStatus.remaining_hours}h remaining)!`,
      });
    }

    // 4. Generate unique claim token and store pending key
    const claimToken = crypto.randomBytes(24).toString("hex");
    const durationHours = parseInt(settings.key_duration_hours || "48", 10) || 48;
    const ipAddress =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      null;

    const keyRecord = createAccessKey({
      claim_token: claimToken,
      user_id: user.id,
      duration_hours: durationHours,
      ip_address: ipAddress || undefined,
    });

    // 5. Construct destination verify URL
    let origin = (settings.site_public_url || "").trim();
    if (!origin) {
      origin =
        request.nextUrl.origin ||
        `${request.headers.get("x-forwarded-proto") || "http"}://${request.headers.get("host") || "127.0.0.1:3000"}`;
    }

    // Only convert "localhost" to "127.0.0.1" for local dev (shorteners reject "localhost")
    // In production with a real domain this is a no-op
    if (origin.includes("localhost")) {
      origin = origin.replace(/localhost/gi, "127.0.0.1");
    }

    const destinationUrl = `${origin}/verify-key?claim=${claimToken}`;

    const shortenerApiToken = (settings.shortener_api_token || "").trim();
    let shortenerApiUrl = (settings.shortener_api_url || "https://api.gplinks.com/api").trim();
    if (shortenerApiUrl.includes("gplinks.in/api")) {
      shortenerApiUrl = shortenerApiUrl.replace("gplinks.in/api", "api.gplinks.com/api");
    }

    // 6. If shortener API token is set, call provider to shorten destination URL
    if (shortenerApiToken) {
      try {
        const queryParams = new URLSearchParams({
          api: shortenerApiToken,
          url: destinationUrl,
          format: "json",
        });

        const targetApi = `${shortenerApiUrl}?${queryParams.toString()}`;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);

        const res = await fetch(targetApi, {
          method: "GET",
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (res.ok) {
          const data = await res.json();
          // Standard shortener responses (GPLinks, ShrinkMe, Droplink): { status: "success", shortenedUrl: "..." }
          if (data.shortenedUrl) {
            return NextResponse.json({
              success: true,
              redirect_url: data.shortenedUrl,
              provider: settings.shortener_provider || "gplinks",
            });
          }
          console.warn("[KeyGen] Shortener returned non-success payload:", data);
        } else {
          console.warn("[KeyGen] Shortener HTTP error:", res.status);
        }
      } catch (err: any) {
        console.error("[KeyGen] Shortener fetch error:", err?.message || err);
      }
    }

    if (process.env.NODE_ENV === "production") {
      deleteAccessKey(keyRecord.id);
      return NextResponse.json({ error: "Key verification provider is unavailable. Please try again later." }, { status: 503 });
    }

    // Local development only: no ad provider is required.
    return NextResponse.json({
      success: true,
      redirect_url: destinationUrl,
      test_mode: true,
    });
  } catch (error: any) {
    console.error("[KeyGen] Error generating key:", error);
    return NextResponse.json(
      { error: error?.message || "Internal server error generating key" },
      { status: 500 }
    );
  }
}
