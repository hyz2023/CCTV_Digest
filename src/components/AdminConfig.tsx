'use client';

import { useState } from 'react';
import type { StageConfigView } from '@/data/adminConfig';

interface Props {
  stages: StageConfigView[];
  providers: string[];
}

const S = {
  wrap: {
    background: '#0f1117',
    minHeight: '100vh',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    color: '#e2e8f0',
    padding: '1.5rem',
  } satisfies React.CSSProperties,
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '2rem',
  } satisfies React.CSSProperties,
  h1: {
    fontSize: '1.2rem',
    fontWeight: 700,
    color: '#e2e8f0',
    letterSpacing: '0.04em',
    margin: 0,
  } satisfies React.CSSProperties,
  logoutBtn: {
    background: '#2d3148',
    border: '1px solid #3b4268',
    color: '#94a3b8',
    padding: '0.4rem 0.9rem',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '0.85rem',
    fontWeight: 500,
  } satisfies React.CSSProperties,
  section: {
    background: '#1a1d2e',
    border: '1px solid #2d3148',
    borderRadius: '10px',
    padding: '1.25rem 1.5rem',
    marginBottom: '1.5rem',
  } satisfies React.CSSProperties,
  sectionTitle: {
    fontSize: '0.9rem',
    fontWeight: 600,
    color: '#94a3b8',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.08em',
    marginBottom: '1.25rem',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
    fontSize: '0.875rem',
  },
  th: {
    textAlign: 'left' as const,
    padding: '0.5rem 0.75rem',
    color: '#64748b',
    fontSize: '0.75rem',
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.06em',
    borderBottom: '1px solid #2d3148',
  },
  td: {
    padding: '0.6rem 0.75rem',
    borderBottom: '1px solid #1e2235',
    verticalAlign: 'middle' as const,
  },
  stagePill: {
    background: '#2d3148',
    color: '#a5b4fc',
    padding: '0.2rem 0.6rem',
    borderRadius: '4px',
    fontSize: '0.8rem',
    fontWeight: 600,
    fontFamily: 'monospace',
  } satisfies React.CSSProperties,
  select: {
    background: '#0f1117',
    border: '1px solid #2d3148',
    color: '#e2e8f0',
    padding: '0.35rem 0.5rem',
    borderRadius: '5px',
    fontSize: '0.85rem',
    outline: 'none',
    width: '100%',
  } satisfies React.CSSProperties,
  input: {
    background: '#0f1117',
    border: '1px solid #2d3148',
    color: '#e2e8f0',
    padding: '0.35rem 0.5rem',
    borderRadius: '5px',
    fontSize: '0.85rem',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box' as const,
  } satisfies React.CSSProperties,
  saveBtn: {
    background: '#4f5ca8',
    border: 'none',
    color: '#e2e8f0',
    padding: '0.35rem 0.85rem',
    borderRadius: '5px',
    cursor: 'pointer',
    fontSize: '0.85rem',
    fontWeight: 600,
    whiteSpace: 'nowrap' as const,
  } satisfies React.CSSProperties,
  saveBtnDisabled: {
    background: '#2d3148',
    border: 'none',
    color: '#64748b',
    padding: '0.35rem 0.85rem',
    borderRadius: '5px',
    cursor: 'not-allowed',
    fontSize: '0.85rem',
    fontWeight: 600,
    whiteSpace: 'nowrap' as const,
  } satisfies React.CSSProperties,
};

interface RowState {
  provider: string;
  model: string;
  baseUrl: string;
  apiKeyEnv: string;
  saving: boolean;
  result: 'idle' | 'ok' | 'err';
}

function StageRow({
  initial,
  providers,
}: {
  initial: StageConfigView;
  providers: string[];
}) {
  const [state, setState] = useState<RowState>({
    provider: initial.provider,
    model: initial.model,
    baseUrl: initial.baseUrl,
    apiKeyEnv: initial.apiKeyEnv,
    saving: false,
    result: 'idle',
  });

  function set<K extends keyof RowState>(key: K, val: RowState[K]) {
    setState((s) => ({ ...s, [key]: val, result: 'idle' }));
  }

  async function handleSave() {
    setState((s) => ({ ...s, saving: true, result: 'idle' }));
    try {
      const res = await fetch('/api/admin/config', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          stage: initial.stage,
          provider: state.provider,
          model: state.model,
          baseUrl: state.baseUrl || null,
          apiKeyEnv: state.apiKeyEnv,
        }),
      });
      setState((s) => ({ ...s, saving: false, result: res.ok ? 'ok' : 'err' }));
    } catch {
      setState((s) => ({ ...s, saving: false, result: 'err' }));
    }
  }

  const busy = state.saving;

  return (
    <tr>
      <td style={S.td}>
        <span style={S.stagePill}>{initial.stage}</span>
      </td>
      <td style={S.td}>
        <select
          value={state.provider}
          onChange={(e) => set('provider', e.target.value)}
          style={S.select}
        >
          {providers.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </td>
      <td style={S.td}>
        <input
          value={state.model}
          onChange={(e) => set('model', e.target.value)}
          style={S.input}
          placeholder="model id"
          spellCheck={false}
        />
      </td>
      <td style={S.td}>
        <input
          value={state.baseUrl}
          onChange={(e) => set('baseUrl', e.target.value)}
          style={S.input}
          placeholder="https://…"
          spellCheck={false}
        />
      </td>
      <td style={S.td}>
        <input
          value={state.apiKeyEnv}
          onChange={(e) => set('apiKeyEnv', e.target.value)}
          style={S.input}
          placeholder="ENV_VAR_NAME"
          spellCheck={false}
        />
      </td>
      <td style={{ ...S.td, textAlign: 'right' }}>
        <button
          onClick={handleSave}
          disabled={busy}
          style={busy ? S.saveBtnDisabled : S.saveBtn}
        >
          {busy ? '…' : state.result === 'ok' ? '✓' : state.result === 'err' ? '✗' : '保存'}
        </button>
      </td>
    </tr>
  );
}

export default function AdminConfig({ stages, providers }: Props) {
  async function handleLogout() {
    await fetch('/api/admin/logout', { method: 'POST' });
    window.location.href = '/admin/login';
  }

  return (
    <div style={S.wrap}>
      <div style={S.header}>
        <h1 style={S.h1}>联播 · 脉络 · 系统管理</h1>
        <button onClick={handleLogout} style={S.logoutBtn}>
          退出登录
        </button>
      </div>

      <div style={S.section}>
        <div style={S.sectionTitle}>模型配置</div>
        <table style={S.table}>
          <thead>
            <tr>
              <th style={S.th}>阶段</th>
              <th style={S.th}>供应商</th>
              <th style={S.th}>模型</th>
              <th style={S.th}>Base URL</th>
              <th style={S.th}>API Key 环境变量</th>
              <th style={S.th}></th>
            </tr>
          </thead>
          <tbody>
            {stages.map((s) => (
              <StageRow key={s.stage} initial={s} providers={providers} />
            ))}
          </tbody>
        </table>
        <p style={{ fontSize: '0.75rem', color: '#475569', marginTop: '0.75rem', marginBottom: 0 }}>
          注意：此处仅配置环境变量名称，API 密钥值由服务器环境变量管理，不在此界面输入或展示。
        </p>
      </div>
    </div>
  );
}
