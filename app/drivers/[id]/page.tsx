import Link from 'next/link';
import { AILink } from '@/components/ai-link';
import { notFound } from 'next/navigation';
import { defaultF1Service } from '@/providers/f1/service';
import { PageHeading } from '@/components/page-heading';
import { getDriverBiography } from '@/lib/f1/profiles';

export const dynamic = 'force-dynamic';

export default async function DriverDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const drivers = await defaultF1Service.getDriverStandings('2026');
  const driver = drivers.find(d => d.driverId === id || d.code.toLowerCase() === id.toLowerCase());
  if (!driver) notFound();

  const bio = getDriverBiography(driver);

  return (
    <div className="page-shell page-driver-detail">
      <div className="container">
        <Link className="breadcrumb" href="/drivers">← 车手档案</Link>
        <div className="profile-cover">
          <div>
            <PageHeading
              category={`2026 · 车手档案 / ${driver.code}`}
              title={driver.name}
              description={`${driver.nameEn} · ${driver.team}`}
            />
            <AILink
              question={`请介绍 ${driver.name}（${driver.nameEn}）在 2026 赛季的表现、技术特点和已确认的成绩。`}
              className="btn-primary"
            >
              向 APEX AI 了解这位车手 ↗
            </AILink>
          </div>
          <span className="profile-number mono" aria-label={`车号 ${driver.number}`}>
            {driver.number || '—'}
          </span>
        </div>

        <dl className="profile-stats">
          <div>
            <dt>积分榜排名</dt>
            <dd>P{driver.rank}</dd>
          </div>
          <div>
            <dt>赛季总积分</dt>
            <dd>{driver.points}</dd>
          </div>
          <div>
            <dt>分站冠军</dt>
            <dd>{driver.wins}</dd>
          </div>
          <div>
            <dt>距榜首积分</dt>
            <dd>{driver.gap === 0 ? '领跑' : driver.gap}</dd>
          </div>
        </dl>

        <section className="profile-bio-section">
          <div className="bio-card">
            <div className="bio-header">
              <div className="bio-title-wrap">
                <span className="bio-kicker">车手侧写与竞技特点</span>
                <h2 className="bio-title">{driver.name} · 背景档案</h2>
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
                  <h3>生涯历程</h3>
                  <p>{bio.summary}</p>
                </div>
                <div className="bio-block">
                  <h3>竞技驾驶风格</h3>
                  <p>{bio.racingStyle}</p>
                </div>
                <div className="bio-block">
                  <h3>赛车工程考量</h3>
                  <p>{bio.technicalNotes}</p>
                </div>
              </div>

              <div className="bio-aside">
                <div className="bio-meta-card">
                  <h4>车手档案概览</h4>
                  <dl className="bio-meta-list">
                    <div>
                      <dt>国籍</dt>
                      <dd>{bio.nationality}</dd>
                    </div>
                    <div>
                      <dt>常驻车号</dt>
                      <dd className="mono">#{bio.permanentNumber || driver.number || '—'}</dd>
                    </div>
                    <div>
                      <dt>所属车队</dt>
                      <dd>{driver.team}</dd>
                    </div>
                  </dl>

                  <div className="bio-highlights">
                    <h5>生涯里程碑</h5>
                    <ul>
                      {bio.careerHighlights.map((hl, i) => (
                        <li key={i}>{hl}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="profile-links">
          <Link href={`/teams/${driver.teamId}`} className="text-link">查看所属车队 ↗</Link>
          <Link href="/standings" className="text-link">查看锦标赛积分 ↗</Link>
        </div>
      </div>
    </div>
  );
}
