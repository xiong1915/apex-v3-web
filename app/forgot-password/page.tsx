// app/forgot-password/page.tsx
'use client';
import { AuthIntro } from '@/components/auth-intro';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { GlassCard, GlassButton } from '@/components/glass';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [codeLoading, setCodeLoading] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [retryUntil, setRetryUntil] = useState<number>(0);
  const [now, setNow] = useState<number>(Date.now());

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

  // 获取 6 位验证码
  const handleSendCode = async () => {
    if (!email) {
      setError('请输入您的注册邮箱');
      return;
    }
    if (remainingSeconds > 0) return;

    setError(null);
    setInfo(null);
    setCodeLoading(true);

    try {
      const res = await fetch('/api/auth/send-reset-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await res.json();
      setCodeLoading(false);

      if (!res.ok) {
        setError(data.error || '验证码发送失败');
        if (data.retryAfterSeconds) {
          setRetryUntil(Date.now() + data.retryAfterSeconds * 1000);
          setNow(Date.now());
        }
        return;
      }

      setInfo(data.message || '验证码已发送，请查收');
      
      setRetryUntil(Date.now() + 60 * 1000);
      setNow(Date.now());
    } catch (e: any) {
      setCodeLoading(false);
      setError(e.message || '网络连接异常，请重试');
    }
  };

  // 提交重置密码
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError('请输入注册邮箱');
      return;
    }
    if (!code || code.length !== 6) {
      setError('请输入完整的 6 位数字验证码');
      return;
    }
    if (!password) {
      setError('请输入新密码');
      return;
    }
    if (password.length < 6) {
      setError('新密码长度至少为 6 位字符');
      return;
    }
    if (password !== confirmPassword) {
      setError('两次输入的新密码不一致');
      return;
    }

    setError(null);
    setSubmitLoading(true);

    try {
      const res = await fetch('/api/auth/reset-password-with-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code, password })
      });
      const data = await res.json();
      setSubmitLoading(false);

      if (!res.ok) {
        setError(data.error || '重置密码失败，请核对验证码');
        return;
      }

      setSuccess(true);
      setTimeout(() => {
        router.push('/login');
      }, 2000);
    } catch (e: any) {
      setSubmitLoading(false);
      setError(e.message || '网络连接异常，请稍后重试');
    }
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
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <h1 style={{ fontSize: '22px', fontWeight: 800, margin: '0 0 8px', color: 'var(--text-primary)' }}>
              找回与重置密码
            </h1>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>
              输入邮箱获取验证码，验证通过后即可设置新密码
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
                您的登录密码已成功更新，正在为您跳转至登录页面...
              </p>
              <Link href="/login" style={{ textDecoration: 'none' }}>
                <GlassButton variant="primary" style={{ width: '100%', padding: '12px 0', fontSize: '14px', fontWeight: 700 }}>
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
                  padding: '10px 14px',
                  color: 'var(--accent-red)',
                  fontSize: '13px',
                  marginBottom: '16px',
                  lineHeight: 1.5
                }}>
                  {error}
                </div>
              )}

              {info && (
                <div style={{
                  background: 'rgba(48, 209, 88, 0.08)',
                  border: '1px solid rgba(48, 209, 88, 0.3)',
                  borderRadius: '12px',
                  padding: '10px 14px',
                  color: '#30d158',
                  fontSize: '13px',
                  marginBottom: '16px',
                  lineHeight: 1.5
                }}>
                  {info}
                </div>
              )}

              

              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {/* 邮箱 */}
                <div>
                  <label htmlFor="auth-email" style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 500 }}>
                    注册邮箱
                  </label>
                  <input
                    type="email" id="auth-email" name="email" autoComplete="email"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    style={{
                      width: '100%',
                      padding: '11px 14px',
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

                {/* 验证码与获取按钮 */}
                <div>
                  <label htmlFor="auth-code" style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 500 }}>
                    6 位邮箱验证码
                  </label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="text" id="auth-code" name="emailVerificationCode" autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]*" maxLength={6}
                      required
                      value={code}
                      onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
                      placeholder="6 位数字"
                      style={{
                        flex: 1,
                        padding: '11px 14px',
                        background: 'var(--bg-primary)',
                        border: '1px solid var(--line-dark)',
                        borderRadius: '12px',
                        color: 'var(--text-primary)',
                        fontSize: '14px',
                        letterSpacing: '2px',
                        fontFamily: 'monospace',
                        outline: 'none',
                        boxSizing: 'border-box'
                      }}
                    />
                    <button
                      type="button"
                      disabled={codeLoading || remainingSeconds > 0}
                      onClick={handleSendCode}
                      style={{
                        width: '120px',
                        padding: '11px 0',
                        background: remainingSeconds > 0 ? 'var(--bg-muted)' : 'var(--accent-red)',
                        border: 'none',
                        borderRadius: '12px',
                        color: '#fff',
                        fontSize: '13px',
                        fontWeight: 600,
                        cursor: remainingSeconds > 0 || codeLoading ? 'not-allowed' : 'pointer',
                        opacity: remainingSeconds > 0 || codeLoading ? 0.7 : 1,
                        transition: 'all 0.2s'
                      }}
                    >
                      {codeLoading ? '发送中...' : (remainingSeconds > 0 ? `${remainingSeconds} 秒` : '获取验证码')}
                    </button>
                  </div>
                </div>

                {/* 新密码 */}
                <div>
                  <label htmlFor="auth-password" style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 500 }}>
                    新密码 (至少 6 位)
                  </label>
                  <input
                    type="password" id="auth-password" name="password" autoComplete="new-password"
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    style={{
                      width: '100%',
                      padding: '11px 14px',
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

                {/* 确认新密码 */}
                <div>
                  <label htmlFor="auth-confirm" style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px', fontWeight: 500 }}>
                    确认新密码
                  </label>
                  <input
                    type="password" id="auth-confirm" name="confirmPassword" autoComplete="new-password"
                    required
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    style={{
                      width: '100%',
                      padding: '11px 14px',
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
                  disabled={submitLoading}
                  style={{ width: '100%', marginTop: '6px', padding: '12px 0', fontSize: '14px', fontWeight: 700 }}
                >
                  {submitLoading ? '正在修改...' : '确认重置密码'}
                </GlassButton>
              </form>

              <div style={{ textAlign: 'center', marginTop: '20px' }}>
                <Link href="/login" style={{ color: 'var(--text-muted)', fontSize: '13px', textDecoration: 'none' }}>
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
