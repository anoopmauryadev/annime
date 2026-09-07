import { NextResponse } from "next/server";

// Old links fail closed: third-party HTML must never execute on this site's origin.
export async function GET() {
  return NextResponse.json({ error: "Player proxy disabled" }, { status: 410 });
}
