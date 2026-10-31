import type { Metadata } from 'next';
import { RevDashboard } from '@/components/rev/RevDashboard';
export const metadata: Metadata = {
  title: 'Acoustic Rev — F1 引擎互动驾驶舱 | tikeai',
  description: '自由声浪、400 米直线加速、弹射起步与听声辨引擎。三种引擎时代，四种驾驶体验。'
};
export default function RevPage() { return <RevDashboard/>; }
