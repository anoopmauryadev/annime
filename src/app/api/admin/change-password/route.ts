import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyAdminToken } from "@/lib/auth";
import bcrypt from "bcryptjs";

// POST /api/admin/change-password
export async function POST(req: NextRequest) {
  // Verify admin auth
  const authHeader = req.headers.get("authorization");
  let token = "";
  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.substring(7);
  }
  const admin = verifyAdminToken(token);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { currentPassword, newPassword } = await req.json();

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { error: "Current password and new password are required" },
        { status: 400 }
      );
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { error: "New password must be at least 6 characters" },
        { status: 400 }
      );
    }

    const db = getDb();
    const user = db
      .prepare("SELECT * FROM admin_users WHERE username = ?")
      .get(admin.username) as { id: number; password_hash: string } | undefined;

    if (!user) {
      return NextResponse.json({ error: "Admin user not found" }, { status: 404 });
    }

    const isValid = bcrypt.compareSync(currentPassword, user.password_hash);
    if (!isValid) {
      return NextResponse.json({ error: "Current password is incorrect" }, { status: 403 });
    }

    const newHash = bcrypt.hashSync(newPassword, 10);
    db.prepare("UPDATE admin_users SET password_hash = ? WHERE id = ?").run(newHash, user.id);

    return NextResponse.json({ success: true, message: "Password changed successfully" });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
