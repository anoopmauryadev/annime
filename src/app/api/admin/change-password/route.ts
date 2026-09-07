import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { requireAdminAuth } from "@/lib/auth";
import bcrypt from "bcryptjs";

// POST /api/admin/change-password
export async function POST(req: NextRequest) {
  const auth = requireAdminAuth(req);
  if (!auth.authorized || !auth.admin) {
    return NextResponse.json({ error: auth.error || "Unauthorized" }, { status: 401 });
  }

  try {
    const { currentPassword, newPassword } = await req.json();

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { error: "Current password and new password are required" },
        { status: 400 }
      );
    }

    if (newPassword.length < 12) {
      return NextResponse.json(
        { error: "New password must be at least 12 characters" },
        { status: 400 }
      );
    }

    const db = getDb();
    const user = db
      .prepare("SELECT * FROM admin_users WHERE username = ?")
      .get(auth.admin.username) as { id: number; password_hash: string } | undefined;

    if (!user) {
      return NextResponse.json({ error: "Admin user not found" }, { status: 404 });
    }

    const isValid = bcrypt.compareSync(currentPassword, user.password_hash);
    if (!isValid) {
      return NextResponse.json({ error: "Current password is incorrect" }, { status: 403 });
    }

    const newHash = bcrypt.hashSync(newPassword, 10);
    db.prepare("UPDATE admin_users SET password_hash = ?, session_version = session_version + 1 WHERE id = ?").run(newHash, user.id);

    const response = NextResponse.json({ success: true, message: "Password changed. Please sign in again." });
    response.cookies.set("admin_token", "", { httpOnly: true, sameSite: "strict", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 0 });
    return response;
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
