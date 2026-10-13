// app/admin/layout.tsx
import type { Metadata, Viewport } from 'next';
import React from 'react';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = {
  title: 'APEX Control · 私人管理中枢',
  description: 'APEX V3 私人管理中枢 - 实时监控与 F1 数据同步',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'APEX Control'
  },
  icons: {
    apple: '/apple-touch-icon.png',
    icon: [
      { url: '/admin-icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/admin-icon-512.png', sizes: '512x512', type: 'image/png' },
      { url: '/admin-icon.svg', type: 'image/svg+xml' }
    ]
  }
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#0a0a0b'
};

export default function AdminLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <div style={{ minHeight: '100dvh', background: '#0a0a0b', color: '#f5f5f7' }}>
      {children}
    </div>
  );
}
