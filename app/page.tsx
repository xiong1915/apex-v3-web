// app/page.tsx
import React from 'react';
import Link from 'next/link';
import { defaultF1Service } from '@/providers/f1/service';
import { CircuitVisual } from '@/components/circuit_visual';
import { Countdown } from '@/components/countdown';
import { AISearchBox } from '@/components/ai_search_box';
import { LazySimulator } from '@/components/lazy_simulator';
import { AutoRefresher } from '@/components/auto_refresher';
import { formatBeijingDisplay } from '@/lib/f1/time';
import { CircuitRegistry } from '@/lib/circuits/registry';
import { RaceStateService } from '@/lib/f1/race-state';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const [overview, calendar] = await Promise.all([
    defaultF1Service.getOverview(), defaultF1Service.getCalendar('2026')
  ]);

  const { currentMeeting, nextSession, driverStandings, previousRace } = overview;
  const circuit = CircuitRegistry.getCircuit(currentMeeting.circuitId, overview.season);
  const targetUtcMs = nextSession?.targetUtcMs ?? 0;
  const hasCountdown = nextSession?.targetUtcMs != null && Number.isFinite(targetUtcMs);


  // 接下来三站：按比赛时间排序，只展示当前分站之后的赛事
  const currentRound = currentMeeting?.round || 0;
  const upcomingThreeRaces = calendar
    .filter(r => r.round > currentRound)
    .sort((a, b) => a.round - b.round)
    .slice(0, 3);
  const isSeasonEnded = calendar.length > 0 && upcomingThreeRaces.length === 0 &&
    RaceStateService.evaluateMeeting(currentMeeting).state === 'WEEKEND_FINISHED';

  return (
    <>
      {/* 1. 当前分站与下一场比赛倒计时 */}
      <section className="hero-100 section-dark" id="race">
        <div className="container" style={{ position: 'relative', width: '100%', zIndex: 2, paddingTop: '40px', paddingBottom: '40px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: 'clamp(32px, 5vw, 48px)', alignItems: 'center' }}>
            {/* Left Column: Race Brief & Action */}
            <div>
              <div className="badge-pill badge-red" style={{ marginBottom: '16px' }}>
                {currentMeeting.round > 0 ? `第 ${currentMeeting.round} 站 / 全季 ${calendar.length} 站` : '赛程同步中'} · {overview.season} 赛季世界锦标赛
              </div>

              <h1 style={{ fontSize: 'clamp(44px, 7vw, 76px)', fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1.05, marginBottom: '12px' }}>
                {currentMeeting.nameZh || currentMeeting.name || '分站信息待同步'}
              </h1>

              <div style={{ fontSize: 'clamp(16px, 2.2vw, 22px)', color: 'var(--text-secondary)', marginBottom: '24px' }}>
                {currentMeeting.circuitName} · {currentMeeting.locality} ({currentMeeting.country})
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '36px' }}>
                {currentMeeting.isSprintWeekend && (
                  <span className="badge-pill badge-red">冲刺赛周末</span>
                )}
                {circuit && <span className="badge-pill badge-dark">
                  {circuit.type === 'street' ? '市街赛道' : circuit.type === 'hybrid' ? '混合赛道' : '永久赛道'}
                </span>}
                {currentMeeting.specs?.laps && (
                  <span className="badge-pill badge-dark">正赛 {currentMeeting.specs.laps} 圈</span>
                )}
              </div>

              <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                <a href="#weekend" className="btn-primary">查看周末赛程</a>
                <a href="#ai" className="btn-secondary">询问 TIKE AI</a>
              </div>
            </div>

            {/* Right Column: Dynamic SVG & High-Precision Countdown */}
            <div style={{ position: 'relative' }}>
              <div style={{ position: 'absolute', top: '-40px', right: 0, width: '100%', height: '100%', opacity: 0.35, pointerEvents: 'none', zIndex: 0 }}>
                <CircuitVisual circuitId={currentMeeting.circuitId} season={overview.season} />
              </div>

              <div className="card-dark hero-timing" style={{ position: 'relative', zIndex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', borderBottom: '1px solid var(--line-dark)', paddingBottom: '14px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text-muted)' }}>
                    {nextSession?.status === 'IN_PROGRESS' ? '当前进行' : hasCountdown ? '下一节' : '赛程状态'} · {nextSession?.session?.name || '大奖赛'}
                  </span>
                  <span className="tabular-nums" style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: '#ff453a', fontWeight: 700 }}>
                    {nextSession?.status === 'IN_PROGRESS' ? '● 进行中' : (nextSession?.session?.startTimeUTC ? formatBeijingDisplay(nextSession.session.startTimeUTC) : nextSession?.status === 'FINISHED' ? '已结束' : '待定')}
                  </span>
                </div>

                {/* 客户端无漂移精准倒计时 */}
                {hasCountdown ? <Countdown targetUtcMs={targetUtcMs} serverTimeMs={Date.now()} isInProgress={nextSession?.status === 'IN_PROGRESS'} /> :
                  <p className="timing-empty" role="status">{nextSession?.status === 'FINISHED' ? '本分站赛程已结束' : '下一节开赛时间暂不可用'}</p>}

                <div style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.6, borderTop: '1px solid var(--line-dark)', paddingTop: '16px' }}>
                  {nextSession?.status === 'IN_PROGRESS' ? '比赛进行中，上方计时为预计剩余时间。' : '开赛时间统一换算为北京时间 (UTC+8)。'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. 本周末完整赛程 */}
      <section className="section-light" id="weekend">
        <div className="container">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '16px', marginBottom: '32px' }}>
            <div>
              <div className="badge-pill badge-light" style={{ marginBottom: '12px' }}>
                周末赛程与时间表
              </div>
              <h2 style={{ fontSize: 'clamp(32px, 4vw, 48px)', fontWeight: 800 }}>
                {currentMeeting.nameZh || currentMeeting.name} · 周末赛程
              </h2>
              <p style={{ color: 'var(--text-dark-secondary)', marginTop: '8px' }}>
                开赛时间均自动转换为北京时间 (UTC+8)
              </p>
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-dark-secondary)' }}>
              数据状态：{overview.dataSource === 'live' ? '上游数据' : overview.dataSource === 'cache' ? '缓存数据' : overview.dataSource === 'lkg' ? '最近可用快照' : '暂不可用'} · 数据更新于：{formatBeijingDisplay(overview.updatedAt)}
              {overview.upstreamSyncSuccess === false ? ' (最近同步失败，保留已有数据)' : overview.isStale ? ' (部分数据待更新)' : ''}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {(currentMeeting.sessions || []).map((session, idx) => (
              <div
                key={session.id || idx}
                className="card-light session-row"
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '24px 32px',
                  borderLeft: session.type === 'race' ? '4px solid #ff2d20' : '1px solid var(--line-light)'
                }}
              >
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: session.type === 'race' ? '#ff2d20' : 'var(--text-dark-secondary)', letterSpacing: '0.04em' }}>
                    {session.name}
                  </div>
                  <div style={{ fontSize: '14px', color: 'var(--text-dark-secondary)', marginTop: '4px' }}>
                    {session.nameEn}
                  </div>
                </div>

                <div className="tabular-nums" style={{ fontFamily: 'var(--font-mono)', fontSize: '15px', fontWeight: 700, color: 'var(--text-dark-primary)' }}>
                  {session.startTimeUTC ? formatBeijingDisplay(session.startTimeUTC) : '待定'}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 3. 当前车手积分前三及完整积分榜入口 */}
      <section className="section-dark" id="standings">
        <div className="container">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '20px', marginBottom: '32px' }}>
            <div>
              <div className="badge-pill badge-red" style={{ marginBottom: '12px' }}>
                {overview.season} 赛季车手锦标赛
              </div>
              <h2 style={{ fontSize: 'clamp(32px, 4vw, 48px)', fontWeight: 800 }}>
                年度车手积分榜前三
              </h2>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                积分统计截至：{overview.standingsCutoffDesc || '截止场次待核实'} · 数据更新于：{formatBeijingDisplay(overview.updatedAt)}
                {overview.upstreamSyncSuccess === false ? ' (最近同步失败，保留已有数据)' : overview.isStale ? ' (部分数据待更新)' : ''}
              </div>
              <Link href="/standings" className="btn-secondary" style={{ padding: '8px 20px', fontSize: '13px' }}>
                查看完整积分榜 →
              </Link>
            </div>
          </div>

          {driverStandings.length === 0 ? (
            <div className="card-dark" role="status">积分数据暂不可用，请稍后重试。未取得数据时不展示推测积分。</div>
          ) : (
            <div className="podium-grid">
              {driverStandings.slice(0, 3).map((driver, index) => (
                <div key={driver.driverId || driver.code} className={`card-dark podium-card ${index === 0 ? 'podium-leader' : ''}`}>
                  <div className="podium-heading">
                    <span className="badge-pill badge-red">P{driver.rank}</span>
                    <span className="podium-points tabular-nums">{driver.points}<small> 分</small></span>
                  </div>
                  <h3>{driver.name}</h3>
                  <p>{driver.team}</p>
                  {index > 0 && Number.isFinite(driver.gap) && <p>距榜首 {Math.abs(driver.gap)} 分</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* 4. 上一站回顾 */}
      {previousRace && (
        <section className="section-dark" id="last-race" style={{ borderTop: '1px solid var(--line-dark)' }}>
          <div className="container">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '16px', marginBottom: '32px' }}>
              <div>
                <div className="badge-pill badge-dark" style={{ marginBottom: '12px' }}>
                  前站赛况与回顾
                </div>
                <h2 style={{ fontSize: 'clamp(28px, 4vw, 40px)', fontWeight: 800 }}>
                  上一站回顾 · 第 {previousRace.round} 站 {previousRace.nameZh || previousRace.name}
                </h2>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  数据更新于：{formatBeijingDisplay(overview.updatedAt)}
                </div>
                {previousRace.sourceUrls?.raceResult ? (
                  <a
                    href={previousRace.sourceUrls.raceResult}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-secondary"
                    style={{ padding: '6px 16px', fontSize: '12px' }}
                  >
                    官方正赛赛果 ↗
                  </a>
                ) : (
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>官方直达链接暂缺</span>
                )}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px' }}>
              {/* Winner */}
              <div className="card-dark">
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>分站正赛冠军 (Winner)</div>
                <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)' }}>{previousRace.winner?.name || '暂无数据'}</div>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>{previousRace.winner?.team || '暂无数据'}</div>
                {previousRace.sourceUrls?.raceResult && (
                  <div style={{ marginTop: '8px' }}>
                    <a href={previousRace.sourceUrls.raceResult} target="_blank" rel="noopener noreferrer" style={{ fontSize: '12px', color: '#64d2ff' }}>
                      官方正赛成绩 ↗
                    </a>
                  </div>
                )}
              </div>

              {/* Pole or Starting Grid P1 */}
              <div className="card-dark">
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                  {previousRace.pole ? '杆位得主 (Pole Position)' : (previousRace.startingGridP1 ? '发车首位 (Starting Grid P1)' : '杆位得主 (Pole Position)')}
                </div>
                <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)' }}>
                  {previousRace.pole?.name || previousRace.startingGridP1?.name || previousRace.qualifyingP1?.name || '暂无数据'}
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  {previousRace.pole?.team || previousRace.startingGridP1?.team || previousRace.qualifyingP1?.team || '暂无数据'}
                  {!previousRace.pole && previousRace.startingGridP1 && ' (按正赛发车格首位统计，排位赛官方成绩待确认)'}
                </div>
                {previousRace.sourceUrls?.qualifying && (
                  <div style={{ marginTop: '8px' }}>
                    <a href={previousRace.sourceUrls.qualifying} target="_blank" rel="noopener noreferrer" style={{ fontSize: '12px', color: '#64d2ff' }}>
                      官方排位成绩 ↗
                    </a>
                  </div>
                )}
              </div>

              {/* Fastest Lap */}
              <div className="card-dark">
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>本场最快圈速 (Fastest Lap)</div>
                <div style={{ fontSize: '24px', fontWeight: 800, color: previousRace.fastestLap?.name ? '#ff453a' : 'var(--text-primary)' }}>
                  {previousRace.fastestLap?.name || '暂无数据'}
                </div>
                <div className="tabular-nums" style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  {previousRace.fastestLap?.lapTime ? `${previousRace.fastestLap.lapTime}${previousRace.fastestLap.lap ? ` (第 ${previousRace.fastestLap.lap} 圈)` : ''}` : '暂无数据'}
                </div>
                {previousRace.sourceUrls?.fastestLaps && (
                  <div style={{ marginTop: '8px' }}>
                    <a href={previousRace.sourceUrls.fastestLaps} target="_blank" rel="noopener noreferrer" style={{ fontSize: '12px', color: '#64d2ff' }}>
                      官方最快圈成绩 ↗
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* 5. 接下来三站 */}
      <section className="section-light" id="next-races">
        <div className="container">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '20px', marginBottom: '36px' }}>
            <div>
              <div className="badge-pill badge-light" style={{ marginBottom: '12px' }}>
                后续赛程走势
              </div>
              <h2 style={{ fontSize: 'clamp(32px, 4vw, 44px)', fontWeight: 800 }}>
                接下来三站赛事
              </h2>
            </div>
            <Link href="/races" className="btn-primary" style={{ padding: '8px 24px', fontSize: '13px' }}>
              浏览全赛季 {calendar.length} 站赛历 →
            </Link>
          </div>

          {isSeasonEnded ? (
            <div className="card-light" style={{ textAlign: 'center', padding: '40px 20px', fontSize: '16px', fontWeight: 700, color: 'var(--text-dark-secondary)' }}>
              本赛季已结束
            </div>
          ) : upcomingThreeRaces.length === 0 ? (
            <div className="card-light" role="status">{calendar.length ? '本分站是赛季收官战，可在上方查看完整赛程。' : '赛历暂不可用，请稍后刷新或前往赛历页重试。'}</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: '20px' }}>
              {upcomingThreeRaces.map((race, idx) => (
                <div key={race.meetingId || race.round || idx} className="card-light" style={{ padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 800, color: '#ff2d20' }}>第 {race.round} 站</span>
                      <span className="badge-pill badge-light" style={{ fontSize: '11px' }}>
                        {race.isSprintWeekend ? '冲刺周末' : '标准周末'}
                      </span>
                    </div>
                    <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-dark-primary)', marginBottom: '6px' }}>
                      {race.nameZh || race.name}
                    </h3>
                    <div style={{ fontSize: '13px', color: 'var(--text-dark-secondary)', marginBottom: '12px' }}>
                      {race.circuitName} · {race.locality} ({race.country})
                    </div>
                    <div className="tabular-nums" style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-dark-primary)', marginBottom: '16px' }}>
                      正赛时间：{race.raceStartUTC ? formatBeijingDisplay(race.raceStartUTC) : '待定'}
                    </div>
                  </div>

                  <Link href={`/races/${race.round}`} style={{ fontSize: '13px', fontWeight: 700, color: '#ff2d20' }}>
                    分站详情 →
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* 6. AI 问答入口 */}
      <section className="section-light" id="ai" style={{ borderTop: '1px solid var(--line-light)' }}>
        <div className="container" style={{ textAlign: 'center' }}>
          <div className="badge-pill badge-light" style={{ marginBottom: '14px' }}>
            赛车智能助手
          </div>
          <h2 style={{ fontSize: 'clamp(36px, 5vw, 56px)', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: '14px' }}>
            TIKE AI
          </h2>
          <p style={{ fontSize: 'clamp(16px, 2vw, 20px)', color: 'var(--text-dark-secondary)', marginBottom: '40px' }}>
            问比赛。问策略。问车手。问规则。
          </p>

          <AISearchBox defaultLight={true} />
        </div>
      </section>

      {/* 7. 积分试算，默认折叠 */}
      <section className="section-dark" id="simulator">
        <div className="container">
          <LazySimulator
            drivers={driverStandings}
            isSprintWeekend={Boolean(currentMeeting.isSprintWeekend)}
            isSprintPending={overview.canSimulateSprint === true}
            available={overview.canSimulateRace === true}
          />
        </div>
      </section>
      <AutoRefresher />
    </>
  );
}
