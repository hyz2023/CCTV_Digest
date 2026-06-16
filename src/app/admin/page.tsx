import { getStageConfigs, recentRuns, PROVIDERS } from '@/data/adminConfig';
import AdminConfig from '@/components/AdminConfig';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const [configs, runs] = await Promise.all([getStageConfigs(), recentRuns()]);

  return (
    <>
      <AdminConfig stages={configs} providers={PROVIDERS as string[]} />
      <div
        style={{
          background: '#0f1117',
          padding: '0 1.5rem 2rem',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          color: '#e2e8f0',
        }}
      >
        <div
          style={{
            background: '#1a1d2e',
            border: '1px solid #2d3148',
            borderRadius: '10px',
            padding: '1.25rem 1.5rem',
          }}
        >
          <div
            style={{
              fontSize: '0.9rem',
              fontWeight: 600,
              color: '#94a3b8',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              marginBottom: '1.25rem',
            }}
          >
            最近运行记录
          </div>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '0.85rem',
            }}
          >
            <thead>
              <tr>
                {['日期', '阶段', '状态', '错误', '创建时间'].map((h) => (
                  <th
                    key={h}
                    style={{
                      textAlign: 'left',
                      padding: '0.5rem 0.75rem',
                      color: '#64748b',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      borderBottom: '1px solid #2d3148',
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {runs.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    style={{
                      padding: '1.5rem 0.75rem',
                      color: '#475569',
                      textAlign: 'center',
                    }}
                  >
                    暂无运行记录
                  </td>
                </tr>
              ) : (
                runs.map((r) => (
                  <tr key={r.id}>
                    <td
                      style={{
                        padding: '0.5rem 0.75rem',
                        borderBottom: '1px solid #1e2235',
                        color: '#94a3b8',
                        fontFamily: 'monospace',
                        fontSize: '0.8rem',
                      }}
                    >
                      {r.day ?? '—'}
                    </td>
                    <td
                      style={{
                        padding: '0.5rem 0.75rem',
                        borderBottom: '1px solid #1e2235',
                      }}
                    >
                      <span
                        style={{
                          background: '#2d3148',
                          color: '#a5b4fc',
                          padding: '0.15rem 0.5rem',
                          borderRadius: '4px',
                          fontSize: '0.78rem',
                          fontWeight: 600,
                          fontFamily: 'monospace',
                        }}
                      >
                        {r.stage}
                      </span>
                    </td>
                    <td
                      style={{
                        padding: '0.5rem 0.75rem',
                        borderBottom: '1px solid #1e2235',
                        color:
                          r.status === 'ok'
                            ? '#4ade80'
                            : r.status === 'error'
                            ? '#f87171'
                            : '#fbbf24',
                        fontWeight: 600,
                        fontSize: '0.8rem',
                      }}
                    >
                      {r.status}
                    </td>
                    <td
                      style={{
                        padding: '0.5rem 0.75rem',
                        borderBottom: '1px solid #1e2235',
                        color: '#f87171',
                        fontSize: '0.78rem',
                        fontFamily: 'monospace',
                        maxWidth: '320px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {r.error ?? '—'}
                    </td>
                    <td
                      style={{
                        padding: '0.5rem 0.75rem',
                        borderBottom: '1px solid #1e2235',
                        color: '#64748b',
                        fontSize: '0.78rem',
                        fontFamily: 'monospace',
                      }}
                    >
                      {r.createdAt.toISOString().slice(0, 19).replace('T', ' ')}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
