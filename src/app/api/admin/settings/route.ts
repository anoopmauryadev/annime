import { getSiteSettings, setSiteSettings } from "@/lib/db";
import { requireAdminAuth } from "@/lib/auth";
import { NextResponse } from "next/server";
import * as aws from "../../../../../scripts/cloud/aws.cjs";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = requireAdminAuth(request);
  if (!auth.authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const settings = getSiteSettings();
  return NextResponse.json(settings);
}

export async function POST(request: Request) {
  const auth = requireAdminAuth(request);
  if (!auth.authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    if (typeof body !== "object" || !body || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid settings payload" }, { status: 400 });
    }

    for (const field of ['free_downloads_enabled','free_480p_enabled','vip_original_enabled','free_original_enabled','playback_login_required','processing_preview_enabled']) {
      if (field in body && !['0','1'].includes(body[field])) return NextResponse.json({error:`Invalid ${field}`},{status:400});
    }
    for (const field of ['cloud_sync_enabled','cloud_delete_local']) {
      if (field in body && !['0','1'].includes(body[field])) return NextResponse.json({error:`Invalid ${field}`},{status:400});
    }
    // AWS options can only be switched on once the server has the matching AWS settings.
    const cloud = aws.config();
    for (const [field, values, needs, label] of [
      ['upload_target', ['vps','s3'], cloud.storageReady, 'AWS_REGION and AWS_S3_BUCKET'],
      ['playback_source', ['vps','cloud'], cloud.storageReady, 'AWS_REGION and AWS_S3_BUCKET'],
      ['transcode_engine', ['vps','mediaconvert'], cloud.mediaConvertReady, 'MEDIACONVERT_ROLE_ARN'],
    ] as const) {
      if (!(field in body)) continue;
      if (!(values as readonly string[]).includes(body[field])) return NextResponse.json({error:`Invalid ${field}`},{status:400});
      if (body[field] !== 'vps' && !needs) return NextResponse.json({error:`Set ${label} in .env.local and restart first`},{status:400});
    }
    if (body.cloud_sync_enabled === '1' && !cloud.storageReady) return NextResponse.json({error:'Set AWS_REGION and AWS_S3_BUCKET in .env.local and restart first'},{status:400});
    if ('playback_guest_mode' in body && !['login','all','preview'].includes(body.playback_guest_mode)) return NextResponse.json({error:'Invalid guest mode'},{status:400});
    if ('playback_login_required' in body && !('playback_guest_mode' in body)) body.playback_guest_mode=body.playback_login_required === '0' ? 'all' : 'login';
    if ('playback_guest_mode' in body) body.playback_login_required=body.playback_guest_mode === 'all' ? '0' : '1';
    setSiteSettings(body);

    // Sync maintenance mode to data/maintenance.json for instant proxy pickup
    if ("maintenance_mode" in body || "maintenance_message" in body) {
      try {
        const fs = await import("fs");
        const path = await import("path");
        const filePath = path.join(process.cwd(), "data", "maintenance.json");
        const currentData = fs.existsSync(filePath)
          ? JSON.parse(fs.readFileSync(filePath, "utf-8"))
          : {};

        const updatedData = {
          enabled: "maintenance_mode" in body ? body.maintenance_mode === "1" : Boolean(currentData.enabled),
          message: "maintenance_message" in body ? body.maintenance_message : (currentData.message || "We're upgrading our servers. Please check back shortly!"),
          updatedAt: new Date().toISOString(),
        };

        fs.writeFileSync(filePath, JSON.stringify(updatedData, null, 2));
      } catch {
        // ignore filesystem sync error
      }
    }

    return NextResponse.json({ success: true, settings: getSiteSettings() });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to update settings" }, { status: 500 });
  }
}
