import { saveUploadedFile } from "@/lib/upload";
import { NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    
    if (!file || file.size === 0) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    
    const path = await saveUploadedFile(file);
    return NextResponse.json({ path });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
