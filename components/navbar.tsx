'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { GlassNav } from '@/components/glass/GlassNav';
import { fetchCurrentSession, apiLogout } from '@/lib/auth/client';
import { User } from '@/lib/auth/types';

const NAV_ITEMS = [
  { href: '/#race', label: '当前分站' },
  { href: '/races', label: '全季赛历' },
  { href: '/standings', label: '积分榜' },
  { href: '/replay', label: '动态回放' },
  { href: '/drivers', label: '车手' },
  { href: '/teams', label: '车队' }
];
const clockFormatter = new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'Asia/Shanghai', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
});
function BeijingClock({ className = '' }: { className?: string }) {
  const [time, setTime] = useState('北京时间 --:--:--');
  useEffect(() => {
    const update = () => { if (!document.hidden) setTime(`北京时间 ${clockFormatter.format(new Date())}`); };
    update();
    const timer = setInterval(update, 1000);
    document.addEventListener('visibilitychange', update);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', update); };
  }, []);
  return <span className={`nav-clock tabular-nums ${className}`}>{time}</span>;
}

export function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const drawerRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const accountRef = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [user, setUser] = useState<(User & { isAdmin?: boolean }) | null>(null);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    let mounted = true;
    fetchCurrentSession().then(({ user }) => {
      if (mounted) setUser(user);
    });
    return () => { mounted = false; };
  }, [pathname]);

  const handleLogout = async () => {
    if (loggingOut) return;
    setUserDropdownOpen(false);
    setLogoutError(null);
    setLoggingOut(true);
    try {
      await apiLogout();
      setUser(null);
      router.refresh();
    } catch {
      setMenuOpen(false);
      setLogoutError('退出登录失败，请检查网络后重试。当前登录状态仍保留。');
    } finally { setLoggingOut(false); }
  };

  useEffect(() => {
    setMenuOpen(false);
    setUserDropdownOpen(false);
  }, [pathname]);

  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 1121px)');
    const closeOnDesktop = () => { if (desktop.matches) setMenuOpen(false); };
    desktop.addEventListener('change', closeOnDesktop);
    return () => desktop.removeEventListener('change', closeOnDesktop);
  }, []);

  useEffect(() => {
    if (!menuOpen && !userDropdownOpen) return;
    const previousOverflow = document.body.style.overflow;
    const main = document.querySelector('main');
    const previousInert = main?.inert ?? false;
    if (menuOpen) {
      document.body.style.overflow = 'hidden';
      if (main) main.inert = true;
      drawerRef.current?.querySelector<HTMLElement>('button, a')?.focus();
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
        setUserDropdownOpen(false);
        if (menuOpen) toggleRef.current?.focus();
        else accountRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
      }
      if (event.key !== 'Tab' || !menuOpen) return;
      const items = drawerRef.current?.querySelectorAll<HTMLElement>('a[href], button:not([disabled])');
      if (!items?.length) return;
      const first = items[0], last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    const outsideAccount = (event: PointerEvent) => {
      if (!accountRef.current?.contains(event.target as Node)) setUserDropdownOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', outsideAccount);
    return () => {
      document.body.style.overflow = previousOverflow;
      if (main) main.inert = previousInert;
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', outsideAccount);
    };
  }, [menuOpen, userDropdownOpen]);
  return (
    <GlassNav aria-label="主导航" style={{ height: '64px' }}>
      <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '100%' }}>
        {/* Brand */}
        <Link href="/" className="nav-brand" aria-label="APEX 首页" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 800, fontSize: '18px', letterSpacing: '0.08em' }}>
          <span>APEX</span>
          <span className="brand-slash" aria-hidden="true" />
        </Link>

        {/* Desktop Links */}
        <div className="desktop-nav nav-links">
          {NAV_ITEMS.map(item => (
            <Link key={item.href} href={item.href} className="nav-link"
              aria-current={pathname === item.href.split('#')[0] ? 'page' : undefined}>
              {item.label}
            </Link>
          ))}
        </div>

        {/* Right CTA, User Account & Clock */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <BeijingClock className="desktop-nav" />

          <Link href="/ai" className="nav-ai" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(255, 255, 255, 0.1)', border: '1px solid var(--line-dark)', padding: '6px 14px', borderRadius: 'var(--radius-pill)', fontSize: '12px', fontWeight: 600 }}>
            <span>APEX AI</span>
            <span style={{ fontSize: '10px', color: '#ff453a' }}>✦</span>
          </Link>

          {/* User Account / Login Button */}
          {user ? (
            <div ref={accountRef} style={{ position: 'relative' }} className="desktop-nav">
              <button
                aria-expanded={userDropdownOpen} aria-controls="account-menu" onClick={() => setUserDropdownOpen(!userDropdownOpen)}
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
                <div id="account-menu" style={{
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
                    disabled={loggingOut}
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
                    {loggingOut ? '正在退出…' : '退出登录'}
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
                background: 'var(--accent-action)',
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
            ref={toggleRef} className="mobile-nav-toggle" aria-expanded={menuOpen} aria-controls="mobile-menu"
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

      {logoutError && <div className="nav-feedback" role="alert">{logoutError}</div>}
      {/* Mobile Drawer Overlay */}
      {menuOpen && (
        <div id="mobile-menu" ref={drawerRef} role="dialog" aria-modal="true" aria-label="网站导航" className="mobile-menu" style={{
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
          <button type="button" className="mobile-menu-close" onClick={() => { setMenuOpen(false); toggleRef.current?.focus(); }}>关闭菜单 <span aria-hidden="true">×</span></button>
          <Link href="/#race" onClick={() => setMenuOpen(false)} style={{ fontSize: '18px', fontWeight: 600 }}>当前分站赛程</Link>
          <Link href="/standings" onClick={() => setMenuOpen(false)} style={{ fontSize: '18px', fontWeight: 600 }}>锦标赛积分榜</Link>
          <Link href="/replay" onClick={() => setMenuOpen(false)} style={{ fontSize: '18px', fontWeight: 600 }}>比赛动态回放</Link>
          <Link href="/drivers" onClick={() => setMenuOpen(false)} style={{ fontSize: '18px', fontWeight: 600 }}>正式车手阵容</Link>
          <Link href="/teams" onClick={() => setMenuOpen(false)} style={{ fontSize: '18px', fontWeight: 600 }}>制造商品牌</Link>
          <Link href="/races" onClick={() => setMenuOpen(false)} style={{ fontSize: '18px', fontWeight: 600 }}>2026 全年赛历</Link>
          <Link href="/ai" onClick={() => setMenuOpen(false)} style={{ fontSize: '18px', fontWeight: 600, color: '#ff453a' }}>APEX AI控制台 ✦</Link>

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
                  disabled={loggingOut}
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
                  {loggingOut ? '正在退出…' : '退出登录'}
                </button>
              </>
            ) : (
              <Link
                href="/login"
                onClick={() => setMenuOpen(false)}
                style={{
                  textAlign: 'center',
                  background: 'var(--accent-action)',
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

            <BeijingClock />
          </div>
        </div>
      )}
    </GlassNav>
  );
}
