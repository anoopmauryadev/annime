import { saveUploadedFile } from "@/lib/upload";
import { NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/auth";
import { rateLimit } from "@/lib/rateLimit";

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const auth = requireAdminAuth(request);
  if (!auth.authorized) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const limited = rateLimit(request, "general-upload", 30, 60 * 60 * 1000, String(auth.admin?.id || ""));
  if (limited) return limited;
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    
    if (!file || file.size === 0) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    if (file.size > 20 * 1024 * 1024) {
      return NextResponse.json({ error: "File is too large (20 MB maximum)" }, { status: 413 });
    }
    
    const path = await saveUploadedFile(file);
    return NextResponse.json({ path });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
