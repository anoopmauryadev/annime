import { requireAdminAuth } from "@/lib/auth";
import { cloudSettings } from "@/lib/cloudMedia";
import { getDb } from "@/lib/db";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = requireAdminAuth(request);
  if (!auth.authorized) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = getDb();
  const count = (sql: string) => (db.prepare(sql).get() as { n: number }).n;
  return NextResponse.json({
    ...cloudSettings(),
    objects: {
      folders: count("SELECT COUNT(*) AS n FROM cloud_objects WHERE path LIKE '/uploads/hls/%/'"),
      videos: count("SELECT COUNT(*) AS n FROM cloud_objects WHERE path LIKE '/uploads/videos/%'"),
    },
    jobs: {
      awsActive: count("SELECT COUNT(*) AS n FROM transcode_jobs WHERE engine='mediaconvert' AND status IN ('pending','processing')"),
      awaitingSync: count("SELECT COUNT(*) AS n FROM transcode_jobs WHERE status='complete' AND COALESCE(engine,'vps')='vps' AND cloud_synced=0"),
    },
  });
}
