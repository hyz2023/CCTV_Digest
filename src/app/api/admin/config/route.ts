import { NextRequest, NextResponse } from 'next/server';
import { verifySession, ADMIN_COOKIE } from '@/auth/session';
import { validateStageUpdate, upsertStageConfig } from '@/data/adminConfig';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const ok = await verifySession(req.cookies.get(ADMIN_COOKIE)?.value ?? '', process.env.ADMIN_SECRET ?? '');
  if (!ok) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const v = validateStageUpdate(body);
  if (!v.ok || !v.value) return NextResponse.json({ error: v.error ?? 'invalid' }, { status: 400 });
  await upsertStageConfig(v.value);
  return NextResponse.json({ ok: true });
}
