'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { CircuitTrace } from '@/components/circuit-trace';
import { formatBeijingDisplay } from '@/lib/f1/time';
import type {
  DetailedRaceResultItem,
  DetailedQualifyingResultItem,
  DetailedSprintResultItem,
  F1Session,
} from '@/lib/f1/types';

export interface RaceDetailTabsProps {
  raceResults: DetailedRaceResultItem[];
  qualiResults: DetailedQualifyingResultItem[];
  sprintResults: DetailedSprintResultItem[];
  sessions: F1Session[];
  circuitId: string;
  season: string;
  meetingName: string;
  round: number;
  isHistorical: boolean;
}

type TabKey = 'race' | 'sprint' | 'qualifying' | 'schedule';

export function RaceDetailTabs({
  raceResults,
  qualiResults,
  sprintResults,
  sessions,
  circuitId,
  season,
  meetingName,
  round,
  isHistorical,
}: RaceDetailTabsProps) {
  const hasRaceResults = Boolean(raceResults && raceResults.length > 0);
  const hasSprintResults = Boolean(sprintResults && sprintResults.length > 0);
  const hasQualiResults = Boolean(qualiResults && qualiResults.length > 0);
  const hasSchedule = Boolean(!isHistorical && sessions && sessions.length > 0);

  const defaultTab: TabKey = hasRaceResults
    ? 'race'
    : hasSprintResults
    ? 'sprint'
    : hasQualiResults
    ? 'qualifying'
    : hasSchedule
    ? 'schedule'
    : 'qualifying';

  const [activeTab, setActiveTab] = useState<TabKey>(defaultTab);

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(`apex:race:${round}:${season}:tab`) as TabKey | null;
      if (
        saved &&
        ((saved === 'race' && hasRaceResults) ||
          (saved === 'sprint' && hasSprintResults) ||
          (saved === 'qualifying') ||
          (saved === 'schedule' && hasSchedule))
      ) {
        setActiveTab(saved);
      }
    } catch {}
  }, [round, season, hasRaceResults, hasSprintResults, hasSchedule]);

  const switchTab = (tab: TabKey) => {
    setActiveTab(tab);
    try {
      sessionStorage.setItem(`apex:race:${round}:${season}:tab`, tab);
    } catch {}
  };

  return (
    <>
      <nav className="section-jumps" role="tablist" aria-label="分站内容">
        {hasRaceResults && (
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'race'}
            className={activeTab === 'race' ? 'active' : ''}
            onClick={() => switchTab('race')}
          >
            正赛成绩 ({raceResults.length})
          </button>
        )}
        {hasSprintResults && (
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'sprint'}
            className={activeTab === 'sprint' ? 'active' : ''}
            onClick={() => switchTab('sprint')}
          >
            冲刺赛成绩 ({sprintResults.length})
          </button>
        )}
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'qualifying'}
          className={activeTab === 'qualifying' ? 'active' : ''}
          onClick={() => switchTab('qualifying')}
        >
          排位成绩 {hasQualiResults ? `(${qualiResults.length})` : ''}
        </button>
        {hasSchedule && (
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'schedule'}
            className={activeTab === 'schedule' ? 'active' : ''}
            onClick={() => switchTab('schedule')}
          >
            周末赛程 ({sessions.length})
          </button>
        )}
      </nav>

      {/* Tab Panel: 正赛 */}
      {activeTab === 'race' && hasRaceResults && (
        <div className="race-data-section">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '20px' }}>
            <h2>正赛成绩</h2>
            <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>共 {raceResults.length} 位完赛/退赛车手</span>
          </div>

          <div className="result-panel">
            <div style={{ minWidth: '720px' }}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '60px 2fr 2fr 70px 70px 140px 80px',
                  padding: '16px 24px',
                  background: 'rgba(255,255,255,0.03)',
                  borderBottom: '1px solid var(--line-dark)',
                  fontSize: '12px',
                  fontWeight: 700,
                  color: 'var(--text-muted)',
                }}
              >
                <span>名次</span>
                <span>车手</span>
                <span>车队</span>
                <span style={{ textAlign: 'center' }}>发车位</span>
                <span style={{ textAlign: 'center' }}>圈数</span>
                <span style={{ textAlign: 'right' }}>完赛成绩 / 状态</span>
                <span style={{ textAlign: 'right' }}>积分</span>
              </div>

              {raceResults.map((r, idx) => (
                <div
                  key={r.driverId || idx}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '60px 2fr 2fr 70px 70px 140px 80px',
                    padding: '16px 24px',
                    borderBottom: idx === raceResults.length - 1 ? 'none' : '1px solid var(--line-dark)',
                    alignItems: 'center',
                    background: idx === 0 ? 'rgba(255,45,32,0.04)' : 'transparent',
                  }}
                >
                  <span
                    className="tabular-nums"
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontWeight: 800,
                      fontSize: '15px',
                      color: idx === 0 ? 'var(--accent-red)' : 'inherit',
                    }}
                  >
                    {r.position || 'NC'}
                  </span>

                  <div>
                    <span style={{ fontWeight: 700, fontSize: '14px' }}>{r.driverName}</span>
                    {r.driverNumber && (
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '6px' }}>
                        #{r.driverNumber}
                      </span>
                    )}
                    {r.fastestLap?.rank === '1' && (
                      <span
                        className="badge-pill badge-red"
                        style={{ fontSize: '10px', marginLeft: '6px', padding: '2px 6px' }}
                      >
                        最快圈 {r.fastestLap.time}
                      </span>
                    )}
                  </div>

                  <div style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>{r.constructorName}</div>

                  <div
                    className="tabular-nums"
                    style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}
                  >
                    P{r.grid}
                  </div>

                  <div
                    className="tabular-nums"
                    style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '13px' }}
                  >
                    {r.laps}
                  </div>

                  <div
                    className="tabular-nums"
                    style={{ textAlign: 'right', color: 'var(--text-secondary)', fontSize: '13px' }}
                  >
                    {r.time || r.status}
                  </div>

                  <div
                    className="tabular-nums"
                    style={{
                      textAlign: 'right',
                      fontFamily: 'var(--font-mono)',
                      fontWeight: 800,
                      fontSize: '15px',
                      color: r.points > 0 ? 'var(--text-primary)' : 'var(--text-muted)',
                    }}
                  >
                    {r.points}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab Panel: 冲刺赛 */}
      {activeTab === 'sprint' && hasSprintResults && (
        <div className="race-data-section">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '20px' }}>
            <h2>冲刺赛成绩</h2>
            <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>冲刺赛前 8 名计入世界锦标赛积分</span>
          </div>

          <div className="result-panel">
            <div style={{ minWidth: '640px' }}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '60px 2.5fr 2.5fr 70px 140px 80px',
                  padding: '16px 24px',
                  background: 'rgba(255,255,255,0.03)',
                  borderBottom: '1px solid var(--line-dark)',
                  fontSize: '12px',
                  fontWeight: 700,
                  color: 'var(--text-muted)',
                }}
              >
                <span>名次</span>
                <span>车手</span>
                <span>车队</span>
                <span style={{ textAlign: 'center' }}>发车位</span>
                <span style={{ textAlign: 'right' }}>用时 / 状态</span>
                <span style={{ textAlign: 'right' }}>冲刺积分</span>
              </div>

              {sprintResults.map((s, idx) => (
                <div
                  key={s.driverId || idx}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '60px 2.5fr 2.5fr 70px 140px 80px',
                    padding: '16px 24px',
                    borderBottom: idx === sprintResults.length - 1 ? 'none' : '1px solid var(--line-dark)',
                    alignItems: 'center',
                  }}
                >
                  <span
                    className="tabular-nums"
                    style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: '15px' }}
                  >
                    {s.position}
                  </span>

                  <div style={{ fontWeight: 700, fontSize: '14px' }}>{s.driverName}</div>

                  <div style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>{s.constructorName}</div>

                  <div
                    className="tabular-nums"
                    style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}
                  >
                    P{s.grid}
                  </div>

                  <div
                    className="tabular-nums"
                    style={{ textAlign: 'right', color: 'var(--text-secondary)', fontSize: '13px' }}
                  >
                    {s.time || s.status}
                  </div>

                  <div
                    className="tabular-nums"
                    style={{
                      textAlign: 'right',
                      fontFamily: 'var(--font-mono)',
                      fontWeight: 800,
                      fontSize: '15px',
                      color: s.points > 0 ? 'var(--accent-red)' : 'var(--text-muted)',
                    }}
                  >
                    {s.points}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab Panel: 排位赛 */}
      {activeTab === 'qualifying' && (
        <div className="race-data-section">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '20px' }}>
            <h2>排位赛成绩</h2>
            <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              {hasQualiResults
                ? `杆位：${qualiResults[0]?.driverName} (${qualiResults[0]?.q3 || qualiResults[0]?.q2 || qualiResults[0]?.q1 || ''})`
                : '历史档案记录'}
            </span>
          </div>

          {hasQualiResults ? (
            <div className="result-panel">
              <div style={{ minWidth: '640px' }}>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '60px 2.2fr 2.2fr 100px 100px 100px',
                    padding: '16px 24px',
                    background: 'rgba(255,255,255,0.03)',
                    borderBottom: '1px solid var(--line-dark)',
                    fontSize: '12px',
                    fontWeight: 700,
                    color: 'var(--text-muted)',
                  }}
                >
                  <span>发车位</span>
                  <span>车手</span>
                  <span>车队</span>
                  <span style={{ textAlign: 'right' }}>Q1 圈速</span>
                  <span style={{ textAlign: 'right' }}>Q2 圈速</span>
                  <span style={{ textAlign: 'right' }}>Q3 杆位圈速</span>
                </div>

                {qualiResults.map((q, idx) => (
                  <div
                    key={q.driverId || idx}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '60px 2.2fr 2.2fr 100px 100px 100px',
                      padding: '16px 24px',
                      borderBottom: idx === qualiResults.length - 1 ? 'none' : '1px solid var(--line-dark)',
                      alignItems: 'center',
                      background: idx === 0 ? 'rgba(255,45,32,0.04)' : 'transparent',
                    }}
                  >
                    <span
                      className="tabular-nums"
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontWeight: 800,
                        fontSize: '15px',
                        color: idx === 0 ? 'var(--accent-red)' : 'inherit',
                      }}
                    >
                      P{q.position}
                    </span>

                    <div style={{ fontWeight: 700, fontSize: '14px' }}>{q.driverName}</div>

                    <div style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>{q.constructorName}</div>

                    <div
                      className="tabular-nums"
                      style={{ textAlign: 'right', color: 'var(--text-secondary)', fontSize: '13px' }}
                    >
                      {q.q1 || '-'}
                    </div>

                    <div
                      className="tabular-nums"
                      style={{ textAlign: 'right', color: 'var(--text-secondary)', fontSize: '13px' }}
                    >
                      {q.q2 || '-'}
                    </div>

                    <div
                      className="tabular-nums"
                      style={{
                        textAlign: 'right',
                        fontFamily: 'var(--font-mono)',
                        fontWeight: 700,
                        fontSize: '13px',
                        color: idx === 0 ? 'var(--accent-red)' : 'var(--text-primary)',
                      }}
                    >
                      {q.q3 || '-'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="race-empty-note race-preview">
              <div className="race-preview-map" aria-hidden="true">
                <CircuitTrace circuitId={circuitId} season={season} meetingName={meetingName} />
              </div>
              <div>
                <span className="eyebrow">{isHistorical ? '赛事档案' : '节次预告'}</span>
                <h3>{isHistorical ? '详细排位成绩尚未收录' : '等待排位成绩'}</h3>
                <p>
                  {isHistorical
                    ? '当前档案暂未提供详细圈速，不推测缺失成绩。'
                    : '成绩以实际发布为准，计划时间不代表赛事已结束。'}
                </p>
                {sessions.find((s) => s.type === 'qualifying') && (
                  <time dateTime={sessions.find((s) => s.type === 'qualifying')!.startTimeUTC}>
                    北京时间 · {formatBeijingDisplay(sessions.find((s) => s.type === 'qualifying')!.startTimeUTC)}
                  </time>
                )}
                <Link className="text-link" href={`/live?season=${season}&round=${round}`}>
                  查看节次状态 ↗
                </Link>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab Panel: 周末赛程 */}
      {activeTab === 'schedule' && hasSchedule && (
        <div className="race-data-section">
          <h2>周末时间表 · 北京时间</h2>
          <div className="detail-schedule">
            {sessions.map((s, idx) => (
              <div key={s.id || idx} className="detail-session">
                <div>
                  <div style={{ fontSize: '17px', fontWeight: 700, marginTop: '2px' }}>{s.name}</div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div
                    className="tabular-nums"
                    style={{ fontFamily: 'var(--font-mono)', fontSize: '16px', fontWeight: 700 }}
                  >
                    {formatBeijingDisplay(s.startTimeUTC)}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    预计 {s.durationMinutes} 分钟
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
