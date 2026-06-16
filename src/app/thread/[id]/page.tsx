import { getDb } from '@/db/client';
import { thread, threadPoint } from '@/db/schema';
import { eq, asc } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

async function load(id: number) {
  try {
    const t = (await getDb().select().from(thread).where(eq(thread.id, id)).limit(1))[0];
    if (!t) return null;
    const pts = await getDb().select().from(threadPoint).where(eq(threadPoint.threadId, id)).orderBy(asc(threadPoint.period));
    return { t, pts };
  } catch {
    return null;
  }
}

export default async function ThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await load(Number(id));
  const headerStyle = { display: 'flex', justifyContent: 'space-between', padding: '14px 28px', borderBottom: '1px solid #1b1b26' } as const;
  return (
    <main style={{ minHeight: '100vh', background: '#08080e', color: '#ECEAE3' }}>
      <header style={headerStyle}>
        <div style={{ fontWeight: 800 }}>联播 · 脉络</div>
        <nav style={{ display: 'flex', gap: 20, fontSize: 13 }}><a href="/" style={{ color: '#8a8a98' }}>脉络</a><a href="/explore" style={{ color: '#8a8a98' }}>探索</a></nav>
      </header>
      <section style={{ maxWidth: 900, margin: '0 auto', padding: '32px 28px' }}>
        {!data ? (
          <p style={{ color: '#8a8a98' }}>暂无数据（主线尚未合成，或数据库未连接）。</p>
        ) : (
          <>
            <div style={{ fontSize: 11, letterSpacing: 4, textTransform: 'uppercase', color: '#c99' }}>主线 · THREAD</div>
            <h1 className="serif" style={{ fontSize: 'clamp(28px,4vw,48px)', fontWeight: 800, margin: '8px 0', color: data.t.color ?? '#ECEAE3' }}>{data.t.name}</h1>
            <div style={{ fontSize: 13, color: '#8a8a98', marginBottom: 16 }}>状态：{data.t.status}</div>
            <p style={{ fontSize: 16, lineHeight: 1.7, color: '#dcd6ca' }}>{(data.t.meta as { read?: string } | null)?.read ?? ''}</p>
            <div style={{ marginTop: 18, fontSize: 13, color: '#8a8a98' }}>构成提法：{((data.t.meta as { memberTerms?: string[] } | null)?.memberTerms ?? []).join(' · ')}</div>
            <div style={{ marginTop: 24, fontSize: 11, letterSpacing: 2, color: '#8a8a98' }}>强度轨迹</div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 80, marginTop: 8 }}>
              {data.pts.map((p) => {
                const max = Math.max(1, ...data.pts.map((x) => x.intensity));
                return <div key={p.period} title={`${p.period}: ${p.intensity}`} style={{ flex: 1, height: `${(p.intensity / max) * 100}%`, background: data.t.color ?? '#e0436b', borderRadius: 2 }} />;
              })}
            </div>
          </>
        )}
      </section>
    </main>
  );
}
