'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
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
    fetchCurrentSession().then(({ user, error }) => {
      if (mounted && !error) setUser(user);
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
    const desktop = window.matchMedia('(min-width: 1101px)');
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
  const currentIndex = NAV_ITEMS.findIndex(item => {
    const route = item.href.split('#')[0];
    return route === '/' ? pathname === '/' : pathname === route || pathname.startsWith(route + '/');
  });
  return <header className="site-header">
   <div className="container nav-inner">
    <Link href="/" className="nav-brand" aria-label="APEX 首页"><svg className="brand-mark" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 19L11 4h6l4 15h-5l-1-4H9l-2 4zM11 11h3l-1-4z" fill="currentColor"/></svg><span>APEX</span></Link>
    <nav className="nav-links desktop-nav" aria-label="主导航" style={{'--nav-index':Math.max(0,currentIndex),'--nav-active':currentIndex<0?0:1} as React.CSSProperties}>
     {NAV_ITEMS.map((item,i)=><Link key={item.href} prefetch={item.href === '/replay' ? false : undefined} href={item.href} className="nav-link" aria-current={currentIndex === i ? 'page' : undefined}>{item.label}</Link>)}
    </nav>
    <div className="nav-actions"><BeijingClock className="desktop-nav"/><Link href="/ai" className="nav-ai">APEX AI <span aria-hidden="true">↗</span></Link>
     {user?<div className="account-wrap desktop-nav" ref={accountRef}><button type="button" className="account-button" aria-expanded={userDropdownOpen} aria-controls="account-menu" onClick={()=>setUserDropdownOpen(!userDropdownOpen)}>{user.user_metadata?.name||user.email?.split('@')[0]||'我的账户'} ↓</button>{userDropdownOpen&&<div className="account-menu" id="account-menu"><span>{user.email}</span>{user.isAdmin&&<Link href="/admin" className="btn-secondary" onClick={()=>setUserDropdownOpen(false)}>管理工作台 ↗</Link>}<button type="button" className="glass-button glass-btn-ghost" onClick={handleLogout} disabled={loggingOut}>{loggingOut?'正在退出…':'退出登录'}</button></div>}</div>:<Link href="/login" className="nav-login desktop-nav">登录</Link>}
     <button type="button" className="mobile-nav-toggle" ref={toggleRef} aria-expanded={menuOpen} aria-controls="mobile-menu" aria-label="切换导航菜单" onClick={()=>setMenuOpen(!menuOpen)}><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d={menuOpen?'M6 6l12 12M18 6L6 18':'M4 8h16M4 16h16'}/></svg></button>
    </div>
   </div>
   {logoutError&&<div className="nav-feedback" role="alert">{logoutError}</div>}
   {menuOpen&&<div id="mobile-menu" className="mobile-menu" role="dialog" aria-modal="true" aria-label="网站导航" ref={drawerRef}>
    <button type="button" className="mobile-menu-close" onClick={()=>{setMenuOpen(false);toggleRef.current?.focus()}}>网站导航 <span>关闭 ×</span></button>
    {NAV_ITEMS.map(item=><Link key={item.href} prefetch={item.href === '/replay' ? false : undefined} href={item.href} onClick={()=>setMenuOpen(false)}>{item.label} <span aria-hidden="true">↗</span></Link>)}
    <Link href="/ai" onClick={()=>setMenuOpen(false)}>APEX AI ↗</Link>
    <div className="mobile-account">{user?<><span className="data-note">{user.email}</span>{user.isAdmin&&<Link href="/admin" onClick={()=>setMenuOpen(false)}>管理工作台 ↗</Link>}<button type="button" className="btn-secondary" disabled={loggingOut} onClick={async()=>{await handleLogout();setMenuOpen(false)}}>{loggingOut?'正在退出…':'退出登录'}</button></>:<Link href="/login" className="btn-primary" onClick={()=>setMenuOpen(false)}>登录 / 注册</Link>}<BeijingClock/></div>
   </div>}
  </header>;
}
