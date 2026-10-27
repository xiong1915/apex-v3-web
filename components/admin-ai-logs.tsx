'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
}

export function AdminAIChatLogs({ users = [], initialUserId }: AdminAIChatLogsProps) {
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
    setLoading(true);
    setError(null);
    try {
      const url = new URL('/api/admin/ai/logs', window.location.origin);
      if (userId && userId.trim()) {
        url.searchParams.set('userId', userId.trim());
      }
      url.searchParams.set('limit', '100');

      const res = await fetch(url.toString(), { cache: 'no-store' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setLogs(Array.isArray(data.logs) ? data.logs : []);
      setTotal(typeof data.total === 'number' ? data.total : (data.logs?.length || 0));
    } catch (err: any) {
      console.error('[Admin AI Logs] Fetch error:', err);
      setError(err.message || '读取 AI 对话审计记录失败');
    } finally {
      setLoading(false);
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

  const handleCopyJson = (log: AIChatLogRecord) => {
    try {
      navigator.clipboard.writeText(JSON.stringify(log, null, 2));
      setCopiedId(log.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (_) {}
  };

  const handleCopyUa = (ua?: string, id?: string) => {
    if (!ua || !id) return;
    try {
      navigator.clipboard.writeText(ua);
      setCopiedUaId(id);
      setTimeout(() => setCopiedUaId(null), 2000);
    } catch (_) {}
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* 顶部控制栏 */}
      <div style={{
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
              AI CONVERSATION & USER PERSONA AUDIT
            </span>
            <h3 style={{ fontSize: '20px', fontWeight: 800, margin: '4px 0 0', color: 'var(--text-primary)' }}>
              对话审计与详细记录
            </h3>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '4px 0 0' }}>
              完整记录每位用户的对话内容、客户端真实 IP、操作系统、浏览器、屏幕配置与硬件画像。
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
              <option value="">全部用户 (全站所有用户)</option>
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
              placeholder="搜索客户端 IP / 浏览器 / 操作系统 / 邮箱 / 提问内容关键字..."
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
        <div style={{
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
          const outcomeInfo = outcomeLabels[log.outcome] || outcomeLabels.success;
          const isExpanded = expandedId === log.id;
          const lastUserMessage = [...log.messages].reverse().find(m => m.role === 'user')?.content || '无消息输入';
          const persona = parseUserPersona(log.userAgent, log.deviceInfo as any, log.clientIp);

          return (
            <div
              key={log.id}
              style={{
                background: '#fff',
                borderRadius: '18px',
                border: '1px solid var(--line-dark)',
                padding: '20px 22px',
                boxShadow: isExpanded ? '0 6px 24px rgba(0,0,0,0.06)' : 'none',
                transition: 'all 0.2s ease'
              }}
            >
              {/* 卡片头部核心元数据 */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '12px',
                borderBottom: '1px solid rgba(23, 25, 29, 0.06)',
                paddingBottom: '12px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  {/* 时间戳 */}
                  <time style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                    {formatBeijingDisplay(log.createdAt)}
                  </time>

                  {/* 状态徽章 */}
                  <span style={{
                    padding: '2px 8px',
                    borderRadius: '999px',
                    fontSize: '11px',
                    fontWeight: 700,
                    background: outcomeInfo.bg,
                    color: outcomeInfo.color,
                    border: `1px solid ${outcomeInfo.border}`
                  }}>
                    {outcomeInfo.label}
                  </span>

                  {/* 真实 IP 地址 (醒目高亮) */}
                  <span style={{
                    fontSize: '12px',
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 800,
                    padding: '3px 9px',
                    borderRadius: '8px',
                    background: 'rgba(225, 6, 0, 0.08)',
                    color: 'var(--accent-red)',
                    border: '1px solid rgba(225, 6, 0, 0.25)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}>
                    <span style={{ fontSize: '10px', opacity: 0.8 }}>IP</span>
                    {log.clientIp}
                  </span>

                  {/* 用户画像轻量标签：操作系统 */}
                  <span style={{
                    fontSize: '11px',
                    fontFamily: 'var(--font-sans)',
                    background: '#f4f3ef',
                    padding: '3px 8px',
                    borderRadius: '6px',
                    color: 'var(--text-primary)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    border: '1px solid rgba(0,0,0,0.04)'
                  }}>
                    <span>{persona.os.icon}</span>
                    <strong style={{ fontWeight: 600 }}>{persona.os.name}</strong>
                    {persona.os.architecture && <small style={{ color: 'var(--text-secondary)', fontSize: '10px' }}>({persona.os.architecture})</small>}
                  </span>

                  {/* 用户画像轻量标签：浏览器 */}
                  <span style={{
                    fontSize: '11px',
                    fontFamily: 'var(--font-sans)',
                    background: '#f4f3ef',
                    padding: '3px 8px',
                    borderRadius: '6px',
                    color: 'var(--text-primary)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    border: '1px solid rgba(0,0,0,0.04)'
                  }}>
                    <span>{persona.browser.icon}</span>
                    <strong style={{ fontWeight: 600 }}>{persona.browser.name}</strong>
                    {persona.browser.version && <small style={{ color: 'var(--text-secondary)', fontSize: '10px' }}>v{persona.browser.version}</small>}
                  </span>

                  {/* 用户画像轻量标签：设备类型 */}
                  <span style={{
                    fontSize: '11px',
                    background: '#f4f3ef',
                    padding: '3px 8px',
                    borderRadius: '6px',
                    color: 'var(--text-secondary)'
                  }}>
                    {persona.device.typeLabel}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  {/* 耗时与 Token */}
                  <span style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                    ⏱️ {(log.durationMs / 1000).toFixed(2)}s
                  </span>
                  <span style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                    🪙 {log.tokensEstimated} tokens
                  </span>

                  {/* 展开/折叠操作 */}
                  <button
                    onClick={() => toggleExpand(log.id)}
                    style={{
                      border: 'none',
                      background: 'none',
                      color: 'var(--accent-red)',
                      cursor: 'pointer',
                      fontSize: '12px',
                      fontWeight: 700,
                      padding: '4px 6px'
                    }}
                  >
                    {isExpanded ? '收起画像与详情 ▲' : '展开画像与详情 ▼'}
                  </button>
                </div>
              </div>

              {/* 用户信息栏 */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '10px 0 8px',
                fontSize: '12px',
                flexWrap: 'wrap',
                gap: '8px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{
                    width: '26px',
                    height: '26px',
                    borderRadius: '50%',
                    background: 'var(--accent-red)',
                    color: '#fff',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '12px',
                    fontWeight: 700
                  }}>
                    {(log.userDisplayName || log.userEmail)[0].toUpperCase()}
                  </span>
                  <strong style={{ fontSize: '13px', color: 'var(--text-primary)' }}>
                    {log.userDisplayName || log.userEmail.split('@')[0]}
                  </strong>
                  <span style={{ color: 'var(--text-secondary)' }}>({log.userEmail})</span>
                  <code style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                    UID: {log.userId}
                  </code>
                </div>

                {selectedUserId !== log.userId && (
                  <button
                    onClick={() => setSelectedUserId(log.userId)}
                    style={{
                      border: '1px solid var(--line-dark)',
                      background: '#faf9f5',
                      color: 'var(--text-secondary)',
                      padding: '3px 8px',
                      borderRadius: '6px',
                      fontSize: '11px',
                      cursor: 'pointer'
                    }}
                    title="仅筛选查看此用户的全部对话"
                  >
                    仅看此用户
                  </button>
                )}
              </div>

              {/* 折叠时摘要预览 */}
              {!isExpanded && (
                <div style={{ marginTop: '4px' }}>
                  <div style={{
                    fontSize: '13px',
                    color: 'var(--text-primary)',
                    background: '#f8f8f7',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    lineHeight: 1.5
                  }}>
                    <span style={{ color: 'var(--text-muted)', fontWeight: 600, marginRight: '6px' }}>Q:</span>
                    {lastUserMessage.length > 120 ? `${lastUserMessage.slice(0, 120)}…` : lastUserMessage}
                  </div>
                  {log.response && (
                    <div style={{
                      fontSize: '12px',
                      color: 'var(--text-secondary)',
                      marginTop: '6px',
                      paddingLeft: '4px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>
                      <span style={{ color: 'var(--accent-red)', fontWeight: 600, marginRight: '6px' }}>A:</span>
                      {log.response.replace(/\n+/g, ' ')}
                    </div>
                  )}
                </div>
              )}

              {/* 展开时的完整用户画像、硬件信号与对话明细 */}
              {isExpanded && (
                <div style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {/* 用户画像与设备规格矩阵 */}
                  <div style={{
                    background: '#faf9f5',
                    borderRadius: '14px',
                    border: '1px solid var(--line-dark)',
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--accent-red)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                        👤 终端用户画像与硬件规格信号
                      </span>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        识别自客户端与 HTTP 报头
                      </span>
                    </div>

                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                      gap: '12px'
                    }}>
                      {/* 画像 1: 操作系统 */}
                      <div style={{ background: '#fff', padding: '12px 14px', borderRadius: '10px', border: '1px solid rgba(0,0,0,0.05)' }}>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>操作系统 (OS)</div>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span>{persona.os.icon}</span>
                          <span>{persona.os.name}</span>
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                          {persona.os.architecture || '默认架构'}{persona.os.version ? ` · v${persona.os.version}` : ''}
                        </div>
                      </div>

                      {/* 画像 2: 浏览器与内核 */}
                      <div style={{ background: '#fff', padding: '12px 14px', borderRadius: '10px', border: '1px solid rgba(0,0,0,0.05)' }}>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>浏览器与排版引擎</div>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span>{persona.browser.icon}</span>
                          <span>{persona.browser.name}</span>
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                          {persona.browser.version ? `版本: ${persona.browser.version}` : '内核'}: {persona.browser.engine}
                        </div>
                      </div>

                      {/* 画像 3: 设备形态与机型 */}
                      <div style={{ background: '#fff', padding: '12px 14px', borderRadius: '10px', border: '1px solid rgba(0,0,0,0.05)' }}>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>设备形态</div>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
                          {persona.device.typeLabel}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                          {persona.device.model || '标准个人计算机'}
                        </div>
                      </div>

                      {/* 画像 4: 硬件配置信号 */}
                      <div style={{ background: '#fff', padding: '12px 14px', borderRadius: '10px', border: '1px solid rgba(0,0,0,0.05)' }}>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>硬件配置与算力信号</div>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
                          ⚙️ {persona.hardware.cores ? `${persona.hardware.cores}核 CPU` : '常规硬件配置'} {persona.hardware.memoryGb ? `· ≥${persona.hardware.memoryGb}GB 内存` : ''}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                          {persona.hardware.touchLabel}
                        </div>
                      </div>

                      {/* 画像 5: 屏幕分辨率与显示 */}
                      <div style={{ background: '#fff', padding: '12px 14px', borderRadius: '10px', border: '1px solid rgba(0,0,0,0.05)' }}>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>屏幕与显示信号</div>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
                          🖥️ {persona.display.screenResolution || '自适应分辨率'}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                          {persona.display.viewport ? `视口: ${persona.display.viewport}` : ''} {persona.display.pixelRatio ? `· DPR: ${persona.display.pixelRatio}x` : ''} {persona.display.colorScheme ? `· ${persona.display.colorScheme === 'dark' ? '🌙 深色' : '☀️ 浅色'}` : ''}
                        </div>
                      </div>

                      {/* 画像 6: 网络与语言环境 */}
                      <div style={{ background: '#fff', padding: '12px 14px', borderRadius: '10px', border: '1px solid rgba(0,0,0,0.05)' }}>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>网络与本地化环境</div>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                          🌐 {log.clientIp}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                          {persona.environment.country ? `地区: ${persona.environment.country} · ` : ''}{persona.environment.language || '中文简体 (zh-CN)'}
                        </div>
                      </div>
                    </div>

                    {/* 原始 User-Agent */}
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      background: '#f0efe9',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      fontSize: '11px',
                      fontFamily: 'var(--font-mono)',
                      color: 'var(--text-secondary)',
                      wordBreak: 'break-all',
                      gap: '8px'
                    }}>
                      <div style={{ flex: 1 }}>
                        <strong style={{ color: 'var(--text-primary)' }}>UA: </strong>
                        {log.userAgent || '未知客户端'}
                      </div>
                      <button
                        onClick={() => handleCopyUa(log.userAgent, log.id)}
                        style={{
                          border: 'none',
                          background: '#fff',
                          padding: '3px 8px',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '10px',
                          whiteSpace: 'nowrap',
                          color: 'var(--text-primary)',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.06)'
                        }}
                      >
                        {copiedUaId === log.id ? '✓ 已复制' : '复制 UA'}
                      </button>
                    </div>
                  </div>

                  {/* 消息对话流 */}
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    background: '#faf9f5',
                    padding: '16px',
                    borderRadius: '14px',
                    border: '1px solid var(--line-dark)'
                  }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                      完整对话上下文 ({log.messages.length} 轮消息)
                    </div>

                    {log.messages.map((msg, index) => {
                      const isUser = msg.role === 'user';
                      return (
                        <div
                          key={index}
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '4px',
                            background: isUser ? '#fff' : 'rgba(255, 45, 32, 0.04)',
                            border: isUser ? '1px solid var(--line-dark)' : '1px solid rgba(225, 6, 0, 0.15)',
                            borderLeft: isUser ? '3px solid var(--text-secondary)' : '3px solid var(--accent-red)',
                            borderRadius: '8px',
                            padding: '12px 14px'
                          }}
                        >
                          <div style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            color: isUser ? 'var(--text-secondary)' : 'var(--accent-red)',
                            display: 'flex',
                            justifyContent: 'space-between'
                          }}>
                            <span>{isUser ? '👤 用户' : '🤖 APEX AI'}</span>
                            <span style={{ fontFamily: 'var(--font-mono)', opacity: 0.6 }}>#{index + 1}</span>
                          </div>
                          <div style={{
                            fontSize: '13px',
                            lineHeight: 1.6,
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word',
                            color: 'var(--text-primary)'
                          }}>
                            {msg.content}
                          </div>
                        </div>
                      );
                    })}

                    {/* 本次生成的最终 AI 回答 (如果尚未在 messages 数组中) */}
                    {log.response && log.messages[log.messages.length - 1]?.content !== log.response && (
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '4px',
                          background: 'rgba(225, 6, 0, 0.04)',
                          border: '1px solid rgba(225, 6, 0, 0.2)',
                          borderLeft: '4px solid var(--accent-red)',
                          borderRadius: '8px',
                          padding: '12px 14px'
                        }}
                      >
                        <div style={{
                          fontSize: '11px',
                          fontWeight: 800,
                          color: 'var(--accent-red)',
                          display: 'flex',
                          justifyContent: 'space-between'
                        }}>
                          <span>🤖 APEX AI 最终输出</span>
                          <span style={{ fontFamily: 'var(--font-mono)', opacity: 0.8 }}>RESPONSE</span>
                        </div>
                        <div style={{
                          fontSize: '13px',
                          lineHeight: 1.6,
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word',
                          color: 'var(--text-primary)'
                        }}>
                          {log.response}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 底部操作条 */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                    <button
                      onClick={() => handleCopyJson(log)}
                      className="btn-secondary"
                      style={{ padding: '6px 14px', fontSize: '11px', borderRadius: '8px' }}
                    >
                      {copiedId === log.id ? '✓ 已复制 JSON' : '复制此条完整 JSON'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
