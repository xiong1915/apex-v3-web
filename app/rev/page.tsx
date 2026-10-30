// app/rev/page.tsx
import { Metadata } from 'next';
import { RevDashboard } from '@/components/rev/RevDashboard';

export const metadata: Metadata = {
  title: 'Acoustic Rev — F1 引擎声浪互动室 | APEX V3',
  description:
    '纯原生 Web Audio 程序化合成 F1 经典 V10、V8、V6 涡轮增压混动引擎声浪。配备物理转速模拟、换挡指示灯与液态玻璃驾驶舱仪表。'
};

export default function RevPage() {
  return (
    <div
      style={{
        minHeight: '100dvh',
        background: 'radial-gradient(ellipse at top, #131720 0%, #090b10 100%)',
        paddingTop: 'calc(var(--nav-height, 64px) + 12px)',
        paddingBottom: '24px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-start',
        alignItems: 'center',
        boxSizing: 'border-box'
      }}
    >
      <RevDashboard />
    </div>
  );
}
