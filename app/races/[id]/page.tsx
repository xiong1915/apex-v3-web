import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { defaultF1Service } from '@/providers/f1/service';
import { CircuitTrace } from '@/components/circuit-trace';
import { PageHeading } from '@/components/page-heading';
import { CircuitRegistry } from '@/lib/circuits/registry';
import { RaceDetailTabs } from '@/components/race-detail-tabs';

export const dynamic = 'force-dynamic';

export default async function RaceDetailPage({
  params,
  searchParams,
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
  const circuitMeta = CircuitRegistry.getCircuit(race.circuitId, season, { meetingName: race.name });

  // 并行获取该分站的历史官方正赛、排位、冲刺详细赛果
  const [raceResults, qualiResults, sprintResults] = await Promise.all([
    defaultF1Service.getRaceResult(season, race.round),
    defaultF1Service.getQualifyingResult(season, race.round),
    race.isSprintWeekend ? defaultF1Service.getSprintResult(season, race.round) : Promise.resolve([]),
  ]);

  const isHistorical = Number(season) < new Date().getUTCFullYear();

  return (
    <div className="page-shell page-race-detail">
      <div className="container">
        <Link href={`/races?season=${season}`} className="breadcrumb">
          ← {season} 赛季日历
        </Link>
        <div className="race-detail-cover">
          <div className="race-detail-info">
            <PageHeading
              category={`第 ${race.round} 站 / 共 ${calendar.length} 站 · ${season} 赛季`}
              title={race.nameZh || race.name}
              description={`${circuitMeta?.nameZh || race.circuitName} · ${race.locality} / ${race.country}`}
            />
            <div className="race-detail-tags">
              {race.isSprintWeekend && <span className="badge-pill badge-red">冲刺周末</span>}
              {circuitMeta && (
                <>
                  <span className="badge-pill">{circuitMeta.lengthKm} 公里</span>
                  <span className="badge-pill">{circuitMeta.turns} 弯角</span>
                  {Number(season) < 2026 && circuitMeta.drsZones > 0 && (
                    <span className="badge-pill">{circuitMeta.drsZones} 个 DRS 区</span>
                  )}
                </>
              )}
            </div>
            <Link href={`/live?season=${season}&round=${race.round}`} className="btn-primary">
              进入本分站实时数据 ↗
            </Link>
          </div>
          <figure className="race-detail-map">
            <CircuitTrace circuitId={race.circuitId} season={season} meetingName={race.name} />
            <figcaption>
              {circuitMeta?.nameZh || race.circuitName} · {season} 构型
            </figcaption>
          </figure>
        </div>

        <RaceDetailTabs
          raceResults={raceResults}
          qualiResults={qualiResults}
          sprintResults={sprintResults}
          sessions={race.sessions}
          circuitId={race.circuitId}
          season={season}
          meetingName={race.name}
          round={race.round}
          isHistorical={isHistorical}
        />
      </div>
    </div>
  );
}
