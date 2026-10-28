import { defaultF1Service } from '@/providers/f1/service';
import { PageHeading } from '@/components/page-heading';
import { SeasonSelector } from '@/components/season_selector';
import { formatBeijingDisplay } from '@/lib/f1/time';
import { StandingsTabs } from '@/components/standings-tabs';
import { PersistentDetails } from '@/components/persistent-details';

export const dynamic = 'force-dynamic';

export default async function StandingsPage({
  searchParams,
}: {
  searchParams: Promise<{ season?: string }>;
}) {
  const { season: rawSeason } = (await searchParams) || {};
  const season = rawSeason || '2026';
  const [seasons, overview, drivers, constructors] = await Promise.all([
    defaultF1Service.getSeasons(),
    defaultF1Service.getOverview(season),
    defaultF1Service.getDriverStandings(season),
    defaultF1Service.getConstructorStandings(season),
  ]);
  const historical = Number(season) < new Date().getUTCFullYear();
  const pre1958 = Number(season) < 1958;

  return (
    <div className="page-shell page-standings">
      <div className="container">
        <PageHeading
          category={`${season} · 锦标赛积分`}
          title="锦标赛积分榜"
          description="车手与车队积分，按当前可用的官方记录展示。"
          actions={<SeasonSelector currentSeason={season} seasons={seasons} baseUrl="/standings" />}
          meta={
            <>
              <span>
                {overview.standingsCutoffDesc || '积分统计范围待核实'}
                {overview.standingsCutoffVerified ? ' · 已核实' : ''}
              </span>
              <span>
                更新于 {formatBeijingDisplay(overview.updatedAt)}
                {overview.upstreamSyncSuccess === false ? ' · 最近同步失败，保留已有数据' : ''}
              </span>
            </>
          }
        />

        <StandingsTabs
          drivers={drivers}
          constructors={constructors}
          season={season}
          historical={historical}
          pre1958={pre1958}
        />

        <PersistentDetails id="standings-rules" className="rules-note">
          <summary>积分规则与统计口径</summary>
          <p>
            {historical
              ? `${season} 赛季积分快照。`
              : '正赛前十名 25-18-15-12-10-8-6-4-2-1；冲刺赛前八名 8-7-6-5-4-3-2-1。'}
            车队积分按各站实际归属统计，可能与当前阵容车手全年积分之和不同。各分站具体历史成绩与车队积分明细仍在逐站核验中。
          </p>
        </PersistentDetails>
      </div>
    </div>
  );
}
