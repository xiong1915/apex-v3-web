// app/register/page.tsx
'use client';
import { AuthIntro } from '@/components/auth-intro';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { GlassCard, GlassButton } from '@/components/glass';
import { PasswordInput } from '@/components/password-input';
import { apiRegister } from '@/lib/auth/client';

function RegisterForm() {
  const searchParams = useSearchParams();
  const returnUrl = searchParams.get('returnUrl') || '/';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [autoConfirmed, setAutoConfirmed] = useState(false);
  const submitting = useRef(false);
  const [retryAt, setRetryAt] = useState(0), [remaining, setRemaining] = useState(0);

  useEffect(() => {
    try {
      const saved = Number(sessionStorage.getItem('apex:register-retry-until'));
      if (saved > Date.now() && saved < Date.now() + 3600000) setRetryAt(saved);
    } catch {}
  }, []);

  useEffect(() => {
    const update = () => {
      const left = Math.max(0, Math.ceil((retryAt - Date.now()) / 1000));
      setRemaining(left);
      return left;
    };
    if (update() === 0) return;
    const timer = setInterval(() => {
      if (update() === 0) clearInterval(timer);
    }, 1000);
    return () => clearInterval(timer);
  }, [retryAt]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting.current || retryAt > Date.now() || success) return;
    if (!email || !password || !confirmPassword) {
      setError('请完整填写所有必填信息');
      return;
    }

    if (password.length < 6) {
      setError('密码长度至少为 6 位字符');
      return;
    }

    if (password !== confirmPassword) {
      setError('两次输入的密码不一致');
      return;
    }

    submitting.current = true;
    setLoading(true);
    setError(null);

    const res = await apiRegister(email, password);
    submitting.current = false;
    setLoading(false);

    if (res.error) {
      setError(res.error.message);
      if (res.error.retryAfterSeconds) {
        const until = Date.now() + res.error.retryAfterSeconds * 1000;
        setRetryAt(until);
        try {
          sessionStorage.setItem('apex:register-retry-until', String(until));
        } catch {}
      }
      return;
    }

    setAutoConfirmed(Boolean((res.data as any)?.autoConfirmed));
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
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: '28px' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <span style={{ fontSize: '20px', fontWeight: 900, letterSpacing: '0.08em' }}>APEX</span>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent-red)' }}></span>
            </div>
            <h1 style={{ fontSize: '22px', fontWeight: 800, margin: '4px 0 8px', color: 'var(--text-primary)' }}>
              注册新账号
            </h1>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>
              加入 APEX V3，体验 2026 赛季尖端赛车数据与大模型智能
            </p>
          </div>

          {/* Success State */}
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
              <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px' }}>
                {autoConfirmed ? '注册成功！' : '验证邮件已发送'}
              </h3>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: '24px' }}>
                {autoConfirmed ? (
                  <>账号 <strong style={{ color: 'var(--text-primary)' }}>{email}</strong> 已创建并激活，现在即可直接登录体验 APEX V3。</>
                ) : (
                  <>我们已向 <strong style={{ color: 'var(--text-primary)' }}>{email}</strong> 发送了激活确认邮件。请点击邮件中的链接完成验证后即可登录。</>
                )}
              </p>
              <Link href={`/login${returnUrl !== '/' ? `?returnUrl=${encodeURIComponent(returnUrl)}` : ''}`}>
                <GlassButton variant="primary" style={{ width: '100%', padding: '12px 0' }}>
                  前往登录
                </GlassButton>
              </Link>
            </div>
          ) : (
            <>
              {/* Error Alert */}
              {error && (
                <div role="alert" id="registration-error" style={{
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
                  <label htmlFor="auth-password" style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 500 }}>
                    设置密码 (至少 6 位)
                  </label>
                  <PasswordInput
                    id="auth-password"
                    name="password"
                    autoComplete="new-password"
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="请设置密码（至少 6 位）"
                  />
                </div>

                <div>
                  <label htmlFor="auth-confirm" style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 500 }}>
                    确认密码
                  </label>
                  <PasswordInput
                    id="auth-confirm"
                    name="confirmPassword"
                    autoComplete="new-password"
                    required
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="请再次输入密码"
                  />
                </div>

                <GlassButton
                  type="submit"
                  variant="primary"
                  disabled={loading || remaining > 0}
                  style={{ width: '100%', marginTop: '8px', padding: '12px 0', fontSize: '14px', fontWeight: 700 }}
                >
                  {loading ? '正在提交注册…' : remaining > 0 ? `请等待 ${remaining} 秒再重试` : '立即注册'}
                </GlassButton>
              </form>

              {remaining > 0 && (
                <p role="status" style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 12 }}>
                  已暂停重复提交。倒计时结束不代表邮件额度已恢复，请勿频繁重试。
                </p>
              )}

              {/* Footer */}
              <div style={{ textAlign: 'center', marginTop: '24px' }}>
                <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>已有账号？</span>{' '}
                <Link href={`/login${returnUrl !== '/' ? `?returnUrl=${encodeURIComponent(returnUrl)}` : ''}`} style={{ fontSize: '13px', color: 'var(--accent-red)', fontWeight: 600, textDecoration: 'none' }}>
                  直接登录
                </Link>
              </div>
            </>
          )}
        </GlassCard>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '60vh' }}></div>}>
      <RegisterForm />
    </Suspense>
  );
}
