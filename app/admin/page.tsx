// app/admin/page.tsx
'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { GlassCard, GlassButton } from '@/components/glass';
import { fetchCurrentSession, apiLogout } from '@/lib/auth/client';
import { formatBeijingDisplay } from '@/lib/f1/time';
import { AdminAIMonitor } from '@/components/admin-ai-monitor';

type AdminTab = 'overview' | 'users' | 'ai' | 'f1';
const adminTabs = [{id:'overview',label:'网站概览',short:'概览',description:'服务状态、发布版本与数据更新时间。'}, {id:'users',label:'用户管理',short:'用户',description:'查询账号、验证状态和关联的 AI 记录。'}, {id:'ai',label:'AI 监控与用量',short:'AI 监控',description:'查看运行指标和请求记录。'}, {id:'f1',label:'F1 数据调度',short:'F1 调度',description:'核对数据状态，按需重新同步。'}] as const;
function tabFromLocation():AdminTab {const value=new URLSearchParams(window.location.search).get('tab');return adminTabs.some(tab=>tab.id===value)?value as AdminTab:'overview';}

function renderTotpQr(qr?: string) {
  if (!qr) return null;
  const trimmed = qr.trim();
  if (trimmed.startsWith('data:') || trimmed.startsWith('http')) {
    return (
      <img
        src={trimmed}
        alt="TOTP 绑定二维码"
        style={{ width: '180px', height: '180px', display: 'block', margin: '0 auto' }}
      />
    );
  }
  if (trimmed.startsWith('<svg')) {
    return (
      <div
        dangerouslySetInnerHTML={{ __html: trimmed }}
        style={{
          width: '180px',
          height: '180px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto'
        }}
      />
    );
  }
  return (
    <img
      src={`data:image/svg+xml;utf-8,${encodeURIComponent(trimmed)}`}
      alt="TOTP 绑定二维码"
      style={{ width: '180px', height: '180px', display: 'block', margin: '0 auto' }}
    />
  );
}

export default function AdminPage() {
  const router = useRouter();

  const [authError, setAuthError] = useState<string | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminUser, setAdminUser] = useState<any>(null);
  const [aalLevel, setAalLevel] = useState<'aal1' | 'aal2'>('aal1');

  // Tab State
  const [currentTab, setCurrentTab] = useState<AdminTab>('overview');
  const [selectedAuditUserId, setSelectedAuditUserId] = useState<string | undefined>(undefined);
  const [userSearch,setUserSearch]=useState('');
  const [userVerification,setUserVerification]=useState('all');
  const [userPage,setUserPage]=useState(1);
  const [updatedAt,setUpdatedAt]=useState<Partial<Record<AdminTab,string>>>({});
  const loadSequence=useRef(0),aiInFlight=useRef(false),syncInFlight=useRef(false);
  const aiReadSequence=useRef(0);
  const modalRef=useRef<HTMLDivElement>(null),totpBusy=useRef(false);

  // Data States (全部读取真实数据)
  const [overviewData, setOverviewData] = useState<any>(null);
  const [usersData, setUsersData] = useState<any>(null);
  const [aiData, setAiData] = useState<any>(null);
  const [aiRefreshing, setAiRefreshing] = useState(false);
  const [aiMonitorError, setAiMonitorError] = useState<string | null>(null);
  const [autoRefreshAI, setAutoRefreshAI] = useState(false);
  const [f1Data, setF1Data] = useState<any>(null);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [dataErrors, setDataErrors] = useState<Partial<Record<AdminTab, string>>>({});
  const permissionGeneration = useRef(0);
  const clearPrivateData = useCallback(() => {
    permissionGeneration.current++;
    setOverviewData(null); setUsersData(null); setAiData(null); setF1Data(null);
    setAutoRefreshAI(false);
    setUpdatedAt({});setSelectedAuditUserId('');setAiMonitorError(null);
  }, []);

  // TOTP Modal & Enroll
  const [showTotpModal, setShowTotpModal] = useState(false);
  const [totpCode, setTotpCode] = useState('');
  const [totpSubmitting, setTotpSubmitting] = useState(false);
  totpBusy.current=totpSubmitting;
  const [totpError, setTotpError] = useState<string | null>(null);
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [enrollData, setEnrollData] = useState<{
    enrolled?: boolean;
    verified?: boolean;
    factorId?: string;
    qrCode?: string;
    secret?: string;
    uri?: string;
    message?: string;
  } | null>(null);
  const [loadingEnroll, setLoadingEnroll] = useState(false);

  const openTotpModal = useCallback(async () => {
    setShowTotpModal(true);
    setTotpError(null);
    setEnrollData(null);
    setTotpCode('');
    setLoadingEnroll(true);
    try {
      const res = await fetch('/api/admin/mfa/enroll', { method: 'POST', cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setEnrollData(data);
      } else {
        setTotpError(data.error || '获取绑定信息失败');
      }
    } catch (e: any) {
      setTotpError(e.message || '网络连接异常');
    } finally {
      setLoadingEnroll(false);
    }
  }, []);

  // F1 Manual Sync
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ success: boolean; message: string } | null>(null);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);

  // 1. 初始化鉴权
  useEffect(() => {
    let mounted = true;
    fetchCurrentSession().then(async ({ user, session, error }) => {
      if (!mounted) return;
      if (error) {setAuthError(error); setCheckingAuth(false); return;}
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

        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setAuthError(data.error || '身份服务暂不可用，请重试');
          setCheckingAuth(false);
          return;
        }
        if (!mounted) return;
        setIsAdmin(true);
        setAdminUser(user);
        const resolvedAal = data.aal === 'aal2' ? 'aal2' : 'aal1';
        setAalLevel(resolvedAal);
        setCheckingAuth(false);

      } catch (_) {
        setAuthError('身份服务连接失败，请重试');
        setCheckingAuth(false);
      }
    });

    return () => {
      mounted = false;
    };
  }, [router]);

  // 2. 加载数据
  const loadData = useCallback(async (only?: AdminTab) => {
    if (!isAdmin || aalLevel !== 'aal2') return;
    const generation=permissionGeneration.current, sequence=++loadSequence.current;
    setLoading(true);setErrorMsg(null);
    const setters={overview:setOverviewData,users:setUsersData,ai:setAiData,f1:setF1Data};
    try {
      await Promise.all((only?[only]:['overview','users','ai','f1'] as AdminTab[]).map(async tab=>{
        const aiRead=tab==='ai'?++aiReadSequence.current:0;
        try {
          const response=await fetch(`/api/admin/${tab}`,{cache:'no-store'});
          const data=await response.json().catch(()=>({}));
          if(generation!==permissionGeneration.current||sequence!==loadSequence.current)return;
          if(tab==='ai'&&aiRead!==aiReadSequence.current)return;
          if(response.status===401||response.status===403){clearPrivateData();setAalLevel('aal1');setErrorMsg('管理权限或双重验证已失效，请重新验证身份');return;}
          if(!response.ok)throw Error(data.error||'后台数据读取失败');
          setters[tab](data);setUpdatedAt(prev=>({...prev,[tab]:new Date().toISOString()}));
          setDataErrors(prev=>{const next={...prev};delete next[tab];return next;});
        }catch(error){if(generation===permissionGeneration.current&&sequence===loadSequence.current&&(tab!=='ai'||aiRead===aiReadSequence.current))setDataErrors(prev=>({...prev,[tab]:error instanceof Error?error.message:'读取失败，请重试'}));}
      }));
    }finally{if(sequence===loadSequence.current)setLoading(false);}
  },[isAdmin,aalLevel,clearPrivateData]);

  useEffect(() => {
    if (isAdmin && aalLevel === 'aal2') {
      loadData();
    }
  }, [isAdmin, aalLevel, loadData]);

  const refreshAIMonitor = useCallback(async () => {
    if (!isAdmin || aalLevel !== 'aal2' || aiInFlight.current) return;
    aiInFlight.current=true;
    const sequence=++aiReadSequence.current;
    const generation = permissionGeneration.current;
    setAiRefreshing(true);
    try {
      const response = await fetch('/api/admin/ai', { cache: 'no-store' });
      const data = await response.json().catch(() => ({}));
      if (generation !== permissionGeneration.current) return;
      if(sequence!==aiReadSequence.current)return;
      if (response.status === 401 || response.status === 403) {
        clearPrivateData(); setAalLevel('aal1');
        throw new Error('管理权限或双重验证已失效，请重新验证身份');
      }
      if (!response.ok) throw new Error(data.error || 'AI 监控读取失败');
      setAiData(data);
      setAiMonitorError(null);
      setDataErrors(prev=>{const next={...prev};delete next.ai;return next;});
      setUpdatedAt(prev=>({...prev,ai:new Date().toISOString()}));
    } catch (error) { if(generation===permissionGeneration.current&&sequence===aiReadSequence.current)setAiMonitorError(error instanceof Error ? error.message : 'AI 监控读取失败'); }
    finally { aiInFlight.current=false;setAiRefreshing(false); }
  }, [isAdmin, aalLevel, clearPrivateData]);
  useEffect(() => {
    if (!autoRefreshAI || currentTab !== 'ai' || !isAdmin || aalLevel !== 'aal2') return;
    const timer = setInterval(() => { if (!document.hidden) void refreshAIMonitor(); }, 30000);
    return () => clearInterval(timer);
  }, [autoRefreshAI, currentTab, isAdmin, aalLevel, refreshAIMonitor]);

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
        body: JSON.stringify({
          code: totpCode,
          factorId: enrollData?.factorId
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setTotpError(data.error || '验证失败');
        return;
      }

      setAalLevel('aal2');
      setShowTotpModal(false);
      setTotpCode('');
      // 成功升级为 AAL2 后重新加载后台数据
      // The AAL2 state change starts the protected data read through the effect.
    } catch (err: any) {
      setTotpError(err.message || '网络连接异常');
    } finally {
      setTotpSubmitting(false);
    }
  };

  // 4. 手动同步 F1 数据
  const handleTriggerF1Sync = async () => {
    if(syncInFlight.current)return;
    if (aalLevel !== 'aal2') {
      openTotpModal();
      return;
    }

    syncInFlight.current=true;setSyncing(true);
    setSyncResult(null);

    try {
      const res = await fetch('/api/admin/f1', { method: 'POST' });
      if (res.status === 401 || res.status === 403) {
        clearPrivateData(); setAalLevel('aal1');
        setSyncResult({success:false,message:'管理权限或双重验证已失效，请重新验证身份'});
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) { clearPrivateData(); setAalLevel('aal1'); }
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
      syncInFlight.current=false;setSyncing(false);
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

  const selectTab=useCallback((tab:AdminTab,auditUserId?:string)=>{
    setCurrentTab(tab);setSelectedAuditUserId(auditUserId);
    const url=new URL(window.location.href);
    if(url.searchParams.get('tab')!==tab){url.searchParams.set('tab',tab);history.pushState(null,'',url.pathname+url.search);}
  },[]);
  useEffect(()=>{
    const restore=()=>{setCurrentTab(tabFromLocation());setSelectedAuditUserId('');};restore();
    window.addEventListener('popstate',restore);return()=>window.removeEventListener('popstate',restore);
  },[]);
  useEffect(()=>{setUserPage(1);},[userSearch,userVerification]);
  const filteredUsers=useMemo(()=>((usersData?.users||[]) as any[]).filter(user=>{
    const matches=`${user.email||''} ${user.displayName||''} ${user.id||''}`.toLocaleLowerCase().includes(userSearch.trim().toLocaleLowerCase());
    return matches&&(userVerification==='all'||(userVerification==='verified'?user.isVerified:!user.isVerified));
  }),[usersData,userSearch,userVerification]);
  const userPages=Math.max(1,Math.ceil(filteredUsers.length/20)),safeUserPage=Math.min(userPage,userPages);
  const shownUsers=filteredUsers.slice((safeUserPage-1)*20,safeUserPage*20);
  const activeTab=adminTabs.find(tab=>tab.id===currentTab)!;
  const hasCurrentData={overview:overviewData,users:usersData,ai:aiData,f1:f1Data}[currentTab];
  const onNavKey=(event:React.KeyboardEvent<HTMLElement>)=>{
    const buttons=Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button'));
    const index=buttons.indexOf(document.activeElement as HTMLButtonElement);
    const next=event.key==='Home'?0:event.key==='End'?buttons.length-1:['ArrowRight','ArrowDown'].includes(event.key)?(index+1)%buttons.length:['ArrowLeft','ArrowUp'].includes(event.key)?(index+buttons.length-1)%buttons.length:-1;
    if(next>=0){event.preventDefault();buttons[next].focus();buttons[next].click();}
  };
  useEffect(()=>{
    if(!showTotpModal)return;
    const previous=document.activeElement as HTMLElement|null,overflow=document.body.style.overflow;
    document.body.style.overflow='hidden';modalRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
    const keyboard=(event:KeyboardEvent)=>{
      if(event.key==='Escape'&&!totpBusy.current){event.preventDefault();setShowTotpModal(false);}
      if(event.key!=='Tab')return;
      const items=Array.from(modalRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),a[href]')||[]).filter(item=>item.getClientRects().length);
      if(!items.length)return;
      const first=items[0],last=items.at(-1)!;
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
    };
    document.addEventListener('keydown',keyboard);
    return()=>{document.body.style.overflow=overflow;document.removeEventListener('keydown',keyboard);if(previous?.isConnected)previous.focus();};
  },[showTotpModal]);

  if (authError) return <div className="page-shell container" role="alert"><p>{authError}</p><button className="btn-primary" onClick={() => window.location.reload()}>重试连接</button></div>;

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
    <div
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column'
      }}
      className="admin-page-container"
    >
      <header className="admin-header" inert={showTotpModal}>
        <Link href="/" className="admin-brand">APEX <span>管理后台</span></Link>
        <div className="admin-header-actions"><span className="admin-access" data-verified={aalLevel==='aal2'}>{aalLevel==='aal2'?'已通过双重验证':'需要双重验证'}</span>
          {aalLevel!=='aal2'&&<button className="admin-button primary" onClick={()=>openTotpModal()}>TOTP 绑定 / 验证</button>}
          <Link href="/">返回网站 ↗</Link>
        </div>
      </header>
      <div className="admin-layout" inert={showTotpModal}>
        <aside className="admin-sidebar"><p>工作区</p><nav className="admin-tabs" aria-label="后台栏目" onKeyDown={onNavKey}>
          {adminTabs.map((tab,index)=><button key={tab.id} onClick={()=>selectTab(tab.id)} aria-pressed={currentTab===tab.id}><span aria-hidden="true">{String(index+1).padStart(2,'0')}</span>{tab.label}</button>)}
        </nav><div className="admin-account"><small>当前账号</small><span>{adminUser?.email||'管理员'}</span><Link href="/system">系统诊断 ↗</Link></div></aside>
        <div className="admin-workspace">
          <div className="admin-page-heading"><div><span className="admin-breadcrumb">管理后台 / {activeTab.short}</span><h1>{activeTab.label}</h1><p>{activeTab.description}</p></div>
            {aalLevel==='aal2'&&currentTab!=='ai'&&<div className="admin-refresh"><small aria-live="polite">{updatedAt[currentTab]?`最近读取 ${formatBeijingDisplay(updatedAt[currentTab]!)}`:'尚未读取数据'}</small><button className="admin-button" onClick={()=>loadData(currentTab)} disabled={loading}>{loading?'正在读取…':'刷新当前栏目'}</button></div>}
          </div>
          {aalLevel!=='aal2'&&<section className="admin-notice" role="status"><strong>TOTP 双重身份验证 (AAL2) 未就绪</strong><p>完成验证后可查看管理数据。此页面不会自动绑定验证器。</p><button className="admin-button" onClick={()=>openTotpModal()}>扫码绑定 / 验证</button></section>}
          {errorMsg&&<p role="alert" className="admin-notice error">{errorMsg}</p>}
          {aalLevel==='aal2'&&dataErrors[currentTab]&&currentTab!=='ai'&&<div role="alert" className="admin-notice error"><strong>{dataErrors[currentTab]}</strong>{hasCurrentData&&<p>保留上次成功读取的数据，以下内容可能不是最新状态。</p>}<button className="admin-button" onClick={()=>loadData(currentTab)} disabled={loading}>重试读取</button></div>}
          {aalLevel==='aal2'&&loading&&!hasCurrentData&&currentTab!=='ai'&&<div className="admin-panel admin-empty" role="status">正在读取{activeTab.short}数据…</div>}
          {aalLevel==='aal2'&&currentTab==='overview'&&overviewData&&<>
            <section className="admin-panel"><div className="admin-panel-heading"><h2>服务状态</h2><span className="admin-status" data-state={overviewData.health?.status||'unknown'}>{overviewData.health?.status==='healthy'?'服务全部正常':overviewData.health?.status==='offline'?'赛事数据不可用':overviewData.health?.status==='degraded'?'降级运行中':'状态未报告'}</span></div>
              <dl className="admin-facts"><div><dt>存储引擎</dt><dd>{overviewData.health?.storageProvider||'未报告'}</dd></div><div><dt>存储连接</dt><dd>{overviewData.health?.storageConnected===true?'本次读取成功':overviewData.health?.storageConnected===false?'本次读取失败':'未报告'}</dd></div><div><dt>F1 数据同步时间</dt><dd>{overviewData.f1?.lastSyncTime?formatBeijingDisplay(overviewData.f1.lastSyncTime):'暂无数据'}</dd></div><div><dt>上游同步</dt><dd>{overviewData.f1?.upstreamSyncSuccess===true?'上游数据对齐正常':overviewData.f1?.upstreamSyncSuccess===false?'最近同步已降级':'上游状态未报告'}</dd></div></dl>
              {overviewData.f1?.errorMessage&&<p className="admin-notice error" role="alert">数据告警：{overviewData.f1.errorMessage}</p>}
            </section>
            <section className="admin-panel"><div className="admin-panel-heading"><h2>当前部署版本</h2><Link href="/system">查看系统诊断 ↗</Link></div><dl className="admin-facts"><div><dt>Git SHA</dt><dd className="admin-mono">{overviewData.deployment?.buildId||'暂无数据'}</dd></div><div><dt>运行环境</dt><dd>{overviewData.deployment?.environment||'未报告'}{overviewData.deployment?.vercelEnv?` / ${overviewData.deployment.vercelEnv}`:''}</dd></div><div><dt>构建时间</dt><dd>{overviewData.deployment?.deployedAt?formatBeijingDisplay(overviewData.deployment.deployedAt):'未报告'}</dd></div></dl></section>
          </>}
          {aalLevel==='aal2'&&currentTab==='users'&&usersData&&<section className="admin-panel admin-users">
            <div className="admin-panel-heading"><h2>注册用户 <span className="admin-count">{usersData.total??'—'}</span></h2><span>当前载入 {usersData.users?.length||0} 位</span></div>
            <div className="admin-filter-bar"><label>搜索用户<input type="search" aria-label="搜索用户" value={userSearch} onChange={e=>setUserSearch(e.target.value)} placeholder="邮箱、名称或用户 ID"/></label><label>邮箱验证状态<select value={userVerification} onChange={e=>setUserVerification(e.target.value)}><option value="all">全部状态</option><option value="verified">已验证</option><option value="pending">待验证</option></select></label>{(userSearch||userVerification!=='all')&&<button className="admin-button" onClick={()=>{setUserSearch('');setUserVerification('all');}}>清除筛选</button>}</div>
            <div className="admin-table-scroll" role="region" aria-label="用户列表，可横向滚动" tabIndex={0}><table><caption className="sr-only">注册用户及账号状态</caption><thead><tr>{['用户','角色','邮箱验证','登录来源','注册时间','操作'].map(label=><th scope="col" key={label}>{label}</th>)}</tr></thead><tbody>{shownUsers.map(user=><tr key={user.id}><th scope="row"><strong>{user.displayName||user.email}</strong>{user.displayName&&<span>{user.email}</span>}<small className="admin-mono">{user.id}</small></th><td>{user.role||'未报告'}</td><td><span className="admin-status" data-state={user.isVerified?'healthy':'pending'}>{user.isVerified?'已验证':'待激活'}</span></td><td>{user.provider||'未报告'}</td><td className="admin-date">{formatBeijingDisplay(user.createdAt)}</td><td><button className="admin-button" onClick={()=>selectTab('ai',user.id)} aria-label={`查看 ${user.email} 的 AI 对话`}>查看 AI 对话</button></td></tr>)}{!shownUsers.length&&<tr><td colSpan={6} className="admin-empty">{usersData.users?.length?'没有符合筛选条件的用户':'暂无注册用户'}</td></tr>}</tbody></table></div>
            <div className="admin-pagination"><span>匹配 {filteredUsers.length} 位 · 第 {safeUserPage} / {userPages} 页</span><div><button className="admin-button" disabled={safeUserPage<=1} onClick={()=>setUserPage(safeUserPage-1)}>上一页</button><button className="admin-button" disabled={safeUserPage>=userPages} onClick={()=>setUserPage(safeUserPage+1)}>下一页</button></div></div>
          </section>}
          {aalLevel==='aal2'&&currentTab==='ai'&&<AdminAIMonitor data={aiData} loading={aiRefreshing||loading} error={aiMonitorError||dataErrors.ai||null} refresh={refreshAIMonitor} automatic={autoRefreshAI} setAutomatic={setAutoRefreshAI} users={usersData?.users} initialUserId={selectedAuditUserId} onUnauthorized={()=>{clearPrivateData();setAalLevel('aal1');setErrorMsg('管理权限或双重验证已失效，请重新验证身份');}}/>}
          {aalLevel==='aal2'&&currentTab==='f1'&&f1Data&&<section className="admin-panel"><div className="admin-panel-heading"><div><h2>F1 赛事数据管理与手动调度</h2><p>重新获取赛历和积分数据。不会触发独立比赛提醒。</p></div></div><dl className="admin-facts"><div><dt>当前赛季</dt><dd>{f1Data.season?`${f1Data.season} 赛季`:'未报告'}</dd></div><div><dt>积分榜截止状态</dt><dd>{f1Data.cutoffDesc||'待核实'}{f1Data.cutoffVerified?' · 已核实':''}</dd></div></dl><div className="admin-sync-action"><div><strong>手动同步</strong><p>建议仅在发现数据未更新时执行。同步结果会显示在此处。</p></div><button className="admin-button primary" onClick={handleTriggerF1Sync} disabled={syncing||cooldownSeconds>0}>{syncing?'正在同步中...':cooldownSeconds>0?`冷却中 (${cooldownSeconds}s)`:'立即手动同步'}</button></div>{syncResult&&<p role={syncResult.success?'status':'alert'} className={`admin-notice ${syncResult.success?'':'error'}`}>{syncResult.message}</p>}</section>}
        </div>
      </div>
      {/* TOTP 绑定与双重验证弹窗 (AAL2 提升) */}
      {showTotpModal && (
        <div ref={modalRef} role="dialog" aria-modal="true" aria-labelledby="admin-mfa-title" className="admin-mfa-overlay" style={{
          position: 'fixed',
          inset: 0,
          zIndex: 999,
          background: 'rgba(0, 0, 0, 0.85)',

          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}>
          <GlassCard style={{
            padding: '28px 24px',
            maxWidth: '440px',
            width: '100%',
            borderRadius: '24px',
            maxHeight: '90vh',
            overflowY: 'auto'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
              <div>
                <h3 id="admin-mfa-title" style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                  {enrollData?.verified ? 'TOTP 双重身份验证 (AAL2)' : '绑定 TOTP 双重验证器'}
                </h3>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px', lineHeight: 1.5 }}>
                  {enrollData?.verified
                    ? '请输入手机身份验证器中当前的 6 位动态验证码以解锁管理权限。'
                    : 'APEX Control 仅限专属管理员使用。请使用手机身份验证器扫描二维码完成绑定。'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowTotpModal(false)}
                aria-label="关闭双重验证" disabled={totpSubmitting}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  fontSize: '20px',
                  cursor: 'pointer',
                  padding: '4px',
                  lineHeight: 1
                }}
              >
                ✕
              </button>
            </div>

            {loadingEnroll ? (
              <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                <div style={{
                  width: '28px',
                  height: '28px',
                  border: '2px solid rgba(255, 69, 58, 0.3)',
                  borderTopColor: 'var(--accent-red)',
                  borderRadius: '50%',
                  margin: '0 auto 12px'
                }} />
                正在生成 TOTP 绑定因子与安全二维码...
              </div>
            ) : (
              <>
                {/* 错误提示 */}
                {totpError && (
                  <div style={{
                    background: 'rgba(255, 45, 32, 0.12)',
                    border: '1px solid rgba(255, 45, 32, 0.35)',
                    color: 'var(--accent-red)',
                    padding: '10px 14px',
                    borderRadius: '10px',
                    fontSize: '12px',
                    marginBottom: '16px',
                    lineHeight: 1.5
                  }}>
                    {totpError}
                  </div>
                )}

                {/* 未绑定状态：展示二维码、密钥及引导步骤 */}
                {!enrollData?.verified && enrollData?.enrolled && (
                  <div style={{ marginBottom: '20px' }}>
                    <div style={{
                      fontSize: '12px',
                      fontWeight: 600,
                      color: 'var(--text-primary)',
                      marginBottom: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}>
                      <span style={{
                        background: 'var(--accent-red)',
                        color: '#fff',
                        borderRadius: '50%',
                        width: '18px',
                        height: '18px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '11px',
                        fontWeight: 700
                      }}>1</span>
                      第一步：使用手机验证器扫码绑定
                    </div>

                    <div style={{
                      fontSize: '11px',
                      color: 'var(--text-muted)',
                      marginBottom: '12px',
                      lineHeight: 1.5
                    }}>
                      支持：Google Authenticator、微软身份验证器、微信小程序「腾讯身份验证器」或 iPhone「设置 ➔ 密码」。
                    </div>

                    {/* 二维码展示区 */}
                    {enrollData.qrCode && (
                      <div style={{ textAlign: 'center', marginBottom: '14px' }}>
                        <div style={{
                          background: '#ffffff',
                          padding: '12px',
                          borderRadius: '16px',
                          display: 'inline-block',
                          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)'
                        }}>
                          {renderTotpQr(enrollData.qrCode)}
                        </div>
                      </div>
                    )}

                    {/* 手动输入密钥卡片 */}
                    {enrollData.secret && (
                      <div style={{
                        background: 'rgba(255, 255, 255, 0.04)',
                        border: '1px solid var(--line-dark)',
                        borderRadius: '10px',
                        padding: '10px 12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '8px'
                      }}>
                        <div style={{ overflow: 'hidden' }}>
                          <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>无法扫码可手动输入密钥 (Base32)</div>
                          <div style={{
                            fontFamily: 'var(--font-mono)',
                            fontSize: '12px',
                            color: 'var(--text-primary)',
                            letterSpacing: '1px',
                            wordBreak: 'break-all',
                            userSelect: 'all',
                            marginTop: '2px'
                          }}>
                            {enrollData.secret}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            if (enrollData?.secret) {
                              navigator.clipboard.writeText(enrollData.secret);
                              setCopiedSecret(true);
                              setTimeout(() => setCopiedSecret(false), 2000);
                            }
                          }}
                          style={{
                            background: copiedSecret ? 'rgba(48, 209, 88, 0.2)' : 'rgba(255, 69, 58, 0.15)',
                            border: `1px solid ${copiedSecret ? 'rgba(48, 209, 88, 0.4)' : 'rgba(255, 69, 58, 0.3)'}`,
                            color: copiedSecret ? 'var(--status-good)' : 'var(--accent-red)',
                            borderRadius: '6px',
                            padding: '6px 10px',
                            fontSize: '11px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            flexShrink: 0
                          }}
                        >
                          {copiedSecret ? '已复制 ✓' : '复制密钥'}
                        </button>
                      </div>
                    )}

                    {/* 手机上一键打开 URI */}
                    {enrollData.uri && (
                      <div style={{ textAlign: 'center', marginTop: '10px' }}>
                        <a
                          href={enrollData.uri}
                          style={{
                            fontSize: '11px',
                            color: 'var(--accent-red)',
                            textDecoration: 'none',
                            opacity: 0.9
                          }}
                        >
                          在支持的手机验证器中直接打开 ↗
                        </a>
                      </div>
                    )}
                  </div>
                )}

                {/* 步骤 2：输入 6 位验证码 */}
                <form onSubmit={handleVerifyTotp} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}>
                    {!enrollData?.verified && (
                      <span style={{
                        background: 'var(--accent-red)',
                        color: '#fff',
                        borderRadius: '50%',
                        width: '18px',
                        height: '18px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '11px',
                        fontWeight: 700
                      }}>2</span>
                    )}
                    {enrollData?.verified ? '输入 6 位动态验证码' : '第二步：输入验证器中显示的 6 位动态验证码'}
                  </div>

                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    autoComplete="one-time-code"
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
                      color: 'var(--text-primary)',
                      fontSize: '24px',
                      letterSpacing: '8px',
                      textAlign: 'center',
                      fontFamily: 'var(--font-mono)',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />

                  <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
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
                      style={{ flex: 1.4 }}
                    >
                      {totpSubmitting ? '验证中...' : enrollData?.verified ? '确认授权' : '确认绑定并授权'}
                    </GlassButton>
                  </div>

                  {enrollData?.verified && <p style={{ textAlign: 'center', fontSize: '11px', color: 'var(--text-muted)' }}>暂不支持安全更换验证器，请保留并使用现有验证器。</p>}
                </form>
              </>
            )}
          </GlassCard>
        </div>
      )}

      <nav className="mobile-admin-bottom-nav" aria-label="后台移动导航" inert={showTotpModal} onKeyDown={onNavKey}>{adminTabs.map((tab,index)=><button key={tab.id} onClick={()=>selectTab(tab.id)} aria-pressed={currentTab===tab.id}><span aria-hidden="true">{String(index+1).padStart(2,'0')}</span>{tab.short}</button>)}</nav>
    </div>
  );
}
