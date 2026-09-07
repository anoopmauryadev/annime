import { verifyUser } from "@/lib/db";
import { generateUserToken, userCookieOptions } from "@/lib/auth";
import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { emailOrUsername, password } = body;
    const limited = rateLimit(request, "user-login", 10, 15 * 60 * 1000, String(emailOrUsername || ""));
    if (limited) return limited;

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

    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        avatar: user.avatar,
        is_vip: user.is_vip || 0,
      },
    });

    response.cookies.set("user_token", token, userCookieOptions);

    return response;
  } catch (err: any) {
    return Response.json(
      { error: err.message || "Failed to login" },
      { status: 500 }
    );
  }
}
