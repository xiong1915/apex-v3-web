// app/forgot-password/page.tsx
'use client';
import { AuthIntro } from '@/components/auth-intro';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { GlassCard, GlassButton } from '@/components/glass';
import { apiForgotPassword } from '@/lib/auth/client';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryUntil, setRetryUntil] = useState<number>(0);
  const [now, setNow] = useState<number>(Date.now());
  const [recoveryUrl, setRecoveryUrl] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // 动态秒级倒计时时钟
  useEffect(() => {
    if (retryUntil <= Date.now()) return;
    const timer = setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (current >= retryUntil) {
        clearInterval(timer);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [retryUntil]);

  const remainingSeconds = Math.max(0, Math.ceil((retryUntil - now) / 1000));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || remainingSeconds > 0) {
      if (!email) setError('请输入注册邮箱');
      return;
    }

    setLoading(true);
    setError(null);

    const res = await apiForgotPassword(email);
    setLoading(false);

    if (res.error) {
      setError(res.error.message);
      if (res.error.retryAfterSeconds) {
        const until = Date.now() + res.error.retryAfterSeconds * 1000;
        setRetryUntil(until);
        setNow(Date.now());
      }
      return;
    }

    // 检查是否有容灾直通链接
    if (res.data && (res.data as any).recoveryUrl) {
      setRecoveryUrl((res.data as any).recoveryUrl);
    }

    setSuccess(true);
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
          <div style={{ textAlign: 'center', marginBottom: '28px' }}>
            <h1 style={{ fontSize: '22px', fontWeight: 800, margin: '0 0 8px', color: 'var(--text-primary)' }}>
              找回密码
            </h1>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>
              输入您的注册邮箱，我们将向您发送密码重置链接
            </p>
          </div>

          {success ? (
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <div style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                background: 'rgba(48, 209, 88, 0.15)',
                color: '#30d158',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px',
                fontSize: '28px'
              }}>
                ✓
              </div>
              
              {recoveryUrl ? (
                <>
                  <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px' }}>重置凭证已就绪</h3>
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: '24px' }}>
                    已为您即时生成专属安全重置凭据，点击下方按钮即可直接修改密码：
                  </p>
                  <a href={recoveryUrl} style={{ textDecoration: 'none', display: 'block', marginBottom: '16px' }}>
                    <GlassButton variant="primary" style={{ width: '100%', padding: '12px 0', fontSize: '14px', fontWeight: 700 }}>
                      立即重置密码 ↗
                    </GlassButton>
                  </a>
                </>
              ) : (
                <>
                  <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px' }}>重置邮件已发送</h3>
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: '24px' }}>
                    如果该邮箱已注册，您将收到一封包含密码重置链接的邮件。链接有效期为 1 小时。
                  </p>
                </>
              )}

              <Link href="/login" style={{ textDecoration: 'none' }}>
                <GlassButton variant="secondary" style={{ width: '100%', padding: '10px 0', fontSize: '13px' }}>
                  返回登录
                </GlassButton>
              </Link>
            </div>
          ) : (
            <>
              {remainingSeconds > 0 ? (
                <div style={{
                  background: '#e1060008',
                  border: '1px solid rgba(255, 45, 32, 0.3)',
                  borderRadius: '12px',
                  padding: '10px 14px',
                  color: 'var(--accent-red)',
                  fontSize: '13px',
                  marginBottom: '18px',
                  lineHeight: 1.5
                }}>
                  邮件发送请求过于频繁，请稍候 <strong>{remainingSeconds}</strong> 秒后再试。若已收到邮件请先查收。
                </div>
              ) : error ? (
                <div style={{
                  background: '#e1060008',
                  border: '1px solid rgba(255, 45, 32, 0.3)',
                  borderRadius: '12px',
                  padding: '10px 14px',
                  color: 'var(--accent-red)',
                  fontSize: '13px',
                  marginBottom: '18px',
                  lineHeight: 1.5
                }}>
                  {error}
                </div>
              ) : null}

              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label htmlFor="auth-email" style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 500 }}>
                    注册邮箱
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

                <GlassButton
                  type="submit"
                  variant="primary"
                  disabled={loading || remainingSeconds > 0}
                  style={{ width: '100%', marginTop: '8px', padding: '12px 0', fontSize: '14px', fontWeight: 700 }}
                >
                  {loading ? '正在处理...' : remainingSeconds > 0 ? `${remainingSeconds} 秒后可重发` : '发送重置邮件'}
                </GlassButton>
              </form>

              <div style={{ textAlign: 'center', marginTop: '24px' }}>
                <Link href="/login" style={{ fontSize: '13px', color: 'var(--text-muted)', textDecoration: 'none' }}>
                  ← 返回登录
                </Link>
              </div>
            </>
          )}
        </GlassCard>
      </div>
    </div>
  );
}
