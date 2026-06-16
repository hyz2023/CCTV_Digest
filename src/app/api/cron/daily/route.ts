import { NextRequest, NextResponse } from 'next/server';
import { isAuthorizedCron } from '@/lib/cron-auth';
import { runDailyPipeline } from '@/pipeline/daily';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  if (!isAuthorizedCron({ authorization: req.headers.get('authorization') })) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const date = req.nextUrl.searchParams.get('date') ?? new Date().toISOString().slice(0, 10);
  const result = await runDailyPipeline(date);
  return NextResponse.json(result);
}
