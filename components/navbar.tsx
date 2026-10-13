'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { GlassNav } from '@/components/glass/GlassNav';
import { fetchCurrentSession, apiLogout } from '@/lib/auth/client';
import { User } from '@/lib/auth/types';

export function Navbar() {
  const router = useRouter();
  const [bjTimeStr, setBjTimeStr] = useState('北京时间 --:--:--');
  const [menuOpen, setMenuOpen] = useState(false);
  const [user, setUser] = useState<(User & { isAdmin?: boolean }) | null>(null);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);

  useEffect(() => {
    fetchCurrentSession().then(({ user }) => {
      setUser(user as any);
    });
  }, []);

  const handleLogout = async () => {
    setUserDropdownOpen(false);
    await apiLogout();
    setUser(null);
    router.refresh();
  };

  useEffect(() => {
    const update = () => {
      try {
        const s = new Intl.DateTimeFormat('zh-CN', {
          timeZone: 'Asia/Shanghai',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false
        }).format(new Date());
        setBjTimeStr(`北京时间 ${s}`);
      } catch (_) {}
    };

    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <GlassNav style={{ height: '64px' }}>
      <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '100%' }}>
        {/* Brand */}
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 800, fontSize: '18px', letterSpacing: '0.08em' }}>
          <span>TIKE</span>
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent-red)' }}></span>
        </Link>

        {/* Desktop Links */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '32px' }} className="desktop-nav">
          <Link href="/#race" style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 500, transition: 'color 0.2s' }}>当前分站</Link>
          <Link href="/standings" style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 500, transition: 'color 0.2s' }}>积分榜</Link>
          <Link href="/replay" style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 500, transition: 'color 0.2s' }}>动态回放</Link>
          <Link href="/drivers" style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 500, transition: 'color 0.2s' }}>车手</Link>
          <Link href="/teams" style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 500, transition: 'color 0.2s' }}>车队</Link>
          <Link href="/races" style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 500, transition: 'color 0.2s' }}>全季赛历</Link>
        </div>

        {/* Right CTA, User Account & Clock */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span className="tabular-nums desktop-nav" style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-muted)' }}>
            {bjTimeStr}
          </span>

          <Link href="/ai" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(255, 255, 255, 0.1)', border: '1px solid var(--line-dark)', padding: '6px 14px', borderRadius: 'var(--radius-pill)', fontSize: '12px', fontWeight: 600 }}>
            <span>TIKE AI 智能</span>
            <span style={{ fontSize: '10px', color: '#ff453a' }}>✦</span>
          </Link>

          {/* User Account / Login Button */}
          {user ? (
            <div style={{ position: 'relative' }} className="desktop-nav">
              <button
                onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid var(--line-dark)',
                  borderRadius: 'var(--radius-pill)',
                  padding: '4px 10px 4px 6px',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                  fontSize: '12px'
                }}
              >
                <div style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  background: user.isAdmin ? 'var(--accent-red)' : 'rgba(255, 255, 255, 0.2)',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: '11px'
                }}>
                  {user.email ? user.email.slice(0, 1).toUpperCase() : 'U'}
                </div>
                <span style={{ maxWidth: '80px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {user.user_metadata?.name || user.email?.split('@')[0]}
                </span>
              </button>

              {userDropdownOpen && (
                <div style={{
                  position: 'absolute',
                  right: 0,
                  top: '100%',
                  marginTop: '8px',
                  width: '200px',
                  background: 'rgba(18, 18, 20, 0.98)',
                  border: '1px solid var(--line-dark)',
                  borderRadius: '16px',
                  padding: '12px',
                  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6)',
                  zIndex: 100,
                  backdropFilter: 'blur(16px)'
                }}>
                  <div style={{ paddingBottom: '8px', borderBottom: '1px solid var(--line-dark)', marginBottom: '8px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {user.email}
                    </div>
                    <div style={{ fontSize: '10px', marginTop: '2px', color: user.isAdmin ? '#ff453a' : 'var(--text-muted)' }}>
                      {user.isAdmin ? '平台专属管理员' : '普通用户'}
                    </div>
                  </div>

                  {user.isAdmin && (
                    <Link
                      href="/admin"
                      onClick={() => setUserDropdownOpen(false)}
                      style={{
                        display: 'block',
                        padding: '6px 8px',
                        fontSize: '12px',
                        color: 'var(--text-primary)',
                        borderRadius: '8px',
                        background: 'rgba(255, 45, 32, 0.1)',
                        marginBottom: '6px',
                        fontWeight: 600
                      }}
                    >
                      ⚙ APEX Control 后台
                    </Link>
                  )}

                  <button
                    onClick={handleLogout}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '6px 8px',
                      fontSize: '12px',
                      color: '#ff453a',
                      background: 'none',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer'
                    }}
                  >
                    退出登录
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link
              href="/login"
              className="desktop-nav"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                background: 'var(--accent-red)',
                color: '#ffffff',
                padding: '6px 14px',
                borderRadius: 'var(--radius-pill)',
                fontSize: '12px',
                fontWeight: 600
              }}
            >
              登录
            </Link>
          )}

          {/* Mobile Menu Toggle Button */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="mobile-nav-toggle"
            aria-label="切换导航菜单"
            style={{ background: 'none', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', padding: '6px' }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {menuOpen ? (
                <path d="M18 6L6 18M6 6l12 12" />
              ) : (
                <path d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile Drawer Overlay */}
      {menuOpen && (
        <div style={{
          position: 'fixed',
          top: '64px',
          left: 0,
          right: 0,
          bottom: 0,
          minHeight: 'calc(100dvh - 64px)',
          background: 'rgba(10, 10, 11, 0.98)',
          zIndex: 99,
          padding: '36px 24px calc(36px + env(safe-area-inset-bottom, 0px))',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px'
        }}>
          <Link href="/#race" onClick={() => setMenuOpen(false)} style={{ fontSize: '18px', fontWeight: 600 }}>当前分站赛程</Link>
          <Link href="/standings" onClick={() => setMenuOpen(false)} style={{ fontSize: '18px', fontWeight: 600 }}>锦标赛积分榜</Link>
          <Link href="/replay" onClick={() => setMenuOpen(false)} style={{ fontSize: '18px', fontWeight: 600 }}>比赛动态回放</Link>
          <Link href="/drivers" onClick={() => setMenuOpen(false)} style={{ fontSize: '18px', fontWeight: 600 }}>正式车手阵容</Link>
          <Link href="/teams" onClick={() => setMenuOpen(false)} style={{ fontSize: '18px', fontWeight: 600 }}>制造商品牌</Link>
          <Link href="/races" onClick={() => setMenuOpen(false)} style={{ fontSize: '18px', fontWeight: 600 }}>2026 全年赛历</Link>
          <Link href="/ai" onClick={() => setMenuOpen(false)} style={{ fontSize: '18px', fontWeight: 600, color: '#ff453a' }}>TIKE AI 智能控制台 ✦</Link>

          {/* Mobile Auth Section */}
          <div style={{ marginTop: 'auto', paddingTop: '20px', borderTop: '1px solid var(--line-dark)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {user ? (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{user.email}</span>
                  <span className={`badge-pill ${user.isAdmin ? 'badge-red' : ''}`} style={{ fontSize: '10px' }}>
                    {user.isAdmin ? '管理员' : '普通用户'}
                  </span>
                </div>
                {user.isAdmin && (
                  <Link href="/admin" onClick={() => setMenuOpen(false)} style={{ fontSize: '14px', color: '#ff453a', fontWeight: 600 }}>
                    ⚙ APEX Control 管理后台
                  </Link>
                )}
                <button
                  onClick={async () => {
                    await handleLogout();
                    setMenuOpen(false);
                  }}
                  style={{
                    background: 'rgba(255, 45, 32, 0.1)',
                    border: '1px solid rgba(255, 45, 32, 0.3)',
                    color: '#ff453a',
                    padding: '8px 14px',
                    borderRadius: 'var(--radius-pill)',
                    fontSize: '13px',
                    cursor: 'pointer'
                  }}
                >
                  退出登录
                </button>
              </>
            ) : (
              <Link
                href="/login"
                onClick={() => setMenuOpen(false)}
                style={{
                  textAlign: 'center',
                  background: 'var(--accent-red)',
                  color: '#ffffff',
                  padding: '10px 16px',
                  borderRadius: 'var(--radius-pill)',
                  fontSize: '14px',
                  fontWeight: 600
                }}
              >
                登录 / 注册
              </Link>
            )}

            <div className="tabular-nums" style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center' }}>
              {bjTimeStr} · UTC+8
            </div>
          </div>
        </div>
      )}
    </GlassNav>
  );
}
