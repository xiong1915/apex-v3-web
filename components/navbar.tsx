'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {AILink} from './ai-link';
import {NavigationFeedback} from './navigation-feedback';
import { useRouter, usePathname } from 'next/navigation';
import { apiLogout } from '@/lib/auth/client';
import { fetchAccountProfile, UserProfile } from '@/lib/profile/client';
import { User } from '@/lib/auth/types';

const NAV_ITEMS = [
  { href: '/#race', label: '当前分站' },
  { href: '/races', label: '全季赛历' },
  { href: '/standings', label: '积分榜' },
  { href: '/live', label: '实时数据' },
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

function UserAvatar({
  url,
  name,
  size = 24
}: {
  url?: string | null;
  name: string;
  size?: number;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const initial = (name || 'A').trim().charAt(0).toUpperCase();

  useEffect(() => {
    setImgFailed(false);
  }, [url]);

  if (url && !imgFailed) {
    return (
      <img
        src={url}
        alt={name}
        className="nav-user-avatar"
        style={{
          width: `${size}px`,
          height: `${size}px`,
          borderRadius: '50%',
          objectFit: 'cover',
          display: 'block',
          flexShrink: 0
        }}
        onError={() => setImgFailed(true)}
      />
    );
  }

  return (
    <span
      className="nav-user-avatar nav-avatar-fallback"
      style={{
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: '50%',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #e10600 0%, #ff8000 100%)',
        color: '#fff',
        fontWeight: 600,
        fontSize: `${Math.max(10, Math.floor(size * 0.42))}px`,
        userSelect: 'none',
        flexShrink: 0
      }}
      aria-hidden="true"
    >
      {initial}
    </span>
  );
}

export function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const drawerRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const accountRef = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [user, setUser] = useState<(User & { isAdmin?: boolean }) | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [identityStatus, setIdentityStatus] = useState<'loading'|'ready'|'error'>('loading');
  const identityRequest = useRef(0);
  const activeUserId = useRef<string|null>(null);
  const identityResolved = useRef(false);

  useEffect(() => {
    let mounted = true;
    const load = (event?: Event) => {
      const request = ++identityRequest.current;
      const background = (event as CustomEvent<{reason?:string}> | undefined)?.detail?.reason === 'focus' && identityResolved.current;
      if (!background) {
        identityResolved.current = false;
        activeUserId.current = null;
        setUser(null); setProfile(null); setUserDropdownOpen(false);
        setIdentityStatus('loading');
      }
      fetchAccountProfile().then(({user, profile, error}) => {
        if (!mounted || request !== identityRequest.current) return;
        if (error && !user) { setIdentityStatus('error'); return; }
        identityResolved.current = true;
        activeUserId.current = user?.id || null;
        setUser(user); setProfile(profile); setIdentityStatus('ready');
      });
    };
    load();
    window.addEventListener('apex:identity-changed', load);
    const onProfileUpdated = (e: CustomEvent) => {
      if (mounted && e.detail?.id === activeUserId.current) {
        setProfile(e.detail);
      }
    };
    window.addEventListener('apex:profile-updated', onProfileUpdated as EventListener);

    return () => {
      mounted = false;
      window.removeEventListener('apex:identity-changed', load);
      window.removeEventListener('apex:profile-updated', onProfileUpdated as EventListener);
    };
  }, []);

  const handleLogout = async () => {
    if (loggingOut) return;
    setUserDropdownOpen(false);
    setLogoutError(null);
    setLoggingOut(true);
    try {
      await apiLogout();
      setUser(null);
      setProfile(null);
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

  const displayName = profile?.display_name || user?.user_metadata?.name || user?.email?.split('@')[0] || '我的账户';
  const avatarUrl = profile?.avatar_url || user?.user_metadata?.avatar_url || null;

  return <header className="site-header">
   <div className="container nav-inner">
    <Link href="/" className="nav-brand" aria-label="APEX 首页"><svg className="brand-mark" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 19L11 4h6l4 15h-5l-1-4H9l-2 4zM11 11h3l-1-4z" fill="currentColor"/></svg><span>APEX</span></Link>
    <nav className="nav-links desktop-nav" aria-label="主导航" style={{'--nav-index':Math.max(0,currentIndex),'--nav-active':currentIndex<0?0:1} as React.CSSProperties}>
     {NAV_ITEMS.map((item,i)=><Link key={item.href} prefetch={item.href === '/live' ? false : undefined} href={item.href} className="nav-link" aria-current={currentIndex === i ? 'page' : undefined}>{item.label}<NavigationFeedback/></Link>)}
    </nav>
    <div className="nav-actions"><BeijingClock className="desktop-nav"/><AILink className="nav-ai">APEX AI <span aria-hidden="true">↗</span></AILink>
     {identityStatus !== 'ready' ? <span className="nav-login desktop-nav" role="status">{identityStatus === 'loading' ? '账户加载中…' : <button type="button" className="text-link" onClick={()=>window.dispatchEvent(new Event('apex:identity-changed'))}>账户暂不可用 · 重试</button>}</span> : user ? (
       <div className="account-wrap desktop-nav" ref={accountRef}>
         <button
           type="button"
           className="account-button"
           aria-expanded={userDropdownOpen}
           aria-controls="account-menu"
           onClick={() => setUserDropdownOpen(!userDropdownOpen)}
         >
           <UserAvatar url={avatarUrl} name={displayName} size={22} />
           <span className="account-button-text">{displayName}</span>
           <span aria-hidden="true" style={{ fontSize: '10px', opacity: 0.7 }}>↓</span>
         </button>
         {userDropdownOpen && (
           <div className="account-menu" id="account-menu">
             <div className="account-menu-header">
               <UserAvatar url={avatarUrl} name={displayName} size={36} />
               <div className="account-menu-meta">
                 <strong className="account-menu-name">{displayName}</strong>
                 <span className="account-menu-email">{user.email}</span>
               </div>
             </div>
             <Link
               href="/profile"
               className="btn-secondary"
               style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
               onClick={() => setUserDropdownOpen(false)}
             >
               <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                 <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                 <circle cx="12" cy="7" r="4"/>
               </svg>
               APEX ID 个人中心
             </Link>
             {user.isAdmin && (
               <Link href="/admin" className="btn-secondary" onClick={() => setUserDropdownOpen(false)}>
                 管理工作台 ↗
               </Link>
             )}
             <button
               type="button"
               className="glass-button glass-btn-ghost"
               onClick={handleLogout}
               disabled={loggingOut}
             >
               {loggingOut ? '正在退出…' : '退出登录'}
             </button>
           </div>
         )}
       </div>
     ) : (
       <Link href="/login" className="nav-login desktop-nav">登录</Link>
     )}
     <button type="button" className="mobile-nav-toggle" ref={toggleRef} aria-expanded={menuOpen} aria-controls="mobile-menu" aria-label="切换导航菜单" onClick={()=>setMenuOpen(!menuOpen)}><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d={menuOpen?'M6 6l12 12M18 6L6 18':'M4 8h16M4 16h16'}/></svg></button>
    </div>
   </div>
   {logoutError&&<div className="nav-feedback" role="alert">{logoutError}</div>}
   {menuOpen&&<div id="mobile-menu" className="mobile-menu" role="dialog" aria-modal="true" aria-label="网站导航" ref={drawerRef}>
    <button type="button" className="mobile-menu-close" onClick={()=>{setMenuOpen(false);toggleRef.current?.focus()}}>网站导航 <span>关闭 ×</span></button>
    {NAV_ITEMS.map(item=><Link key={item.href} prefetch={item.href === '/live' ? false : undefined} href={item.href} onClick={()=>setMenuOpen(false)}>{item.label} <span aria-hidden="true">↗</span><NavigationFeedback/></Link>)}
    <AILink onClick={()=>setMenuOpen(false)}>APEX AI ↗</AILink>
    <div className="mobile-account">
      {identityStatus !== 'ready' ? <span className="data-note" role="status">{identityStatus === 'loading' ? '账户加载中…' : <button type="button" className="text-link" onClick={()=>window.dispatchEvent(new Event('apex:identity-changed'))}>账户暂不可用 · 重试</button>}</span> : user ? (
        <>
          <div className="mobile-profile-card">
            <UserAvatar url={avatarUrl} name={displayName} size={36} />
            <div className="mobile-profile-info">
              <strong>{displayName}</strong>
              <span className="data-note">{user.email}</span>
            </div>
          </div>
          <Link href="/profile" className="btn-secondary" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }} onClick={()=>setMenuOpen(false)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
            APEX ID 个人中心
          </Link>
          {user.isAdmin && <Link href="/admin" onClick={()=>setMenuOpen(false)}>管理工作台 ↗</Link>}
          <button type="button" className="btn-secondary" disabled={loggingOut} onClick={async()=>{await handleLogout();setMenuOpen(false)}}>
            {loggingOut?'正在退出…':'退出登录'}
          </button>
        </>
      ) : (
        identityStatus !== 'ready' ? <span role="status">{identityStatus === 'loading' ? '账户加载中…' : '账户暂不可用，请刷新重试'}</span> : <Link href="/login" className="btn-primary" onClick={()=>setMenuOpen(false)}>登录 / 注册</Link>
      )}
      <BeijingClock/>
    </div>
   </div>}
  </header>;
}
