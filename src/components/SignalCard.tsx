'use client';
import { useState } from 'react';
import type { Signal } from '@/data/queries';
import { confidenceLabel, confidenceColor, polarityLabel, polarityColor } from '@/data/labels';

const LAYER_LABEL = '#8a8a98';

export default function SignalCard({ signal, index }: { signal: Signal; index: number }) {
  const [openSectors, setOpenSectors] = useState(false);
  const [openTickers, setOpenTickers] = useState(false);

  const toggle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none',
    fontSize: 12, letterSpacing: 1, color: LAYER_LABEL, background: 'none', border: 'none',
    padding: '8px 0', textAlign: 'left', width: '100%',
  };
  const caret = (open: boolean) => (
    <span style={{ display: 'inline-block', transition: 'transform .15s', transform: open ? 'rotate(90deg)' : 'none', color: '#c99' }}>▸</span>
  );

  return (
    <article
      style={{
        background: '#0f0f17', border: '1px solid #1b1b26', borderRadius: 12,
        padding: '18px 20px', marginBottom: 14,
      }}
    >
      {/* 标题层 + 置信度 + 来自雷达 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <h3 className="serif" style={{ fontSize: 17, fontWeight: 700, margin: 0, lineHeight: 1.4 }}>
          <span style={{ color: '#c99', marginRight: 8 }}>{index + 1}</span>{signal.title}
        </h3>
        <span
          style={{
            flexShrink: 0, fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 999,
            color: confidenceColor(signal.confidence), border: `1px solid ${confidenceColor(signal.confidence)}55`,
          }}
        >
          置信 {confidenceLabel(signal.confidence)}
        </span>
      </div>

      {/* 主题层（始终显示） */}
      <p style={{ color: '#cfcabf', fontSize: 14, lineHeight: 1.75, margin: '10px 0 4px' }}>{signal.theme}</p>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', margin: '6px 0 2px' }}>
        {signal.thread ? (
          <span style={{ fontSize: 11, color: '#a5b4fc', background: '#1b1b2e', padding: '3px 9px', borderRadius: 6 }}>
            主线 · {signal.thread}
          </span>
        ) : null}
        {signal.fromRadar ? (
          <span style={{ fontSize: 11, color: '#fbbf24', background: '#2a230f', padding: '3px 9px', borderRadius: 6 }}>
            ✦ 由今日雷达驱动
          </span>
        ) : null}
      </div>

      {/* 行业层（可展开） */}
      <button type="button" style={{ ...toggle, borderTop: '1px solid #1b1b26', marginTop: 10 }} onClick={() => setOpenSectors((v) => !v)}>
        {caret(openSectors)} 行业层 · {signal.sectors.length} 个板块
      </button>
      {openSectors ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: '2px 0 10px 18px' }}>
          {signal.sectors.length === 0 ? (
            <span style={{ fontSize: 13, color: '#6b6b78' }}>（无明确行业映射）</span>
          ) : (
            signal.sectors.map((s, i) => (
              <span key={i} style={{ fontSize: 13, color: '#ECE7DD' }}>
                {s.sector}
                <span style={{ color: polarityColor(s.polarity), marginLeft: 4 }}>· {polarityLabel(s.polarity)}</span>
              </span>
            ))
          )}
        </div>
      ) : null}

      {/* 标的层（可展开，隔离 + 标注） */}
      <button type="button" style={{ ...toggle, borderTop: '1px solid #1b1b26' }} onClick={() => setOpenTickers((v) => !v)}>
        {caret(openTickers)} 标的层 · 线索（非投资建议）
      </button>
      {openTickers ? (
        <div style={{ padding: '2px 0 6px 18px' }}>
          {signal.tickers.length === 0 ? (
            <span style={{ fontSize: 13, color: '#6b6b78' }}>（宁缺毋滥 · 本信号无示例标的）</span>
          ) : (
            <>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {signal.tickers.map((t, i) => (
                  <span key={i} style={{ fontSize: 13, color: '#ECE7DD', background: '#1b1b26', padding: '3px 9px', borderRadius: 6, fontFamily: 'monospace' }}>{t}</span>
                ))}
              </div>
              <p style={{ fontSize: 11, color: '#6b6b78', margin: '8px 0 0' }}>⚠ 仅为信号线索，非投资建议；最高不确定性层。</p>
            </>
          )}
        </div>
      ) : null}
    </article>
  );
}
