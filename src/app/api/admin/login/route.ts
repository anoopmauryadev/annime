import { NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/db';
import { generateAdminToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { username, password } = await req.json();
    
    if (!username || !password) {
      return NextResponse.json({ error: 'Username and password are required' }, { status: 400 });
    }

    const user = verifyAdmin(username.trim(), password);
    if (user) {
      const token = generateAdminToken(user);
      return NextResponse.json({ success: true, token, username: user.username });
    }
    return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 });
  } catch (err: any) {
    return NextResponse.json({ error: 'Failed to process login' }, { status: 500 });
  }
}
