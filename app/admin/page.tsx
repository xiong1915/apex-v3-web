// app/admin/page.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { GlassCard, GlassButton } from '@/components/glass';
import { fetchCurrentSession, apiLogout } from '@/lib/auth/client';
import { formatBeijingDisplay } from '@/lib/f1/time';

type AdminTab = 'overview' | 'users' | 'ai' | 'f1';

export default function AdminPage() {
  const router = useRouter();

  const [checkingAuth, setCheckingAuth] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminUser, setAdminUser] = useState<any>(null);
  const [aalLevel, setAalLevel] = useState<'aal1' | 'aal2'>('aal1');

  // Tab State
  const [currentTab, setCurrentTab] = useState<AdminTab>('overview');

  // Data States (全部读取真实数据)
  const [overviewData, setOverviewData] = useState<any>(null);
  const [usersData, setUsersData] = useState<any>(null);
  const [aiData, setAiData] = useState<any>(null);
  const [f1Data, setF1Data] = useState<any>(null);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // TOTP Modal
  const [showTotpModal, setShowTotpModal] = useState(false);
  const [totpCode, setTotpCode] = useState('');
  const [totpSubmitting, setTotpSubmitting] = useState(false);
  const [totpError, setTotpError] = useState<string | null>(null);

  // F1 Manual Sync
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ success: boolean; message: string } | null>(null);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);

  // 1. 初始化鉴权
  useEffect(() => {
    let mounted = true;
    fetchCurrentSession().then(async ({ user, session }) => {
      if (!mounted) return;
      if (!user) {
        router.push('/login?returnUrl=/admin');
        return;
      }

      // 检查 /api/admin/mfa/status
      try {
        const res = await fetch('/api/admin/mfa/status', { cache: 'no-store' });
        if (res.status === 401) {
          router.push('/login?returnUrl=/admin');
          return;
        }
        if (res.status === 403) {
          setIsAdmin(false);
          setCheckingAuth(false);
          return;
        }

        const data = await res.json();
        setIsAdmin(true);
        setAdminUser(user);
        setAalLevel(data.aal || 'aal1');
        setCheckingAuth(false);
      } catch (_) {
        setIsAdmin(false);
        setCheckingAuth(false);
      }
    });

    return () => {
      mounted = false;
    };
  }, [router]);

  // 2. 加载数据
  const loadData = useCallback(async () => {
    if (!isAdmin) return;
    setLoading(true);
    setErrorMsg(null);

    try {
      const [ovRes, uRes, aiRes, f1Res] = await Promise.all([
        fetch('/api/admin/overview', { cache: 'no-store' }),
        fetch('/api/admin/users', { cache: 'no-store' }),
        fetch('/api/admin/ai', { cache: 'no-store' }),
        fetch('/api/admin/f1', { cache: 'no-store' })
      ]);

      if (ovRes.ok) setOverviewData(await ovRes.json());
      if (uRes.ok) setUsersData(await uRes.json());
      if (aiRes.ok) setAiData(await aiRes.json());
      if (f1Res.ok) setF1Data(await f1Res.json());
    } catch (e: any) {
      setErrorMsg(e.message || '加载后台数据失败');
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    if (isAdmin) {
      loadData();
    }
  }, [isAdmin, loadData]);

  // 3. 提交 TOTP 双重验证
  const handleVerifyTotp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!totpCode || totpCode.length !== 6) {
      setTotpError('请输入 6 位动态验证码');
      return;
    }

    setTotpSubmitting(true);
    setTotpError(null);

    try {
      const res = await fetch('/api/admin/mfa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: totpCode })
      });
      const data = await res.json();
      if (!res.ok) {
        setTotpError(data.error || '验证失败');
        return;
      }

      setAalLevel('aal2');
      setShowTotpModal(false);
      setTotpCode('');
    } catch (err: any) {
      setTotpError(err.message || '网络连接异常');
    } finally {
      setTotpSubmitting(false);
    }
  };

  // 4. 手动同步 F1 数据
  const handleTriggerF1Sync = async () => {
    if (aalLevel !== 'aal2') {
      setShowTotpModal(true);
      return;
    }

    setSyncing(true);
    setSyncResult(null);

    try {
      const res = await fetch('/api/admin/f1', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        setSyncResult({ success: false, message: data.error || data.message || '同步请求被拒绝' });
        if (data.cooldownRemaining) {
          setCooldownSeconds(data.cooldownRemaining);
        }
      } else {
        setSyncResult({ success: true, message: data.message || '同步执行成功' });
        // 重新拉取概览
        loadData();
      }
    } catch (err: any) {
      setSyncResult({ success: false, message: err.message || '请求失败' });
    } finally {
      setSyncing(false);
    }
  };

  // 倒计时计时器
  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const t = setInterval(() => {
      setCooldownSeconds(prev => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(t);
  }, [cooldownSeconds]);

  if (checkingAuth) {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: 'var(--text-muted)', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent-red)' }}></span>
          正在校验 APEX Control 管理员权限...
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
        <GlassCard style={{ padding: '36px', maxWidth: '420px', textAlign: 'center', borderRadius: '20px' }}>
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>🔒</div>
          <h2 style={{ fontSize: '20px', fontWeight: 800, marginBottom: '8px' }}>访问被拒绝 (403 Forbidden)</h2>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: '24px' }}>
            APEX Control 为单人私人网站管理中枢，当前登录账号无权访问此页面。
          </p>
          <Link href="/">
            <GlassButton variant="primary" style={{ width: '100%' }}>返回首页</GlassButton>
          </Link>
        </GlassCard>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100dvh',
      display: 'flex',
      flexDirection: 'column',
      paddingBottom: 'calc(80px + env(safe-area-inset-bottom, 16px))'
    }}>
      {/* 顶部标题栏 */}
      <header style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        background: 'rgba(10, 10, 11, 0.95)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid var(--line-dark)',
        padding: '14px 20px'
      }}>
        <div className="container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontWeight: 900, fontSize: '18px', letterSpacing: '0.08em', color: '#ff453a' }}>
              APEX CONTROL
            </span>
            <span style={{
              fontSize: '10px',
              fontWeight: 700,
              padding: '2px 8px',
              borderRadius: 'var(--radius-pill)',
              background: aalLevel === 'aal2' ? 'rgba(48, 209, 88, 0.15)' : 'rgba(255, 159, 10, 0.15)',
              color: aalLevel === 'aal2' ? '#30d158' : '#ff9f0a',
              border: `1px solid ${aalLevel === 'aal2' ? 'rgba(48, 209, 88, 0.4)' : 'rgba(255, 159, 10, 0.4)'}`
            }}>
              {aalLevel === 'aal2' ? '● AAL2 已授权' : '▲ AAL1 (需 TOTP)'}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {aalLevel !== 'aal2' && (
              <GlassButton variant="danger" size="sm" onClick={() => setShowTotpModal(true)}>
                TOTP 验证
              </GlassButton>
            )}
            <Link href="/" style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              回前台 ↗
            </Link>
          </div>
        </div>
      </header>

      {/* 主体工作区 */}
      <main className="container" style={{ flex: 1, padding: '24px 20px', maxWidth: '1000px' }}>
        {/* PC 标签导航 */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }} className="desktop-nav">
          <button
            onClick={() => setCurrentTab('overview')}
            style={{
              padding: '8px 18px',
              borderRadius: 'var(--radius-pill)',
              border: currentTab === 'overview' ? '1px solid #ff453a' : '1px solid var(--line-dark)',
              background: currentTab === 'overview' ? 'rgba(255, 45, 32, 0.15)' : 'rgba(255,255,255,0.04)',
              color: currentTab === 'overview' ? '#ff453a' : 'var(--text-secondary)',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            网站概览
          </button>
          <button
            onClick={() => setCurrentTab('users')}
            style={{
              padding: '8px 18px',
              borderRadius: 'var(--radius-pill)',
              border: currentTab === 'users' ? '1px solid #ff453a' : '1px solid var(--line-dark)',
              background: currentTab === 'users' ? 'rgba(255, 45, 32, 0.15)' : 'rgba(255,255,255,0.04)',
              color: currentTab === 'users' ? '#ff453a' : 'var(--text-secondary)',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            用户管理 ({usersData?.total ?? '--'})
          </button>
          <button
            onClick={() => setCurrentTab('ai')}
            style={{
              padding: '8px 18px',
              borderRadius: 'var(--radius-pill)',
              border: currentTab === 'ai' ? '1px solid #ff453a' : '1px solid var(--line-dark)',
              background: currentTab === 'ai' ? 'rgba(255, 45, 32, 0.15)' : 'rgba(255,255,255,0.04)',
              color: currentTab === 'ai' ? '#ff453a' : 'var(--text-secondary)',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            AI 监控与用量
          </button>
          <button
            onClick={() => setCurrentTab('f1')}
            style={{
              padding: '8px 18px',
              borderRadius: 'var(--radius-pill)',
              border: currentTab === 'f1' ? '1px solid #ff453a' : '1px solid var(--line-dark)',
              background: currentTab === 'f1' ? 'rgba(255, 45, 32, 0.15)' : 'rgba(255,255,255,0.04)',
              color: currentTab === 'f1' ? '#ff453a' : 'var(--text-secondary)',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            F1 数据调度
          </button>
        </div>

        {/* Tab 1: 网站概览 */}
        {currentTab === 'overview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
              <GlassCard style={{ padding: '20px', borderRadius: '16px' }}>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px' }}>系统健康状态</div>
                <div style={{ fontSize: '20px', fontWeight: 800, color: '#30d158' }}>
                  ● {overviewData?.health?.status === 'healthy' ? '服务全部正常' : '降级运行中'}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '6px' }}>
                  存储引擎：{overviewData?.health?.storageProvider || '已连接'}
                </div>
              </GlassCard>

              <GlassCard style={{ padding: '20px', borderRadius: '16px' }}>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px' }}>当前生产版本 (Git SHA)</div>
                <div className="tabular-nums" style={{ fontSize: '18px', fontWeight: 800, fontFamily: 'var(--font-mono)' }}>
                  {overviewData?.deployment?.buildId || '暂无数据'}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '6px' }}>
                  部署环境：{overviewData?.deployment?.environment} ({overviewData?.deployment?.vercelEnv})
                </div>
              </GlassCard>

              <GlassCard style={{ padding: '20px', borderRadius: '16px' }}>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px' }}>F1 数据同步时间</div>
                <div className="tabular-nums" style={{ fontSize: '16px', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                  {overviewData?.f1?.lastSyncTime ? formatBeijingDisplay(overviewData.f1.lastSyncTime) : '暂无数据'}
                </div>
                <div style={{ fontSize: '11px', color: overviewData?.f1?.upstreamSyncSuccess === false ? '#ff453a' : '#30d158', marginTop: '6px' }}>
                  {overviewData?.f1?.upstreamSyncSuccess === false ? '最近同步重试已降级' : '✓ 上游数据对齐正常'}
                </div>
              </GlassCard>
            </div>

            {overviewData?.f1?.errorMessage && (
              <div style={{ padding: '12px 16px', background: 'rgba(255, 45, 32, 0.1)', border: '1px solid rgba(255, 45, 32, 0.3)', borderRadius: '12px', color: '#ff453a', fontSize: '12px' }}>
                <strong>数据告警：</strong> {overviewData.f1.errorMessage}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: 用户管理 */}
        {currentTab === 'users' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '14px', fontWeight: 700 }}>
                真实注册用户 (共 {usersData?.total || 0} 位)
              </div>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                私人后台 · 权限固定单人管理
              </span>
            </div>

            <GlassCard style={{ padding: '16px', borderRadius: '16px', overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--line-dark)', color: 'var(--text-muted)', textAlign: 'left' }}>
                    <th style={{ padding: '10px 12px' }}>用户邮箱</th>
                    <th style={{ padding: '10px 12px' }}>角色</th>
                    <th style={{ padding: '10px 12px' }}>邮箱验证</th>
                    <th style={{ padding: '10px 12px' }}>登录来源</th>
                    <th style={{ padding: '10px 12px' }}>注册时间</th>
                  </tr>
                </thead>
                <tbody>
                  {(usersData?.users || []).map((u: any) => (
                    <tr key={u.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td style={{ padding: '12px' }}>
                        <div style={{ fontWeight: 600 }}>{u.email}</div>
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{u.id}</div>
                      </td>
                      <td style={{ padding: '12px' }}>
                        <span style={{
                          padding: '2px 8px',
                          borderRadius: 'var(--radius-pill)',
                          fontSize: '11px',
                          background: u.role === '专属管理员' ? 'rgba(255, 45, 32, 0.2)' : 'rgba(255,255,255,0.06)',
                          color: u.role === '专属管理员' ? '#ff453a' : 'var(--text-secondary)'
                        }}>
                          {u.role}
                        </span>
                      </td>
                      <td style={{ padding: '12px' }}>
                        <span style={{ color: u.isVerified ? '#30d158' : '#ff9f0a' }}>
                          {u.isVerified ? '✓ 已验证' : '○ 待激活'}
                        </span>
                      </td>
                      <td style={{ padding: '12px', textTransform: 'capitalize' }}>
                        {u.provider}
                      </td>
                      <td className="tabular-nums" style={{ padding: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
                        {formatBeijingDisplay(u.createdAt)}
                      </td>
                    </tr>
                  ))}
                  {(!usersData?.users || usersData.users.length === 0) && (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                        暂无数据
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </GlassCard>
          </div>
        )}

        {/* Tab 3: AI 监控 */}
        {currentTab === 'ai' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
              <GlassCard style={{ padding: '20px', borderRadius: '16px' }}>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px' }}>总调用次数 (Requests)</div>
                <div className="tabular-nums" style={{ fontSize: '28px', fontWeight: 900 }}>
                  {aiData?.totalRequests ?? 0}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>真实累计处理对话</div>
              </GlassCard>

              <GlassCard style={{ padding: '20px', borderRadius: '16px' }}>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px' }}>限流拦截次数 (Rate Limit)</div>
                <div className="tabular-nums" style={{ fontSize: '28px', fontWeight: 900, color: aiData?.rateLimitHits ? '#ff453a' : '#30d158' }}>
                  {aiData?.rateLimitHits ?? 0}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>小时全局/IP超额拦截</div>
              </GlassCard>

              <GlassCard style={{ padding: '20px', borderRadius: '16px' }}>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px' }}>上游模型服务提供商</div>
                <div style={{ fontSize: '20px', fontWeight: 800, textTransform: 'capitalize' }}>
                  {aiData?.provider || 'DeepSeek'}
                </div>
                <div style={{ fontSize: '11px', color: aiData?.isConfigured ? '#30d158' : '#ff9f0a', marginTop: '6px' }}>
                  {aiData?.isConfigured ? '✓ API 密钥已就绪' : '▲ 未配置密钥 (回退事实知识)'}
                </div>
              </GlassCard>
            </div>

            <GlassCard style={{ padding: '20px', borderRadius: '16px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '8px' }}>隐私与合规保护说明</h3>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.6, margin: 0 }}>
                严格遵循用户隐私准则：后台仅监控脱敏的请求总量、限流计数与 Token 估算，绝不采集或持久化存储任何用户聊天提问及模型输出内容。
              </p>
            </GlassCard>
          </div>
        )}

        {/* Tab 4: F1 数据调度 */}
        {currentTab === 'f1' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <GlassCard style={{ padding: '24px', borderRadius: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: 800, margin: '0 0 4px' }}>F1 赛事数据管理与手动调度</h3>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
                    手动强制触发 Jolpica / Ergast 赛历、车手与车队积分榜实时同步
                  </p>
                </div>

                <GlassButton
                  variant="primary"
                  onClick={handleTriggerF1Sync}
                  disabled={syncing || cooldownSeconds > 0}
                  style={{ opacity: syncing || cooldownSeconds > 0 ? 0.6 : 1 }}
                >
                  {syncing
                    ? '正在同步中...'
                    : cooldownSeconds > 0
                    ? `冷却中 (${cooldownSeconds}s)`
                    : '立即手动同步'}
                </GlassButton>
              </div>

              {syncResult && (
                <div style={{
                  padding: '12px 16px',
                  borderRadius: '12px',
                  marginBottom: '16px',
                  background: syncResult.success ? 'rgba(48, 209, 88, 0.1)' : 'rgba(255, 45, 32, 0.1)',
                  border: `1px solid ${syncResult.success ? 'rgba(48, 209, 88, 0.3)' : 'rgba(255, 45, 32, 0.3)'}`,
                  color: syncResult.success ? '#30d158' : '#ff453a',
                  fontSize: '13px'
                }}>
                  {syncResult.message}
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--line-dark)' }}>
                  <span style={{ color: 'var(--text-muted)' }}>当前赛季</span>
                  <span style={{ fontWeight: 600 }}>{f1Data?.season || '2026'} 赛季</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--line-dark)' }}>
                  <span style={{ color: 'var(--text-muted)' }}>积分榜截止状态</span>
                  <span style={{ fontWeight: 600 }}>{f1Data?.cutoffDesc || '待核实'} {f1Data?.cutoffVerified && '✓'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--line-dark)' }}>
                  <span style={{ color: 'var(--text-muted)' }}>飞书提醒隔离门禁</span>
                  <span style={{ color: '#30d158', fontWeight: 600 }}>✓ 已彻底隔离 (绝不触发飞书提醒)</span>
                </div>
              </div>
            </GlassCard>
          </div>
        )}
      </main>

      {/* TOTP 验证弹窗 (AAL2 提升) */}
      {showTotpModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 999,
          background: 'rgba(0, 0, 0, 0.8)',
          backdropFilter: 'blur(16px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}>
          <GlassCard style={{ padding: '32px', maxWidth: '380px', width: '100%', borderRadius: '24px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 800, marginBottom: '8px' }}>TOTP 双重身份验证 (AAL2)</h3>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: '20px' }}>
              敏感后台管理操作（如手动数据同步）需验证 6 位动态验证码。
            </p>

            {totpError && (
              <div style={{
                background: 'rgba(255, 45, 32, 0.1)',
                border: '1px solid rgba(255, 45, 32, 0.3)',
                color: '#ff453a',
                padding: '8px 12px',
                borderRadius: '8px',
                fontSize: '12px',
                marginBottom: '16px'
              }}>
                {totpError}
              </div>
            )}

            <form onSubmit={handleVerifyTotp} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <input
                type="text"
                maxLength={6}
                value={totpCode}
                onChange={e => setTotpCode(e.target.value.replace(/\D/g, ''))}
                placeholder="000000"
                autoFocus
                style={{
                  width: '100%',
                  padding: '14px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid var(--line-dark)',
                  borderRadius: '12px',
                  color: '#ffffff',
                  fontSize: '24px',
                  letterSpacing: '8px',
                  textAlign: 'center',
                  fontFamily: 'var(--font-mono)',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />

              <div style={{ display: 'flex', gap: '10px' }}>
                <GlassButton
                  type="button"
                  variant="ghost"
                  style={{ flex: 1 }}
                  onClick={() => setShowTotpModal(false)}
                >
                  取消
                </GlassButton>
                <GlassButton
                  type="submit"
                  variant="primary"
                  disabled={totpSubmitting || totpCode.length !== 6}
                  style={{ flex: 1 }}
                >
                  {totpSubmitting ? '验证中...' : '确认授权'}
                </GlassButton>
              </div>
            </form>
          </GlassCard>
        </div>
      )}

      {/* 手机端底部导航栏 (PWA iPhone 适配) */}
      <nav style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        background: 'rgba(12, 12, 14, 0.98)',
        backdropFilter: 'blur(20px)',
        borderTop: '1px solid var(--line-dark)',
        display: 'flex',
        justifyContent: 'space-around',
        alignItems: 'center',
        padding: '10px 0 calc(10px + env(safe-area-inset-bottom, 12px))',
        zIndex: 40
      }} className="mobile-admin-bottom-nav">
        <button
          onClick={() => setCurrentTab('overview')}
          style={{
            background: 'none',
            border: 'none',
            color: currentTab === 'overview' ? '#ff453a' : 'var(--text-muted)',
            fontSize: '11px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '4px',
            cursor: 'pointer'
          }}
        >
          <span style={{ fontSize: '18px' }}>📊</span>
          概览
        </button>
        <button
          onClick={() => setCurrentTab('users')}
          style={{
            background: 'none',
            border: 'none',
            color: currentTab === 'users' ? '#ff453a' : 'var(--text-muted)',
            fontSize: '11px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '4px',
            cursor: 'pointer'
          }}
        >
          <span style={{ fontSize: '18px' }}>👥</span>
          用户
        </button>
        <button
          onClick={() => setCurrentTab('ai')}
          style={{
            background: 'none',
            border: 'none',
            color: currentTab === 'ai' ? '#ff453a' : 'var(--text-muted)',
            fontSize: '11px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '4px',
            cursor: 'pointer'
          }}
        >
          <span style={{ fontSize: '18px' }}>✦</span>
          AI 监控
        </button>
        <button
          onClick={() => setCurrentTab('f1')}
          style={{
            background: 'none',
            border: 'none',
            color: currentTab === 'f1' ? '#ff453a' : 'var(--text-muted)',
            fontSize: '11px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '4px',
            cursor: 'pointer'
          }}
        >
          <span style={{ fontSize: '18px' }}>🏎</span>
          F1 调度
        </button>
      </nav>
    </div>
  );
}
