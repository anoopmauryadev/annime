import { getReports, resolveReport } from "@/lib/db";
import { requireAdminAuth } from "@/lib/auth";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = requireAdminAuth(request);
  if (!auth.authorized) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const reports = getReports();
  return NextResponse.json(reports);
}

export async function PATCH(request: Request) {
  const auth = requireAdminAuth(request);
  if (!auth.authorized) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const id = parseInt(searchParams.get("id") || "0");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  resolveReport(id);
  return NextResponse.json({ success: true });
}
