'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { formatBeijingDisplay } from '@/lib/f1/time';
import type { AIChatLogRecord } from '@/lib/admin/ai-chat-logs';
import { parseUserPersona } from '@/lib/admin/user-persona';

const outcomeLabels: Record<string, { label: string; bg: string; color: string; border: string }> = {
  success: { label: '完成', bg: '#eff6f1', color: '#28764e', border: 'rgba(40, 118, 78, 0.25)' },
  error: { label: '异常', bg: '#fff0ee', color: '#a3231f', border: 'rgba(163, 35, 31, 0.25)' },
  timeout: { label: '超时', bg: '#fff9e6', color: '#b25e00', border: 'rgba(178, 94, 0, 0.25)' },
  cancelled: { label: '用户取消', bg: '#f4f3ef', color: '#62656d', border: 'rgba(98, 101, 109, 0.25)' }
};

export interface AdminAIChatLogsProps {
  users?: Array<{ id: string; email: string; displayName?: string }>;
  initialUserId?: string;
  onUnauthorized?:()=>void;
}

export function AdminAIChatLogs({ users = [], initialUserId, onUnauthorized }: AdminAIChatLogsProps) {
  const requestSequence=useRef(0),controller=useRef<AbortController|null>(null),requestedUser=useRef<string|null>(null);
  const permissionError=useRef(onUnauthorized);permissionError.current=onUnauthorized;
  useEffect(()=>()=>{requestSequence.current++;controller.current?.abort();},[]);
  const [logs, setLogs] = useState<AIChatLogRecord[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedUserId, setSelectedUserId] = useState<string>(initialUserId || '');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedUaId, setCopiedUaId] = useState<string | null>(null);

  // 当外部传入的 initialUserId 发生变化时同步
  useEffect(() => {
    if (initialUserId !== undefined) {
      setSelectedUserId(initialUserId);
    }
  }, [initialUserId]);

  const loadLogs = useCallback(async (userId?: string) => {
    const sequence=++requestSequence.current;controller.current?.abort();
    const current=new AbortController();controller.current=current;
    const userKey=(userId||'').trim();
    if(requestedUser.current!==userKey){setLogs([]);setTotal(0);setExpandedId(null);requestedUser.current=userKey;}
    setLoading(true);
    setError(null);
    try {
      const url = new URL('/api/admin/ai/logs', window.location.origin);
      if (userId && userId.trim()) {
        url.searchParams.set('userId', userId.trim());
      }
      url.searchParams.set('limit', '100');

      const res = await fetch(url.toString(), { cache: 'no-store',signal:current.signal });
      if(sequence!==requestSequence.current)return;
      if(res.status===401||res.status===403){setLogs([]);setTotal(0);permissionError.current?.();throw Error('管理权限已失效，请重新验证身份');}
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      if(sequence!==requestSequence.current)return;
      setLogs(Array.isArray(data.logs) ? data.logs : []);
      setTotal(typeof data.total === 'number' ? data.total : (data.logs?.length || 0));
    } catch (err: any) {
      if(sequence===requestSequence.current&&!current.signal.aborted)setError(err.message || '读取 AI 对话审计记录失败');
    } finally {
      if(sequence===requestSequence.current)setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLogs(selectedUserId);
  }, [selectedUserId, loadLogs]);

  // 从已有日志中提取去重用户列表（弥补 users 尚未加载完全的情况）
  const userOptions = useMemo(() => {
    const map = new Map<string, { id: string; email: string; displayName?: string }>();
    users.forEach(u => map.set(u.id, u));
    logs.forEach(l => {
      if (!map.has(l.userId)) {
        map.set(l.userId, {
          id: l.userId,
          email: l.userEmail,
          displayName: l.userDisplayName
        });
      }
    });
    return Array.from(map.values());
  }, [users, logs]);

  // 客户端检索过滤 (按 IP、邮箱、提问内容、回答、操作系统、浏览器等)
  const filteredLogs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return logs;
    return logs.filter(log => {
      if (log.clientIp.toLowerCase().includes(q)) return true;
      if (log.userEmail.toLowerCase().includes(q)) return true;
      if (log.userDisplayName?.toLowerCase().includes(q)) return true;
      if (log.userId.toLowerCase().includes(q)) return true;
      if (log.model.toLowerCase().includes(q)) return true;
      if (log.response.toLowerCase().includes(q)) return true;
      if (log.userAgent?.toLowerCase().includes(q)) return true;
      if (log.messages.some(m => m.content?.toLowerCase().includes(q))) return true;
      return false;
    });
  }, [logs, searchQuery]);

  const toggleExpand = (id: string) => {
    setExpandedId(prev => (prev === id ? null : id));
  };

  const handleCopyJson = async (log: AIChatLogRecord) => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(log, null, 2));
      setCopiedId(log.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (_) {setError('复制失败，请手动选择需要的内容。');}
  };

  const handleCopyUa = async (ua?: string, id?: string) => {
    if (!ua || !id) return;
    try {
      await navigator.clipboard.writeText(ua);
      setCopiedUaId(id);
      setTimeout(() => setCopiedUaId(null), 2000);
    } catch (_) {setError('复制失败，请手动选择需要的内容。');}
  };

  return (
    <div className="admin-audit" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* 顶部控制栏 */}
      <div className="audit-toolbar" style={{
        background: '#fff',
        borderRadius: '20px',
        padding: '20px 24px',
        border: '1px solid var(--line-dark)',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--accent-red)', fontWeight: 700 }}>
              AI 请求记录
            </span>
            <h3 style={{ fontSize: '20px', fontWeight: 800, margin: '4px 0 0', color: 'var(--text-primary)' }}>
              对话记录
            </h3>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '4px 0 0' }}>
              按用户或关键词筛选。设备信息为客户端上报或解析结果，仅供排查参考。
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{
              fontSize: '12px',
              fontFamily: 'var(--font-mono)',
              background: '#f4f3ef',
              padding: '6px 12px',
              borderRadius: '999px',
              color: 'var(--text-secondary)'
            }}>
              已载入 {filteredLogs.length} 条 / 数据库共 {total} 条
            </span>
            <button
              onClick={() => loadLogs(selectedUserId)}
              disabled={loading}
              className="btn-secondary"
              style={{ padding: '8px 16px', fontSize: '12px', borderRadius: '10px' }}
            >
              {loading ? '载入中…' : '刷新记录'}
            </button>
          </div>
        </div>

        {/* 筛选与搜索输入区 */}
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
          {/* 用户筛选下拉框 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '240px', flex: '1 1 240px' }}>
            <label htmlFor="user-select-filter" style={{ fontSize: '12px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
              目标用户:
            </label>
            <select
              id="user-select-filter"
              value={selectedUserId}
              onChange={e => setSelectedUserId(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '10px',
                border: '1px solid var(--line-dark)',
                fontSize: '12px',
                background: '#faf9f5',
                color: 'var(--text-primary)',
                outline: 'none'
              }}
            >
              <option value="">全部用户</option>
              {userOptions.map(u => (
                <option key={u.id} value={u.id}>
                  {u.displayName ? `${u.displayName} (${u.email})` : u.email}
                </option>
              ))}
            </select>
          </div>

          {/* 实时搜索框 */}
          <div style={{ flex: '2 1 300px' }}>
            <input
              type="text"
              aria-label="搜索对话记录" placeholder="搜索邮箱、IP 或对话关键词"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 14px',
                borderRadius: '10px',
                border: '1px solid var(--line-dark)',
                fontSize: '12px',
                background: '#faf9f5',
                color: 'var(--text-primary)',
                outline: 'none'
              }}
            />
          </div>

          {/* 清除筛选快捷按钮 */}
          {(selectedUserId || searchQuery) && (
            <button
              onClick={() => { setSelectedUserId(''); setSearchQuery(''); }}
              style={{
                border: 'none',
                background: 'transparent',
                color: 'var(--accent-red)',
                fontSize: '12px',
                cursor: 'pointer',
                padding: '4px 8px',
                textDecoration: 'underline'
              }}
            >
              重置筛选
            </button>
          )}
        </div>
      </div>

      {/* 报错提示 */}
      {error && (
        <div role="alert" style={{
          padding: '14px 18px',
          borderRadius: '12px',
          background: '#fff0ee',
          border: '1px solid rgba(163, 35, 31, 0.3)',
          color: '#a3231f',
          fontSize: '13px'
        }}>
          {error}
        </div>
      )}

      {/* 列表区 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {loading && logs.length === 0 && (
          <div style={{
            background: '#fff',
            borderRadius: '16px',
            padding: '36px',
            textAlign: 'center',
            color: 'var(--text-muted)',
            fontSize: '13px',
            border: '1px solid var(--line-dark)'
          }}>
            正在读取 AI 对话审计记录…
          </div>
        )}

        {!loading && filteredLogs.length === 0 && (
          <div style={{
            background: '#fff',
            borderRadius: '16px',
            padding: '36px',
            textAlign: 'center',
            color: 'var(--text-muted)',
            fontSize: '13px',
            border: '1px solid var(--line-dark)'
          }}>
            {selectedUserId ? '该用户暂无已记录的 AI 对话' : searchQuery ? '没有找到符合搜索条件的对话记录' : '暂无 AI 对话记录'}
          </div>
        )}

        {filteredLogs.map(log => {
          const outcomeInfo = outcomeLabels[log.outcome];
          const isExpanded = expandedId === log.id;
          const lastUserMessage = [...log.messages].reverse().find(m => m.role === 'user')?.content || '无消息输入';
          const persona = parseUserPersona(log.userAgent, log.deviceInfo as any, log.clientIp);

          return (
            <article key={log.id} className="audit-record">
              <header className="audit-record-heading"><time>{formatBeijingDisplay(log.createdAt)}</time><span className="admin-status" data-outcome={log.outcome}>{outcomeInfo?.label||'未报告'}</span><button className="admin-button" onClick={()=>toggleExpand(log.id)} aria-expanded={isExpanded} aria-controls={`audit-details-${log.id}`}>{isExpanded?'收起详情 ▲':'展开详情 ▼'}</button></header>
              <div className="audit-identity"><strong>{log.userDisplayName||log.userEmail}</strong><span>{log.userEmail}</span>{selectedUserId!==log.userId&&<button className="admin-button" onClick={()=>setSelectedUserId(log.userId)}>仅看此用户</button>}</div>
              <p className="audit-meta"><span>IP {log.clientIp}</span><span>{persona.browser.name}</span><span>{(log.durationMs/1000).toFixed(2)} 秒</span><span>估算 {log.tokensEstimated} tokens</span></p>
              {!isExpanded&&<div className="audit-preview"><p><span>提问</span>{lastUserMessage}</p>{log.response&&<p><span>回答</span>{log.response.replace(/\n+/g,' ')}</p>}</div>}
              {isExpanded&&<div id={`audit-details-${log.id}`} className="audit-details">
                <section><h4>客户端信息</h4><p className="audit-note">来自请求报头与客户端上报，仅供故障排查参考。</p><dl className="admin-facts">
                  <div><dt>用户 ID</dt><dd className="admin-mono">{log.userId}</dd></div>
                  <div><dt>操作系统</dt><dd>{persona.os.name}{persona.os.version?` / ${persona.os.version}`:''}{persona.os.architecture?` / ${persona.os.architecture}`:''}</dd></div>
                  <div><dt>浏览器</dt><dd>{persona.browser.name} {persona.browser.version||''} / {persona.browser.engine||'内核未报告'}</dd></div>
                  <div><dt>设备</dt><dd>{persona.device.typeLabel.replace(/^[^\p{L}\p{N}]+/u,'')} / {persona.device.model||'机型未报告'}</dd></div>
                  <div><dt>硬件上报</dt><dd>{persona.hardware.cores?`${persona.hardware.cores} 逻辑核心`:'核心数未报告'} · {persona.hardware.memoryGb?`${persona.hardware.memoryGb} GB 内存估值`:'内存未报告'}<small>{persona.hardware.touchLabel}</small></dd></div>
                  <div><dt>显示信息</dt><dd>{persona.display.screenResolution||'屏幕尺寸未报告'}<small>视口 {persona.display.viewport||'未报告'} · 像素比 {persona.display.pixelRatio||'未报告'} · {persona.display.colorScheme||'配色未报告'}</small></dd></div>
                  <div><dt>网络与语言</dt><dd>{log.clientIp} · {persona.environment.country||'地区未报告'} · {persona.environment.language||'语言未报告'}</dd></div>
                </dl><div className="audit-ua"><code>{log.userAgent||'User-Agent 未报告'}</code><button className="admin-button" disabled={!log.userAgent} onClick={()=>handleCopyUa(log.userAgent,log.id)}>{copiedUaId===log.id?'已复制 UA':'复制 UA'}</button></div></section>
                <section><h4>对话上下文 · {log.messages.length} 条消息</h4>{log.messages.map((message,index)=><div className="audit-message" key={index}><small>{message.role==='user'?'用户':message.role==='assistant'?'AI':'系统'} · {index+1}</small><p>{message.content}</p></div>)}
                  {log.response&&log.messages.at(-1)?.content!==log.response&&<div className="audit-message" data-response="true"><small>本次 AI 回答</small><p>{log.response}</p></div>}
                </section><div className="audit-export"><button className="admin-button" onClick={()=>handleCopyJson(log)}>{copiedId===log.id?'已复制 JSON':'复制此条完整 JSON'}</button></div>
              </div>}
            </article>
          );
        })}
      </div>
    </div>
  );
}
