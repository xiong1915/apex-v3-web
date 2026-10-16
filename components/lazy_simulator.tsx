'use client';

import { useState, type ComponentProps } from 'react';
import dynamic from 'next/dynamic';

const TitleSimulator = dynamic(() => import('./title_simulator').then(module => module.TitleSimulator), {
  loading: () => <p role="status" className="season-feedback">正在加载积分工具…</p>
});

export function LazySimulator(props: ComponentProps<typeof TitleSimulator>) {
  const [activated, setActivated] = useState(false);
  return (
    <details className="simulator-panel" onToggle={event => {
      if (event.currentTarget.open) setActivated(true);
    }}>
      <summary>
        <span><span className="badge-pill badge-red">积分工具</span> 本周末积分试算</span>
        <span className="season-feedback">展开 / 折叠</span>
      </summary>
      <div className="simulator-content">{activated && <TitleSimulator {...props} />}</div>
    </details>
  );
}
