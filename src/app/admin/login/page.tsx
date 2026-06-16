'use client';

import { useState } from 'react';

export default function AdminLoginPage() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        window.location.href = '/admin';
      } else {
        setError('密码错误');
      }
    } catch {
      setError('密码错误');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0f1117',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <div
        style={{
          background: '#1a1d2e',
          border: '1px solid #2d3148',
          borderRadius: '12px',
          padding: '2.5rem 2rem',
          width: '100%',
          maxWidth: '360px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        }}
      >
        <h1
          style={{
            color: '#e2e8f0',
            fontSize: '1.1rem',
            fontWeight: 600,
            marginBottom: '1.75rem',
            textAlign: 'center',
            letterSpacing: '0.04em',
          }}
        >
          联播 · 脉络 · 系统管理
        </h1>
        <form onSubmit={handleSubmit}>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="请输入密码"
            autoFocus
            style={{
              display: 'block',
              width: '100%',
              padding: '0.65rem 0.85rem',
              background: '#0f1117',
              border: '1px solid #2d3148',
              borderRadius: '6px',
              color: '#e2e8f0',
              fontSize: '0.95rem',
              outline: 'none',
              boxSizing: 'border-box',
              marginBottom: '0.75rem',
            }}
          />
          {error && (
            <p
              style={{
                color: '#f87171',
                fontSize: '0.85rem',
                margin: '0 0 0.75rem',
              }}
            >
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={loading}
            style={{
              display: 'block',
              width: '100%',
              padding: '0.65rem',
              background: loading ? '#3b4268' : '#4f5ca8',
              color: '#e2e8f0',
              border: 'none',
              borderRadius: '6px',
              fontSize: '0.95rem',
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'background 0.15s',
            }}
          >
            {loading ? '验证中…' : '登录'}
          </button>
        </form>
      </div>
    </div>
  );
}
