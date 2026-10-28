'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { teamStyle } from '@/lib/ui/team-colors';
import type { DriverStanding, ConstructorStanding } from '@/lib/f1/types';

export interface StandingsTabsProps {
  drivers: DriverStanding[];
  constructors: ConstructorStanding[];
  season: string;
  historical: boolean;
  pre1958: boolean;
}

export function StandingsTabs({
  drivers,
  constructors,
  season,
  historical,
  pre1958,
}: StandingsTabsProps) {
  const [activeTab, setActiveTab] = useState<'driver' | 'team'>('driver');

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem('apex:standings:tab');
      if (saved === 'team' || saved === 'driver') {
        setActiveTab(saved);
      }
    } catch {}
  }, []);

  const switchTab = (tab: 'driver' | 'team') => {
    setActiveTab(tab);
    try {
      sessionStorage.setItem('apex:standings:tab', tab);
    } catch {}
  };

  return (
    <>
      <nav className="section-jumps" role="tablist" aria-label="积分榜内容">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'driver'}
          className={activeTab === 'driver' ? 'active' : ''}
          onClick={() => switchTab('driver')}
        >
          车手积分榜 ({drivers.length})
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'team'}
          className={activeTab === 'team' ? 'active' : ''}
          onClick={() => switchTab('team')}
        >
          车队积分榜 ({constructors.length})
        </button>
      </nav>

      {activeTab === 'driver' && (
        <>
          {drivers.length > 0 && (
            <section className="podium-ribbon" aria-label="车手积分前三名">
              {drivers.slice(0, 3).map((d) => (
                <div key={d.driverId || d.code} style={teamStyle(d.team)}>
                  <span className="podium-place">P{d.rank}</span>
                  <div>
                    <strong>{d.name || d.nameEn}</strong>
                    <small>{d.team.split(/\s*\(/)[0]}</small>
                  </div>
                  <span className="podium-points">
                    {d.points}
                    <small>PTS</small>
                  </span>
                </div>
              ))}
            </section>
          )}

          <section className="table-section" id="driver-championship">
            <div className="section-head">
              <h2>车手锦标赛</h2>
              <span className="data-note">{drivers.length} 位车手</span>
            </div>
            {!drivers.length ? (
              <p className="empty-state">该赛季暂无车手积分榜数据</p>
            ) : (
              <div className="table-panel">
                <table className="data-table driver-standings">
                  <caption className="sr-only">{season} 赛季车手积分榜</caption>
                  <thead>
                    <tr>
                      <th scope="col">排名</th>
                      <th scope="col">车手</th>
                      <th scope="col">所属车队</th>
                      <th scope="col">分站冠军</th>
                      <th scope="col">分差</th>
                      <th scope="col">总积分</th>
                    </tr>
                  </thead>
                  <tbody>
                    {drivers.map((d) => (
                      <tr key={d.driverId || d.code} style={teamStyle(d.team)} data-podium={d.rank <= 3}>
                        <td className="rank-cell mono">{String(d.rank).padStart(2, '0')}</td>
                        <td>
                          {season === '2026' ? (
                            <Link href={`/drivers/${d.driverId || d.code.toLowerCase()}`}>
                              <strong>{d.name || d.nameEn}</strong>
                              <small>#{d.number}</small>
                            </Link>
                          ) : (
                            <>
                              <strong>{d.name || d.nameEn}</strong>
                              <small>#{d.number}</small>
                            </>
                          )}
                        </td>
                        <td className="team-cell">
                          <span className="team-name">{d.team.split(/\s*\(/)[0]}</span>
                          <small>{d.team.match(/\((.*)\)/)?.[1]}</small>
                        </td>
                        <td className="wins-cell">{d.wins} 胜</td>
                        <td className="gap-cell">
                          {d.gap === 0 ? (historical ? '世界冠军' : '榜首领跑') : `${d.gap} 分`}
                        </td>
                        <td className="points-cell mono">{d.points}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}

      {activeTab === 'team' && (
        <section className="table-section" id="team-championship">
          <div className="section-head">
            <h2>车队锦标赛</h2>
            <span className="data-note">
              {pre1958 ? '1958 年之前未设车队世界冠军' : `${constructors.length} 支车队`}
            </span>
          </div>
          {pre1958 ? (
            <p className="empty-state">1958 年之前未设车队世界冠军奖项，FIA 自 1958 年起设立该奖项。</p>
          ) : !constructors.length ? (
            <p className="empty-state">该赛季暂无车队积分榜数据</p>
          ) : (
            <div className="table-panel">
              <table className="data-table team-standings">
                <caption className="sr-only">{season} 赛季车队积分榜</caption>
                <thead>
                  <tr>
                    <th scope="col">排名</th>
                    <th scope="col">车队</th>
                    <th scope="col">分站冠军</th>
                    <th scope="col">分差</th>
                    <th scope="col">总积分</th>
                  </tr>
                </thead>
                <tbody>
                  {constructors.map((t) => (
                    <tr key={t.teamId} style={teamStyle(t.nameEn || t.name)} data-podium={t.rank <= 3}>
                      <td className="rank-cell mono">{String(t.rank).padStart(2, '0')}</td>
                      <td>
                        {season === '2026' ? (
                          <Link href={`/teams/${t.teamId}`}>
                            <strong>{t.name || t.nameEn}</strong>
                          </Link>
                        ) : (
                          <strong>{t.name || t.nameEn}</strong>
                        )}
                      </td>
                      <td className="wins-cell">{t.wins} 胜</td>
                      <td className="gap-cell">
                        {t.gap === 0 ? (historical ? '年度冠军车队' : '榜首领跑') : `${t.gap} 分`}
                      </td>
                      <td className="points-cell mono">{t.points}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </>
  );
}
