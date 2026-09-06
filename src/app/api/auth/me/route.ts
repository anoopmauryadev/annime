import { getUserFromRequest } from "@/lib/auth";
import { getUserById } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const payload = getUserFromRequest(request);
    if (!payload) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = getUserById(payload.id);
    if (!user) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }

    return Response.json({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        avatar: user.avatar,
        is_vip: user.is_vip || 0,
      },
    });
  } catch (err: any) {
    return Response.json(
      { error: err.message || "Failed to fetch user" },
      { status: 500 }
    );
  }
}
