import { createUser, getUserByEmail, getUserByUsername } from "@/lib/db";
import { generateUserToken, userCookieOptions } from "@/lib/auth";
import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const limited = rateLimit(request, "register", 5, 60 * 60 * 1000);
  if (limited) return limited;
  try {
    const body = await request.json();
    const { username, email, password } = body;

    if (!username || !email || !password) {
      return Response.json(
        { error: "Username, email and password are required" },
        { status: 400 }
      );
    }

    if (username.trim().length < 3) {
      return Response.json(
        { error: "Username must be at least 3 characters long" },
        { status: 400 }
      );
    }

    if (password.length < 10) {
      return Response.json(
        { error: "Password must be at least 10 characters long" },
        { status: 400 }
      );
    }

    const existingEmail = getUserByEmail(email);
    if (existingEmail) {
      return Response.json(
        { error: "An account with this email already exists" },
        { status: 409 }
      );
    }

    const existingUser = getUserByUsername(username);
    if (existingUser) {
      return Response.json(
        { error: "Username is already taken. Please choose another" },
        { status: 409 }
      );
    }

    const user = createUser({ username, email, password });
    const token = generateUserToken(user);

    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        is_vip: 0,
      },
    });

    response.cookies.set("user_token", token, userCookieOptions);

    return response;
  } catch (err: any) {
    return Response.json(
      { error: err.message || "Failed to create account" },
      { status: 500 }
    );
  }
}
