// app/reset-password/page.tsx
'use client';
import { AuthIntro } from '@/components/auth-intro';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { GlassCard, GlassButton } from '@/components/glass';
import { PasswordInput } from '@/components/password-input';
import { apiResetPassword } from '@/lib/auth/client';

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [token, setToken] = useState<string | undefined>(searchParams.get('token') || undefined);

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const queryToken = searchParams.get('token');
    if (queryToken) {
      setToken(queryToken);
      return;
    }

    // 智能解析 Supabase 邮件重定向携带的 Hash Fragment (#access_token=...&type=recovery)
    if (typeof window !== 'undefined' && window.location.hash) {
      try {
        const hash = window.location.hash.replace(/^#/, '');
        const params = new URLSearchParams(hash);
        const accessToken = params.get('access_token');
        if (accessToken) {
          setToken(accessToken);
          document.cookie = `apex_session_token=${accessToken}; path=/; max-age=3600; SameSite=Lax`;
        }
      } catch (_) {}
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || !confirmPassword) {
      setError('请输入新密码');
      return;
    }

    if (password.length < 6) {
      setError('新密码长度至少为 6 位字符');
      return;
    }

    if (password !== confirmPassword) {
      setError('两次输入的密码不一致');
      return;
    }

    setLoading(true);
    setError(null);

    const res = await apiResetPassword(password, token);
    setLoading(false);

    if (res.error) {
      setError(res.error.message);
      return;
    }

    setSuccess(true);
    setTimeout(() => {
      router.push('/login');
    }, 2000);
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
              重置登录密码
            </h1>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>
              请为您的账号设置一个安全的新密码
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
              <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px' }}>密码修改成功</h3>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: '24px' }}>
                密码已成功更新，正在为您跳转至登录页面...
              </p>
              <Link href="/login">
                <GlassButton variant="primary" style={{ width: '100%', padding: '12px 0' }}>
                  立即登录
                </GlassButton>
              </Link>
            </div>
          ) : (
            <>
              {error && (
                <div style={{
                  background: '#e1060008',
                  border: '1px solid rgba(255, 45, 32, 0.3)',
                  borderRadius: '12px',
                  padding: '12px 14px',
                  color: 'var(--accent-red)',
                  fontSize: '13px',
                  marginBottom: '18px',
                  lineHeight: 1.5
                }}>
                  {error.includes('Auth session missing') ? (
                    <div>
                      <div style={{ fontWeight: 700, marginBottom: '6px' }}>尚未检测到有效重置授权</div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '12px', marginBottom: '10px' }}>
                        由于邮件通道受限，无需苦等邮件！请前往找回密码页面输入您的注册邮箱，系统将为您即时建立重置凭证：
                      </div>
                      <Link href="/forgot-password" style={{ textDecoration: 'none' }}>
                        <GlassButton variant="primary" style={{ width: '100%', padding: '8px 0', fontSize: '13px', fontWeight: 700 }}>
                          前往找回密码一键获取授权 ↗
                        </GlassButton>
                      </Link>
                    </div>
                  ) : (
                    error
                  )}
                </div>
              )}

              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label htmlFor="auth-password" style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 500 }}>
                    新密码 (至少 6 位)
                  </label>
                  <PasswordInput
                    id="auth-password"
                    name="password"
                    autoComplete="new-password"
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="至少 6 位的新密码"
                  />
                </div>

                <div>
                  <label htmlFor="auth-confirm" style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 500 }}>
                    确认新密码
                  </label>
                  <PasswordInput
                    id="auth-confirm"
                    name="confirmPassword"
                    autoComplete="new-password"
                    required
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="请再次输入新密码"
                  />
                </div>

                <GlassButton
                  type="submit"
                  variant="primary"
                  disabled={loading}
                  style={{ width: '100%', marginTop: '8px', padding: '12px 0', fontSize: '14px', fontWeight: 700 }}
                >
                  {loading ? '正在保存...' : '确认修改密码'}
                </GlassButton>
              </form>
            </>
          )}
        </GlassCard>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '60vh' }}></div>}>
      <ResetPasswordForm />
    </Suspense>
  );
}
