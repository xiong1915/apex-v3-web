'use client';

import React, { useState } from 'react';
import { GlassSurface } from '@/components/glass/GlassSurface';
import { GlassButton } from '@/components/glass/GlassButton';

export default function GlassDemoPage() {
  const [wallpaperOn, setWallpaperOn] = useState(true);

  const toggleWallpaper = () => {
    const next = !wallpaperOn;
    setWallpaperOn(next);
    if (next) {
      document.documentElement.dataset.wallpaper = 'on';
    } else {
      delete document.documentElement.dataset.wallpaper;
    }
  };

  return (
    <div className="container" style={{ padding: '40px 16px', maxWidth: '1100px', margin: '0 auto' }}>
      <header style={{ marginBottom: '32px' }}>
        <span className="badge-pill badge-red" style={{ marginBottom: '12px' }}>
          APEX OPTICAL LAB
        </span>
        <h1 style={{ fontSize: '32px', fontWeight: 800, margin: '8px 0', letterSpacing: '-0.03em' }}>
          Liquid Glass 质感与交互诊断展厅
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '15px', lineHeight: 1.6, maxWidth: '640px' }}>
          遵循 Apple Liquid Glass 与 macOS Sequoia 设计语汇，验证高折射边缘高光、动态壁纸分层、无障碍文字对比度与移动端自适应。
        </p>
        <div style={{ marginTop: '16px', display: 'flex', gap: '12px', alignItems: 'center' }}>
          <GlassButton variant="primary" onClick={toggleWallpaper}>
            {wallpaperOn ? '关闭壁纸背景' : '开启动态壁纸'}
          </GlassButton>
          <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
            当前壁纸模式：<strong style={{ color: 'var(--text-primary)' }}>{wallpaperOn ? '开启' : '关闭'}</strong>
          </span>
        </div>
      </header>

      {/* Grid of Glass Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: '24px',
        marginBottom: '40px'
      }}>
        {/* Card 1: Elevated Surface */}
        <GlassSurface variant="elevated" style={{ padding: '28px', borderRadius: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--accent-red)' }}>
              LIVE TELEMETRY
            </span>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>340 KM/H</span>
          </div>
          <h2 style={{ fontSize: '20px', fontWeight: 700, margin: '0 0 8px', color: 'var(--text-primary)' }}>
            法拉利 SF-26 空力翼片
          </h2>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.6, margin: '0 0 20px' }}>
            通过实时双通道 Canvas 贴图生成法线置换，模拟真实亚克力在光线下的边缘漫折射。
          </p>
          <div style={{ display: 'flex', gap: '10px' }}>
            <GlassButton variant="primary" size="sm">进入遥测</GlassButton>
            <GlassButton variant="ghost" size="sm">空气动力详情</GlassButton>
          </div>
        </GlassSurface>

        {/* Card 2: Subtle Surface */}
        <GlassSurface variant="subtle" style={{ padding: '28px', borderRadius: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text-muted)' }}>
              CIRCUIT OPTICS
            </span>
            <span style={{ fontSize: '12px', color: 'var(--accent-action)' }}>Sector 2</span>
          </div>
          <h2 style={{ fontSize: '20px', fontWeight: 700, margin: '0 0 8px', color: 'var(--text-primary)' }}>
            蒙扎国家赛车场
          </h2>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.6, margin: '0 0 20px' }}>
            在视口小于 768px 或低功耗模式下，自动降级为静态 Frosted 磨砂效果，保证 60FPS 流畅滚动。
          </p>
          <div style={{ display: 'flex', gap: '10px' }}>
            <GlassButton variant="secondary" size="sm">赛道档案</GlassButton>
          </div>
        </GlassSurface>

        {/* Card 3: Standings Surface */}
        <GlassSurface variant="elevated" style={{ padding: '28px', borderRadius: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--accent-red)' }}>
              CHAMPIONSHIP
            </span>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Round 19 / 24</span>
          </div>
          <h2 style={{ fontSize: '20px', fontWeight: 700, margin: '0 0 8px', color: 'var(--text-primary)' }}>
            车手积分榜争夺
          </h2>
          <div style={{ margin: '14px 0', borderTop: '1px solid var(--line-dark)', paddingTop: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', padding: '6px 0' }}>
              <strong>1. 勒克莱尔</strong>
              <span className="mono" style={{ fontWeight: 700, color: 'var(--accent-red)' }}>348 PTS</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', padding: '6px 0' }}>
              <strong>2. 诺里斯</strong>
              <span className="mono" style={{ fontWeight: 700 }}>332 PTS</span>
            </div>
          </div>
          <GlassButton variant="ghost" size="sm" style={{ width: '100%' }}>查看完整积分榜 ↗</GlassButton>
        </GlassSurface>
      </div>

      {/* Physical Degradation & Accessibility Spec Section */}
      <section style={{
        background: 'var(--bg-secondary)',
        border: '1px solid var(--line-dark)',
        borderRadius: '16px',
        padding: '24px',
        marginBottom: '40px'
      }}>
        <h3 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 12px' }}>
          材质工程规范校验状态
        </h3>
        <ul style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.8, paddingLeft: '20px', margin: 0 }}>
          <li><strong>边缘高光与折射</strong>：SVG feDisplacementMap + Canvas 2D 离屏生成（双透镜并发硬配额）。</li>
          <li><strong>物理降级</strong>：针对移动端自动降级为静态背景与边框阴影，降低 GPU 重绘损耗。</li>
          <li><strong>WCAG 4.5:1 对比度</strong>：文字全部使用高对比语义颜色（<code>var(--text-primary)</code> / <code>var(--text-secondary)</code>），禁止低饱和度半透明文本。</li>
          <li><strong>触控安全区</strong>：按钮最小点击高度达到 44px（桌面与模拟移动视口符合无障碍标准）。</li>
        </ul>
      </section>
    </div>
  );
}
