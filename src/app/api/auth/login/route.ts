import { verifyUser } from "@/lib/db";
import { generateUserToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { emailOrUsername, password } = body;

    if (!emailOrUsername || !password) {
      return Response.json(
        { error: "Email/Username and password are required" },
        { status: 400 }
      );
    }

    const user = verifyUser(emailOrUsername, password);
    if (!user) {
      return Response.json(
        { error: "Invalid username/email or password" },
        { status: 401 }
      );
    }

    const token = generateUserToken(user);

    const response = Response.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        avatar: user.avatar,
        is_vip: user.is_vip || 0,
      },
      token,
    });

    response.headers.set(
      "Set-Cookie",
      `user_token=${encodeURIComponent(token)}; Path=/; Max-Age=2592000; SameSite=Lax`
    );

    return response;
  } catch (err: any) {
    return Response.json(
      { error: err.message || "Failed to login" },
      { status: 500 }
    );
  }
}
