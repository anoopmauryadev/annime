import { getAdminStats } from "@/lib/db";
import { NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

export async function GET() {
  const stats = getAdminStats();
  return NextResponse.json(stats);
}
