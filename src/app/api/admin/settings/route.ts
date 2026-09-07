import { getSiteSettings, setSiteSettings } from "@/lib/db";
import { requireAdminAuth } from "@/lib/auth";
import { NextResponse } from "next/server";

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
    if (typeof body !== "object" || !body) {
      return NextResponse.json({ error: "Invalid settings payload" }, { status: 400 });
    }

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
