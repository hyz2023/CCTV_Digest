// Discreet floating entry point to the gated admin area. Renders on every page
// via the root layout. /admin itself re-verifies the session and redirects to
// /admin/login when not authenticated, so exposing this link is safe.
export default function AdminFab() {
  return (
    <a
      href="/admin"
      title="系统管理"
      aria-label="系统管理"
      style={{
        position: 'fixed',
        left: 16,
        bottom: 16,
        zIndex: 50,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '8px 12px',
        borderRadius: 999,
        background: 'rgba(20,20,28,0.72)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        border: '1px solid #2a2a38',
        color: '#9a9aac',
        fontSize: 12,
        lineHeight: 1,
        textDecoration: 'none',
        opacity: 0.75,
      }}
    >
      <span style={{ fontSize: 14 }} aria-hidden>⚙</span>
      <span>系统管理</span>
    </a>
  );
}
