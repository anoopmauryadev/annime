import { NextResponse } from "next/server";
import { isSameOriginMutation } from "@/lib/auth";

export async function POST(request: Request) {
  if (!isSameOriginMutation(request)) return NextResponse.json({ error: "Cross-origin requests are not allowed" }, { status: 403 });
  const response = NextResponse.json({ success: true });
  response.cookies.set("user_token", "", { httpOnly: true, sameSite: "strict", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 0 });
  return response;
}
