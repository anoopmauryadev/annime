import { getSiteSettings } from "@/lib/db";
import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

// Public endpoint — proxy and client can check maintenance status
export async function GET() {
  // 1. Try file
  try {
    const filePath = path.join(process.cwd(), "data", "maintenance.json");
    if (fs.existsSync(filePath)) {
      const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
      return NextResponse.json({
        maintenance: Boolean(data.enabled),
        message: data.message || "We're upgrading our servers. Please check back shortly!",
      });
    }
  } catch {
    // fallback to DB
  }

  // 2. Fallback to DB
  try {
    const settings = getSiteSettings();
    const isMaintenanceMode = settings?.maintenance_mode === "1";
    const maintenanceMessage = settings?.maintenance_message || "We're upgrading our servers. Please check back shortly!";

    return NextResponse.json({
      maintenance: isMaintenanceMode,
      message: maintenanceMessage,
    });
  } catch {
    return NextResponse.json({
      maintenance: false,
      message: "We're upgrading our servers. Please check back shortly!",
    });
  }
}
