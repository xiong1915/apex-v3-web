import Link from 'next/link';
import { AILink } from '@/components/ai-link';
import { notFound } from 'next/navigation';
import { defaultF1Service } from '@/providers/f1/service';
import { PageHeading } from '@/components/page-heading';
import { getTeamBiography } from '@/lib/f1/profiles';

export const dynamic = 'force-dynamic';

export default async function TeamDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [teams, drivers] = await Promise.all([
    defaultF1Service.getConstructorStandings('2026'),
    defaultF1Service.getDriverStandings('2026')
  ]);

  const team = teams.find(t => t.teamId === id || t.nameEn.toLowerCase().includes(id.toLowerCase()));
  if (!team) notFound();
  const teamDrivers = drivers.filter(d => d.teamId === team.teamId || d.team.includes(team.name));

  const bio = getTeamBiography(team);

  return (
    <div className="page-shell page-team-detail">
      <div className="container">
        <Link className="breadcrumb" href="/teams">← 车队档案</Link>
        <div className="profile-cover">
          <div>
            <PageHeading
              category="2026 · 车队档案"
              title={team.name.replace(/\s*[（(][^）)]*[）)]\s*$/, '')}
              description={team.nameEn}
            />
            <AILink
              question={`请介绍 ${team.name}（${team.nameEn}）在 2026 赛季的表现、赛车特点和已确认的成绩。`}
              className="btn-primary"
            >
              向 tikeai 了解这支车队 ↗
            </AILink>
          </div>
          <span className="profile-number mono" aria-label={`车队排名 ${team.rank}`}>
            P{team.rank}
          </span>
        </div>

        <dl className="profile-stats">
          <div>
            <dt>车队积分榜排名</dt>
            <dd>P{team.rank}</dd>
          </div>
          <div>
            <dt>赛季总积分</dt>
            <dd>{team.points}</dd>
          </div>
          <div>
            <dt>分站冠军</dt>
            <dd>{team.wins}</dd>
          </div>
          <div>
            <dt>距榜首积分</dt>
            <dd>{team.gap === 0 ? '领跑' : team.gap}</dd>
          </div>
        </dl>

        <section className="profile-bio-section">
          <div className="bio-card">
            <div className="bio-header">
              <div className="bio-title-wrap">
                <span className="bio-kicker">车队底蕴与工程理念</span>
                <h2 className="bio-title">{bio.name} · 车队概况</h2>
              </div>
              <div className="bio-tags">
                {bio.tags.map(tag => (
                  <span key={tag} className="bio-tag">{tag}</span>
                ))}
              </div>
            </div>

            <div className="bio-content-grid">
              <div className="bio-main">
                <div className="bio-block">
                  <h3>车队底蕴与历史起源</h3>
                  <p>{bio.heritage}</p>
                </div>
                <div className="bio-block">
                  <h3>赛车研发与技术哲学</h3>
                  <p>{bio.technicalFocus}</p>
                </div>
              </div>

              <div className="bio-aside">
                <div className="bio-meta-card">
                  <h4>工程与运营架构</h4>
                  <dl className="bio-meta-list">
                    <div>
                      <dt>研发总部基地</dt>
                      <dd>{bio.headquarters}</dd>
                    </div>
                    <div>
                      <dt>动力单元</dt>
                      <dd>{bio.powerUnit}</dd>
                    </div>
                    <div>
                      <dt>团队领导</dt>
                      <dd>{bio.teamPrincipal}</dd>
                    </div>
                    <div>
                      <dt>锦标赛战绩</dt>
                      <dd>{bio.championships}</dd>
                    </div>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </section>

        {teamDrivers.length > 0 && (
          <section className="team-driver-section">
            <div className="section-head">
              <div>
                <h2>代表车手</h2>
                <p>积分记录中的车队归属，不等同于当前签约阵容。</p>
              </div>
            </div>
            <div className="team-grid">
              {teamDrivers.map(d => (
                <Link
                  className="team-driver-link"
                  key={d.code}
                  href={`/drivers/${d.driverId || d.code.toLowerCase()}`}
                >
                  <span className="mono">#{d.number}</span>
                  <div>
                    <strong>{d.name}</strong>
                    <small>{d.points} 分</small>
                  </div>
                  <span aria-hidden="true">↗</span>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
