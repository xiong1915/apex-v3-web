// app/register/page.tsx
'use client';

import React, { useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { GlassCard, GlassButton } from '@/components/glass';
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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

    setLoading(true);
    setError(null);

    const res = await apiRegister(email, password);
    setLoading(false);

    if (res.error) {
      setError(res.error.message);
      return;
    }

    setSuccess(true);
  };

  return (
    <div style={{
      minHeight: 'calc(100dvh - 140px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 16px'
    }}>
      <div style={{ maxWidth: '420px', width: '100%' }}>
        <GlassCard style={{ padding: '36px 28px', borderRadius: '24px' }}>
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: '28px' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <span style={{ fontSize: '20px', fontWeight: 900, letterSpacing: '0.08em' }}>TIKE</span>
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
              <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px' }}>验证邮件已发送</h3>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: '24px' }}>
                我们已向 <strong style={{ color: 'var(--text-primary)' }}>{email}</strong> 发送了激活确认邮件。请点击邮件中的链接完成验证后即可登录。
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
                <div style={{
                  background: 'rgba(255, 45, 32, 0.1)',
                  border: '1px solid rgba(255, 45, 32, 0.3)',
                  borderRadius: '12px',
                  padding: '10px 14px',
                  color: '#ff453a',
                  fontSize: '13px',
                  marginBottom: '18px'
                }}>
                  {error}
                </div>
              )}

              {/* Form */}
              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 500 }}>
                    电子邮箱
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      background: 'rgba(255, 255, 255, 0.04)',
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
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 500 }}>
                    设置密码 (至少 6 位)
                  </label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      background: 'rgba(255, 255, 255, 0.04)',
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
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 500 }}>
                    确认密码
                  </label>
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      background: 'rgba(255, 255, 255, 0.04)',
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
                  disabled={loading}
                  style={{ width: '100%', marginTop: '8px', padding: '12px 0', fontSize: '14px', fontWeight: 700 }}
                >
                  {loading ? '正在提交注册...' : '立即注册'}
                </GlassButton>
              </form>

              {/* Footer */}
              <div style={{ textAlign: 'center', marginTop: '24px' }}>
                <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>已有账号？</span>{' '}
                <Link href={`/login${returnUrl !== '/' ? `?returnUrl=${encodeURIComponent(returnUrl)}` : ''}`} style={{ fontSize: '13px', color: '#ff453a', fontWeight: 600, textDecoration: 'none' }}>
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
