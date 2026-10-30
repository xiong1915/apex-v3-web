// app/layout.tsx
import type { Metadata, Viewport } from 'next';
import './globals.css';
import './wallpaper.css';
import './styles/materials.css';
import {WallpaperBackground} from '@/components/wallpaper-background';

import { Navbar } from '@/components/navbar';
import { Footer } from '@/components/footer';

export const metadata: Metadata = {
  title: 'APEX · F1 赛事、积分与赛事分析',
  description: '一级方程式赛车数据与赛事分析平台。实时分站倒计时、车手与车队积分榜及 AI 问答。',
  keywords: ['F1', 'Formula 1', 'TIKE', '2026 F1', '一级方程式', '赛车', '赛历', '积分榜'],
  openGraph: {
    title: 'APEX · F1 赛事与数据',
    description: '一级方程式赛车数据与赛事分析平台。',
    type: 'website',
    url: 'https://f1.tike69.cc.cd'
  },
  icons: {
    icon: '/icon.svg'
  }
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#101318',
  viewportFit: 'cover'
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body>
        <a href="#main-content" className="skip-link">跳到主要内容</a>
        <Navbar />
        <main id="main-content" tabIndex={-1}>{children}</main>
        <Footer />
        <WallpaperBackground />
      </body>
    </html>
  );
}
