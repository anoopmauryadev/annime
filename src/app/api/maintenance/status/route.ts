import { getSiteSettings } from "@/lib/db";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Public endpoint — proxy and client can check maintenance status
export async function GET() {
  const settings = getSiteSettings();
  const isMaintenanceMode = settings.maintenance_mode === "1";
  const maintenanceMessage = settings.maintenance_message || "We're upgrading our servers. Please check back shortly!";

  return NextResponse.json({
    maintenance: isMaintenanceMode,
    message: maintenanceMessage,
  });
}
