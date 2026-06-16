import { useCallback, useEffect, useRef, useState } from 'react';

const DWELL_MS = 400;
const EASE = 0.09;

export function useStreamFocus(enabled: boolean) {
  const [isolatedIdx, setIsolatedIdx] = useState(-1);
  const [progress, setProgress] = useState(0);
  const progressRef = useRef(0);
  const targetRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const dwellRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hoveredRef = useRef(-1);
  const reducedRef = useRef(false);

  useEffect(() => {
    reducedRef.current = typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); if (dwellRef.current) clearTimeout(dwellRef.current); };
  }, []);

  const tick = useCallback(() => {
    const t = targetRef.current;
    let p = progressRef.current;
    p = reducedRef.current ? t : p + (t - p) * EASE;
    if (Math.abs(t - p) < 0.0015) p = t;
    progressRef.current = p;
    setProgress(p);
    if (p !== t) { rafRef.current = requestAnimationFrame(tick); }
    else { rafRef.current = null; if (t === 0) setIsolatedIdx(-1); }
  }, []);

  const drive = useCallback((t: number) => {
    targetRef.current = t;
    if (rafRef.current == null) rafRef.current = requestAnimationFrame(tick);
  }, [tick]);

  const onHover = useCallback((streamIdx: number) => {
    if (!enabled) return;
    if (isolatedIdx >= 0 || progressRef.current > 0) return;
    if (streamIdx === hoveredRef.current) return;
    hoveredRef.current = streamIdx;
    if (dwellRef.current) clearTimeout(dwellRef.current);
    if (streamIdx < 0) return;
    dwellRef.current = setTimeout(() => { setIsolatedIdx(streamIdx); drive(1); }, DWELL_MS);
  }, [enabled, isolatedIdx, drive]);

  const onLeave = useCallback(() => {
    if (dwellRef.current) clearTimeout(dwellRef.current);
    hoveredRef.current = -1;
    drive(0);
  }, [drive]);

  return { isolatedIdx, progress, onHover, onLeave };
}
