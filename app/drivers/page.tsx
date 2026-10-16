// app/drivers/page.tsx
import React from 'react';
import Link from 'next/link';
import { defaultF1Service } from '@/providers/f1/service';

export const dynamic = 'force-dynamic';

export default async function DriversPage() {
  const drivers = await defaultF1Service.getDriverStandings('2026');


  return (
    <div className="section-dark page-shell page-drivers" style={{ minHeight: 'calc(100vh - 64px)', padding: '60px 0 100px' }}>
      <div className="container">
        <div className="page-marker"><span>THE DRIVERS</span><span>03 / BEHIND THE VISOR</span></div>
        <div style={{ marginBottom: '48px' }}>
          <div className="badge-pill badge-red" style={{ marginBottom: '12px' }}>
            2026 赛季车手积分记录
          </div>
          <h1 style={{ fontSize: 'clamp(36px, 5vw, 56px)', fontWeight: 900, letterSpacing: '-0.02em' }}>
            2026 赛季车手
          </h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: '8px', fontSize: '15px' }}>
            名单按本赛季官方积分记录收录，按积分排序；赛季出场记录不代表车手当前席位。
          </p>
        </div>

        {drivers.length === 0 && <div className="card-dark" role="status">车手数据暂不可用，请稍后重试。</div>}
        <div style={{ marginBottom: '48px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '20px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 800 }}>车手与赛季积分</h2>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>共 {drivers.length} 位车手记录</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 280px), 1fr))', gap: '24px' }}>
            {drivers.map(d => (
              <Link
                key={d.code}
                href={`/drivers/${d.driverId || d.code.toLowerCase()}`}
                className="card-dark"
                style={{
                  display: 'block',
                  transition: 'transform 0.2s, border-color 0.2s'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '16px' }}>
                  <span className="tabular-nums" style={{ fontFamily: 'var(--font-mono)', fontSize: '20px', fontWeight: 800, color: d.rank <= 3 ? '#ff453a' : 'var(--text-muted)' }}>
                    #{d.number}
                  </span>
                  <span className="tabular-nums" style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--text-muted)' }}>
                    第 {d.rank} 名
                  </span>
                </div>

                <div style={{ fontSize: '20px', fontWeight: 800, marginBottom: '4px' }}>
                  {d.name}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px' }}>
                  {d.nameEn}
                </div>

                <div style={{ borderTop: '1px solid var(--line-dark)', paddingTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{d.team}</span>
                  <span className="tabular-nums" style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: '16px', color: '#ff453a' }}>
                    {d.points} <span style={{ fontSize: '11px', fontWeight: 400, color: 'var(--text-muted)' }}>分</span>
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
