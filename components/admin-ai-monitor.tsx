'use client';

import React, { useState, useEffect } from 'react';
import type { AdminAIMetrics } from '@/lib/admin/service';
import { formatBeijingDisplay } from '@/lib/f1/time';
import { AdminAIChatLogs } from './admin-ai-logs';

const labels = { success: '完成', error: '异常', timeout: '超时', cancelled: '用户取消' };

export function AdminAIMonitor({
  data,
  loading,
  error,
  refresh,
  automatic,
  setAutomatic,
  users,
  initialUserId,
  onUnauthorized
}: {
  data: AdminAIMetrics | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
  automatic: boolean;
  setAutomatic: (value: boolean) => void;
  users?: Array<{ id: string; email: string; displayName?: string }>;
  initialUserId?: string;
  onUnauthorized?:()=>void;
}) {
  const [viewMode, setViewMode] = useState<'logs' | 'metrics'>(initialUserId?'logs':'metrics');
  const [onlyErrors, setOnlyErrors] = useState(false);

  useEffect(() => {
    if (initialUserId) {
      setViewMode('logs');
    }
  }, [initialUserId]);
  useEffect(()=>{if(viewMode!=='metrics')setAutomatic(false);},[viewMode,setAutomatic]);

  const raw = data?.monitoring;
  const monitor = raw?.available && 'totals' in raw ? raw : null;
  const events = monitor?.events.filter(event => !onlyErrors || ['error', 'timeout'].includes(event.outcome)) || [];
  const maxDay = Math.max(1, ...(monitor?.days.map(day => day.total) || []));

  const exportMetrics = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `apex-ai-monitor-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="ai-monitor-panel">
      <nav className="admin-subnav" aria-label="AI 管理视图"><button type="button" onClick={()=>setViewMode('metrics')} aria-pressed={viewMode==='metrics'}>运行指标</button><button type="button" onClick={()=>setViewMode('logs')} aria-pressed={viewMode==='logs'}>对话记录</button></nav>
      {/* 视图一：AI 对话审计明细 (真实 IP、完整上下文、用户维度) */}
      {viewMode === 'logs' && (
        <AdminAIChatLogs users={users} initialUserId={initialUserId} onUnauthorized={onUnauthorized}/>
      )}

      {/* 视图二：运行指标大盘 */}
      {viewMode === 'metrics' && (
        <>
          <div className="monitor-heading">
            <div>
              <span className="eyebrow">AI 运行监控</span>
              <h2>运行指标</h2>
              <p>调用结果、耗时和用量；对话内容在「对话记录」中查询。</p>
            </div>
            <div className="monitor-actions">
              <label>
                <input type="checkbox" checked={automatic} onChange={e => setAutomatic(e.target.checked)} />
                每 30 秒刷新
              </label>
              <button className="btn-secondary" onClick={refresh} disabled={loading}>
                {loading ? '刷新中…' : '刷新 AI 数据'}
              </button>
              <button className="btn-secondary" onClick={exportMetrics} disabled={!data}>
                导出监控摘要
              </button>
            </div>
          </div>

          {error && <p className="monitor-alert" role="alert">{error}{data?'。当前展示上次成功读取的数据。':'。尚无可展示数据。'}</p>}
          {!data && <p className="empty-state">{loading ? '正在加载 AI 监控…' : '监控数据暂不可用，请刷新重试。'}</p>}

          {data && (
            <>
              <section className="monitor-config">
                <div>
                  <small>当前服务</small>
                  <strong>{data.provider} / {data.model || '—'}</strong>
                  <p>{data.isConfigured ? '服务凭据已配置' : '服务凭据未配置'} · 配置状态不代表实时可用性</p>
                </div>
                <div>
                  <small>审计持久化</small>
                  <strong>{data.historyStorageConfigured ? '持久存储已配置' : '持久存储未配置'}</strong>
                  <p>配置状态不代表本次读写已验证。</p>
                </div>
                <div>
                  <small>调用保护</small>
                  <strong>{data.limits?.hourly ?? 600} 次 / 小时</strong>
                  <p>单 IP {data.limits?.perMinute ?? 15} 次 / 分钟 · 超时 {data.limits?.requestTimeoutSeconds ?? 25} 秒</p>
                </div>
              </section>

              {!monitor && <p className="monitor-alert" role="status">监控明细暂不可用，不将缺失数据当作零故障。</p>}

              <section className="monitor-stats" aria-label="AI 运行指标">
                <div>
                  <small>累计有效提问</small>
                  <strong>{data.totalRequests ?? '—'}</strong>
                  <span>现有累计计数</span>
                </div>
                <div>
                  <small>限流拦截</small>
                  <strong>{data.rateLimitHits ?? '—'}</strong>
                  <span>未进入模型调用</span>
                </div>
                <div>
                  <small>Token 用量估算</small>
                  <strong>{data.estimatedTokens?.toLocaleString() ?? '—'}</strong>
                  <span>按字符估算，不是账单金额</span>
                </div>
                <div>
                  <small>对话完成率</small>
                  <strong>{monitor?.successRate != null ? `${monitor.successRate}%` : '—'}</strong>
                  <span>取消不计入分母，包含事实回退</span>
                </div>
                <div>
                  <small>平均请求耗时</small>
                  <strong>{monitor?.averageDurationMs != null ? `${(monitor.averageDurationMs / 1000).toFixed(2)}s` : '—'}</strong>
                  <span>已记录的请求</span>
                </div>
                <div>
                  <small>异常 / 超时</small>
                  <strong>{monitor ? `${monitor.totals.error} / ${monitor.totals.timeout}` : '—'}</strong>
                  <span>本版监控启用以来</span>
                </div>
              </section>

              {monitor && (
                <>
                  <section className="monitor-chart">
                    <div className="section-head">
                      <h3>近七日请求结果</h3>
                      <span className="data-note">北京时间 · 取消 {monitor.totals.cancelled} 次</span>
                    </div>
                    <div className="monitor-bars">
                      {monitor.days.map(day => (
                        <div key={day.day}>
                          <span className="mono">{day.total}</span>
                          <div className="monitor-bar-track">
                            <i style={{ height: `${(day.total / maxDay) * 100}%` }} aria-hidden="true" />
                          </div>
                          <small>{day.day.slice(5)}</small>
                        </div>
                      ))}
                    </div>
                    <details>
                      <summary>查看每日明细</summary>
                      <div className="monitor-table-wrap">
                        <table>
                          <caption className="sr-only">近七日 AI 请求结果</caption>
                          <thead>
                            <tr>
                              <th>日期</th>
                              <th>完成</th>
                              <th>异常</th>
                              <th>超时</th>
                              <th>取消</th>
                            </tr>
                          </thead>
                          <tbody>
                            {monitor.days.map(day => (
                              <tr key={day.day}>
                                <td>{day.day}</td>
                                <td>{day.success}</td>
                                <td>{day.error}</td>
                                <td>{day.timeout}</td>
                                <td>{day.cancelled}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </details>
                  </section>

                  <section className="monitor-events">
                    <div className="section-head">
                      <h3>最近请求记录</h3>
                      <label>
                        <input type="checkbox" checked={onlyErrors} onChange={e => setOnlyErrors(e.target.checked)} />
                        只看异常与超时
                      </label>
                    </div>
                    {!events.length ? (
                      <p className="data-note">{onlyErrors ? '最近记录中没有异常或超时。' : '尚无已记录的请求。'}</p>
                    ) : (
                      <ul>
                        {events.map((event, i) => (
                          <li key={`${event.at}-${i}`}>
                            <time>{formatBeijingDisplay(event.at)}</time>
                            <span className={`monitor-outcome outcome-${event.outcome}`}>{labels[event.outcome]}</span>
                            <span className="mono">{(event.durationMs / 1000).toFixed(2)}s</span>
                          </li>
                        ))}
                      </ul>
                    )}
                    <p className="data-note">只保留最近 30 条快速统计记录；如需查看完整对话与 IP 请切换至「对话审计明细」。</p>
                  </section>
                </>
              )}

              <p className="monitor-footnote">
                {monitor?.firstRecordedAt ? `明细统计始于 ${formatBeijingDisplay(monitor.firstRecordedAt)}。` : '明细从本版启用后开始记录，不补造历史结果。'}
                {monitor && !monitor.persistent ? ' 当前使用临时内存，跨实例及重启后可能不连续。' : ''} 最近提问：
                {data.lastActiveTime ? formatBeijingDisplay(data.lastActiveTime) : '暂无记录'}。本次读取：
                {raw?.checkedAt ? formatBeijingDisplay(raw.checkedAt) : '—'}。
              </p>
            </>
          )}
        </>
      )}
    </div>
  );
}
