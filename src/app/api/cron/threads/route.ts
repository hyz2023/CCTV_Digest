import { NextRequest, NextResponse } from 'next/server';
import { isAuthorizedCron } from '@/lib/cron-auth';
import { synthesizeAllThreads } from '@/threads/run';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  if (!isAuthorizedCron({ authorization: req.headers.get('authorization') })) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const result = await synthesizeAllThreads();
  return NextResponse.json(result);
}
