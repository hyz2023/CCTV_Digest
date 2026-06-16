import { NextRequest, NextResponse } from 'next/server';
import { verifySession, ADMIN_COOKIE } from '@/auth/session';

export const config = { matcher: ['/admin/:path*'] };

export async function proxy(req: NextRequest) {
  if (req.nextUrl.pathname === '/admin/login') return NextResponse.next();
  const token = req.cookies.get(ADMIN_COOKIE)?.value ?? '';
  const ok = await verifySession(token, process.env.ADMIN_SECRET ?? '');
  if (ok) return NextResponse.next();
  const url = req.nextUrl.clone();
  url.pathname = '/admin/login';
  return NextResponse.redirect(url);
}
