import { createUser, getUserByEmail, getUserByUsername } from "@/lib/db";
import { generateUserToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
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

    if (password.length < 6) {
      return Response.json(
        { error: "Password must be at least 6 characters long" },
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

    const response = Response.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        is_vip: 0,
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
      { error: err.message || "Failed to create account" },
      { status: 500 }
    );
  }
}
