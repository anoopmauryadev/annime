import { NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/auth";

export async function GET(request: Request) {
  const auth = requireAdminAuth(request);
  return auth.authorized
    ? NextResponse.json({ authenticated: true, username: auth.admin?.username })
    : NextResponse.json({ authenticated: false }, { status: 401 });
}

export async function DELETE() {
  const response = NextResponse.json({ success: true });
  response.cookies.set("admin_token", "", { httpOnly: true, sameSite: "strict", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 0 });
  return response;
}
