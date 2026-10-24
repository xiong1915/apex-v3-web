// app/races/[id]/page.tsx
import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { defaultF1Service } from '@/providers/f1/service';
import { CircuitTrace } from '@/components/circuit-trace';
import { PageHeading } from '@/components/page-heading';
import { CircuitRegistry } from '@/lib/circuits/registry';
import { formatBeijingDisplay } from '@/lib/f1/time';

export const dynamic = 'force-dynamic';

export default async function RaceDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ season?: string }>;
}) {
  const { id } = await params;
  const { season: rawSeason } = (await searchParams) || {};
  const season = rawSeason || '2026';

  const calendar = await defaultF1Service.getCalendar(season);
  const roundNum = parseInt(id, 10);
  const race = calendar.find(r => r.meetingId === id || r.circuitId === id || r.round === roundNum);

  if (!race) {
    notFound();
  }

  // 严格根据当前 season 获取赛道元数据，绝不跨年代套用
  const circuitMeta = CircuitRegistry.getCircuit(race.circuitId, season, {meetingName:race.name});

  // 并行获取该分站的历史官方正赛、排位、冲刺详细赛果
  const [raceResults, qualiResults, sprintResults] = await Promise.all([
    defaultF1Service.getRaceResult(season, race.round),
    defaultF1Service.getQualifyingResult(season, race.round),
    race.isSprintWeekend ? defaultF1Service.getSprintResult(season, race.round) : Promise.resolve([])
  ]);

  const hasRaceResults = raceResults && raceResults.length > 0;
  const hasQualiResults = qualiResults && qualiResults.length > 0;
  const hasSprintResults = sprintResults && sprintResults.length > 0;
  const isHistorical = Number(season) < new Date().getUTCFullYear();

  return (
    <div className="page-shell page-race-detail"><div className="container">
      <Link href={`/races?season=${season}`} className="breadcrumb">← {season} 赛季日历</Link>
      <div className="race-detail-cover"><div><PageHeading category={`第 ${race.round} 站 / 共 ${calendar.length} 站 · ${season} 赛季`} title={race.nameZh||race.name} description={`${circuitMeta?.nameZh||race.circuitName} · ${race.locality} / ${race.country}`}/>
       <div className="race-detail-tags">{race.isSprintWeekend&&<span className="badge-pill badge-red">冲刺周末</span>}{circuitMeta&&<><span className="badge-pill">{circuitMeta.lengthKm} 公里</span><span className="badge-pill">{circuitMeta.turns} 弯角</span>{circuitMeta.drsZones>0&&<span className="badge-pill">{circuitMeta.drsZones} 个 DRS 区</span>}</>}</div>
       <Link href={`/replay?season=${season}&round=${race.round}`} className="btn-primary">进入本分站回放 ↗</Link>
      </div><figure className="race-detail-map"><CircuitTrace circuitId={race.circuitId} season={season} meetingName={race.name}/><figcaption>{circuitMeta?.nameZh||race.circuitName} · {season} 构型</figcaption></figure></div>
        {/* 正赛官方赛果列表 */}
        {hasRaceResults && (
          <div style={{ marginBottom: '64px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '24px', fontWeight: 800 }}>正赛成绩</h2>
              <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>共 {raceResults.length} 位完赛/退赛车手</span>
            </div>

            <div className="result-panel">
              <div style={{ minWidth: '720px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '60px 2fr 2fr 70px 70px 140px 80px', padding: '16px 24px', background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid var(--line-dark)', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>
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
                      background: idx === 0 ? 'rgba(255,45,32,0.04)' : 'transparent'
                    }}
                  >
                    <span className="tabular-nums" style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: '15px', color: idx === 0 ? 'var(--accent-red)' : 'inherit' }}>
                      {r.position || 'NC'}
                    </span>

                    <div>
                      <span style={{ fontWeight: 700, fontSize: '14px' }}>{r.driverName}</span>
                      {r.driverNumber && <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '6px' }}>#{r.driverNumber}</span>}
                      {r.fastestLap?.rank === '1' && (
                        <span className="badge-pill badge-red" style={{ fontSize: '10px', marginLeft: '6px', padding: '2px 6px' }}>
                          最快圈 {r.fastestLap.time}
                        </span>
                      )}
                    </div>

                    <div style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
                      {r.constructorName}
                    </div>

                    <div className="tabular-nums" style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                      P{r.grid}
                    </div>

                    <div className="tabular-nums" style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '13px' }}>
                      {r.laps}
                    </div>

                    <div className="tabular-nums" style={{ textAlign: 'right', color: 'var(--text-secondary)', fontSize: '13px' }}>
                      {r.time || r.status}
                    </div>

                    <div className="tabular-nums" style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: '15px', color: r.points > 0 ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                      {r.points}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 冲刺赛赛果 (若有) */}
        {hasSprintResults && (
          <div style={{ marginBottom: '64px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '24px', fontWeight: 800 }}>冲刺赛成绩</h2>
              <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>冲刺赛前 8 名计入世界锦标赛积分</span>
            </div>

            <div className="result-panel">
              <div style={{ minWidth: '640px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '60px 2.5fr 2.5fr 70px 140px 80px', padding: '16px 24px', background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid var(--line-dark)', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>
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
                      alignItems: 'center'
                    }}
                  >
                    <span className="tabular-nums" style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: '15px' }}>
                      {s.position}
                    </span>

                    <div style={{ fontWeight: 700, fontSize: '14px' }}>
                      {s.driverName}
                    </div>

                    <div style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
                      {s.constructorName}
                    </div>

                    <div className="tabular-nums" style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                      P{s.grid}
                    </div>

                    <div className="tabular-nums" style={{ textAlign: 'right', color: 'var(--text-secondary)', fontSize: '13px' }}>
                      {s.time || s.status}
                    </div>

                    <div className="tabular-nums" style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: '15px', color: s.points > 0 ? 'var(--accent-red)' : 'var(--text-muted)' }}>
                      {s.points}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 排位赛官方成绩 */}
        <div style={{ marginBottom: '64px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '20px' }}>
            <h2 style={{ fontSize: '24px', fontWeight: 800 }}>排位赛成绩</h2>
            <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              {hasQualiResults ? `杆位：${qualiResults[0]?.driverName} (${qualiResults[0]?.q3 || qualiResults[0]?.q2 || qualiResults[0]?.q1 || ''})` : '历史档案记录'}
            </span>
          </div>

          {hasQualiResults ? (
            <div className="result-panel">
              <div style={{ minWidth: '640px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '60px 2.2fr 2.2fr 100px 100px 100px', padding: '16px 24px', background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid var(--line-dark)', fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)' }}>
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
                      background: idx === 0 ? 'rgba(255,45,32,0.04)' : 'transparent'
                    }}
                  >
                    <span className="tabular-nums" style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: '15px', color: idx === 0 ? 'var(--accent-red)' : 'inherit' }}>
                      P{q.position}
                    </span>

                    <div style={{ fontWeight: 700, fontSize: '14px' }}>
                      {q.driverName}
                    </div>

                    <div style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
                      {q.constructorName}
                    </div>

                    <div className="tabular-nums" style={{ textAlign: 'right', color: 'var(--text-secondary)', fontSize: '13px' }}>
                      {q.q1 || '-'}
                    </div>

                    <div className="tabular-nums" style={{ textAlign: 'right', color: 'var(--text-secondary)', fontSize: '13px' }}>
                      {q.q2 || '-'}
                    </div>

                    <div className="tabular-nums" style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '13px', color: idx === 0 ? 'var(--accent-red)' : 'var(--text-primary)' }}>
                      {q.q3 || '-'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="card-dark" style={{ padding: '36px 28px', textAlign: 'center', background: 'rgba(255,255,255,0.02)', borderRadius: '20px', border: '1px dashed var(--line-dark)' }}>
              <div style={{ fontSize: '24px', marginBottom: '8px' }}>⏱️</div>
              <div style={{ fontSize: '16px', fontWeight: 700, marginBottom: '6px' }}>
                {isHistorical ? '该历史分站未收录详细排位圈速数据' : '排位赛数据暂未生成'}
              </div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '14px', maxWidth: '520px', margin: '0 auto', lineHeight: 1.6 }}>
                {isHistorical
                  ? '早期 F1 赛事（如 1950 年代）官方统计档案仅保存了正赛发车格位 (Starting Grid)，未收录各阶段逐圈时间。系统实事求是展示正赛发车位，严禁虚构圈速。'
                  : '排位赛尚未开赛或官方节点正处于同步窗口。'}
              </p>
            </div>
          )}
        </div>

        {/* Sessions Schedule (练习赛与时间表) */}
        {!isHistorical && race.sessions && race.sessions.length > 0 && (
          <div style={{ marginBottom: '64px' }}>
            <h2 style={{ fontSize: '24px', fontWeight: 800, marginBottom: '24px' }}>各节练习与排位/正赛赛程 (北京时间 UTC+8)</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {race.sessions.map((s, idx) => (
                <div
                  key={s.id || idx}
                  className="card-dark detail-session"
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '20px 28px',
                    borderLeft: s.type === 'race' ? '1px solid var(--line-dark)' : '1px solid var(--line-dark)'
                  }}
                >
                  <div>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: s.type === 'race' ? 'var(--accent-red)' : 'var(--text-muted)', textTransform: 'uppercase' }}>
                      {s.nameEn}
                    </div>
                    <div style={{ fontSize: '17px', fontWeight: 700, marginTop: '2px' }}>
                      {s.name}
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div className="tabular-nums" style={{ fontFamily: 'var(--font-mono)', fontSize: '16px', fontWeight: 700 }}>
                      {formatBeijingDisplay(s.startTimeUTC)}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                      时长 {s.durationMinutes} 分钟
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
