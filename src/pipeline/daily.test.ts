import { describe, it, expect, vi } from 'vitest';
import { runDailyPipeline } from './daily';

function deps(overrides = {}) {
  return { ingest: vi.fn(async () => {}), extract: vi.fn(async () => {}), analyze: vi.fn(async () => {}), log: vi.fn(async () => {}), ...overrides };
}

describe('runDailyPipeline', () => {
  it('runs ingest → extract → analyze in order and logs each ok', async () => {
    const d = deps();
    const r = await runDailyPipeline('2026-06-13', d);
    expect(d.ingest).toHaveBeenCalledWith('2026-06-13');
    expect(d.extract).toHaveBeenCalledWith('2026-06-13');
    expect(d.analyze).toHaveBeenCalledWith('2026-06-13');
    expect(r.results.map((x) => x.stage)).toEqual(['ingest', 'extract', 'analyze']);
    expect(r.results.every((x) => x.status === 'ok')).toBe(true);
    expect(d.log).toHaveBeenCalledTimes(3);
  });
  it('stops after a failing stage and logs the error (does not run later stages)', async () => {
    const d = deps({ extract: vi.fn(async () => { throw new Error('boom'); }) });
    const r = await runDailyPipeline('2026-06-13', d);
    expect(d.analyze).not.toHaveBeenCalled();
    expect(r.results.map((x) => `${x.stage}:${x.status}`)).toEqual(['ingest:ok', 'extract:error']);
    expect(r.results[1].error).toMatch(/boom/);
    expect(d.log).toHaveBeenCalledWith(expect.objectContaining({ day: '2026-06-13', stage: 'extract', status: 'error' }));
  });
});
