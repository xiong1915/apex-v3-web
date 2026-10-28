// app/login/page.tsx
'use client';
import { AuthIntro } from '@/components/auth-intro';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { GlassCard, GlassButton } from '@/components/glass';
import { apiLogin } from '@/lib/auth/client';
import { safeReturnPath } from '@/lib/auth/redirect';
import { PasswordInput } from '@/components/password-input';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnUrl = searchParams.get('returnUrl') || searchParams.get('next') || '/';
  const verified = searchParams.get('verified');
  const urlError = searchParams.get('error');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(urlError);
  const [successMsg, setSuccessMsg] = useState<string | null>(
    verified ? '邮箱验证成功！您现在可以登录账号。' : null
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('请输入邮箱和密码');
      return;
    }

    setLoading(true);
    setError(null);

    const res = await apiLogin(email, password);
    setLoading(false);

    if (res.error) {
      const raw = res.error.message || '';
      const friendlyMsg = /invalid login credentials/i.test(raw)
        ? '邮箱或密码错误，请核对后重试'
        : (/email not confirmed/i.test(raw) ? '注册邮箱尚未完成验证，请先查收验证邮件' : raw);
      setError(friendlyMsg);
      return;
    }

    // 登录成功，安全跳转
    const safeUrl = safeReturnPath(returnUrl);
    router.push(safeUrl);
    router.refresh();
  };

  const handleOAuth = (provider: 'google' | 'github') => {
    const safeNext = encodeURIComponent(safeReturnPath(returnUrl));
    window.location.href = `/api/auth/oauth?provider=${provider}&next=${safeNext}`;
  };

  return (
    <div className="auth-shell" style={{
      minHeight: 'calc(100dvh - 140px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 16px'
    }}>
      <div className="auth-frame"><AuthIntro/>
        <GlassCard style={{ padding: '36px 28px', borderRadius: '24px' }}>
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: '28px' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <span style={{ fontSize: '20px', fontWeight: 900, letterSpacing: '0.08em' }}>APEX</span>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent-red)' }}></span>
            </div>
            <h1 style={{ fontSize: '22px', fontWeight: 800, margin: '4px 0 8px', color: 'var(--text-primary)' }}>
              用户登录
            </h1>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>
              登录后解锁 2026 赛季 AI 策略问答与高级数据分析
            </p>
          </div>

          {/* Alerts */}
          {error && (
            <div style={{
              background: '#e1060008',
              border: '1px solid rgba(255, 45, 32, 0.3)',
              borderRadius: '12px',
              padding: '10px 14px',
              color: 'var(--accent-red)',
              fontSize: '13px',
              marginBottom: '18px'
            }}>
              {error}
            </div>
          )}

          {successMsg && (
            <div style={{
              background: 'rgba(48, 209, 88, 0.1)',
              border: '1px solid rgba(48, 209, 88, 0.3)',
              borderRadius: '12px',
              padding: '10px 14px',
              color: '#30d158',
              fontSize: '13px',
              marginBottom: '18px'
            }}>
              {successMsg}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label htmlFor="auth-email" style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 500 }}>
                电子邮箱
              </label>
              <input
                type="email" id="auth-email" name="email" autoComplete="email" spellCheck={false} aria-label="电子邮箱"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="name@example.com"
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  background: 'var(--bg-primary)',
                  border: '1px solid var(--line-dark)',
                  borderRadius: '12px',
                  color: 'var(--text-primary)',
                  fontSize: '14px',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label htmlFor="auth-password" style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 500 }}>
                  登录密码
                </label>
                <Link href="/forgot-password" style={{ fontSize: '12px', color: 'var(--text-muted)', textDecoration: 'none' }}>
                  忘记密码？
                </Link>
              </div>
              <PasswordInput
                id="auth-password"
                name="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="请输入登录密码"
              />
            </div>

            <GlassButton
              type="submit"
              variant="primary"
              disabled={loading}
              style={{ width: '100%', marginTop: '8px', padding: '12px 0', fontSize: '14px', fontWeight: 700 }}
            >
              {loading ? '正在验证…' : '登录账号'}
            </GlassButton>
          </form>

          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', margin: '22px 0', gap: '12px' }}>
            <div style={{ flex: 1, height: '1px', background: 'var(--line-dark)' }}></div>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>第三方授权</span>
            <div style={{ flex: 1, height: '1px', background: 'var(--line-dark)' }}></div>
          </div>

          {/* OAuth Buttons */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <button
              type="button"
              onClick={() => handleOAuth('google')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: '10px 14px',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid var(--line-dark)',
                borderRadius: '12px',
                color: 'var(--text-primary)',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24">
                <path fill="#EA4335" d="M12 5c1.6 0 3 .6 4.1 1.6l3.1-3.1C17.3 1.8 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.4l3.7 2.9C6.5 7.4 9 5 12 5z"/>
                <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.7-.2-2.3H12v4.6h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.9z"/>
                <path fill="#FBBC05" d="M5.6 14.7c-.2-.7-.4-1.5-.4-2.7s.2-2 .4-2.7L1.9 6.4C.7 8.8 0 10.3 0 12s.7 3.2 1.9 5.6l3.7-2.9z"/>
                <path fill="#34A853" d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.4-6.4-5.3L1.9 16C3.7 19.8 7.5 23 12 23z"/>
              </svg>
              Google
            </button>

            <button
              type="button"
              onClick={() => handleOAuth('github')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: '10px 14px',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid var(--line-dark)',
                borderRadius: '12px',
                color: 'var(--text-primary)',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/>
              </svg>
              GitHub
            </button>
          </div>

          {/* Footer */}
          <div style={{ textAlign: 'center', marginTop: '24px' }}>
            <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>还没有账号？</span>{' '}
            <Link href={`/register${returnUrl !== '/' ? `?returnUrl=${encodeURIComponent(returnUrl)}` : ''}`} style={{ fontSize: '13px', color: 'var(--accent-red)', fontWeight: 600, textDecoration: 'none' }}>
              立即免费注册
            </Link>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '60vh' }}></div>}>
      <LoginForm />
    </Suspense>
  );
}
