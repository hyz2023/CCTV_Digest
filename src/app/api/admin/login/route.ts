import { NextRequest, NextResponse } from 'next/server';
import { checkPassword, signSession, ADMIN_COOKIE } from '@/auth/session';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const secret = process.env.ADMIN_SECRET ?? '';
  const { password } = await req.json().catch(() => ({ password: '' }));
  if (!checkPassword(String(password ?? ''), secret)) {
    return NextResponse.json({ error: 'invalid' }, { status: 401 });
  }
  const token = await signSession(secret);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: true, path: '/', maxAge: 7 * 86400 });
  return res;
}
