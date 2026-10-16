'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { entranceMode } from '@/lib/ui/motion-policy';

export function RaceExperience({ children }: { children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = root.current;
    if (!node) return;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    let visited = true;
    try {
      visited = sessionStorage.getItem('apex-lights-out-v1') === 'seen';
      sessionStorage.setItem('apex-lights-out-v1', 'seen');
    } catch { /* Storage may be unavailable; keep the lighter entrance. */ }
    node.dataset.intro = entranceMode(visited, media.matches);
    const elements = new Set<HTMLElement>();
    if (media.matches || !('IntersectionObserver' in window)) return;
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.remove('reveal-pending');
          entry.target.classList.add('reveal-enter');
          observer.unobserve(entry.target);
        }
      }
    }, { threshold: 0.08 });
    const stage = (element: HTMLElement) => {
      if (elements.has(element)) return;
      elements.add(element);
      // Content is visible without JavaScript; only stage below-fold elements.
      if (element.getBoundingClientRect().top > window.innerHeight) element.classList.add('reveal-pending');
      observer.observe(element);
    };
    node.querySelectorAll<HTMLElement>('[data-reveal]').forEach(stage);
    // Server-streamed sections can arrive after hydration; stage each new section once.
    const mutations = new MutationObserver(records => {
      for (const record of records) for (const added of record.addedNodes) {
        if (!(added instanceof HTMLElement)) continue;
        if (added.matches('[data-reveal]')) stage(added);
        added.querySelectorAll<HTMLElement>('[data-reveal]').forEach(stage);
      }
    });
    mutations.observe(node, { childList: true, subtree: true });
    const reduce = () => {
      if (!media.matches) return;
      node.dataset.intro = 'none';
      elements.forEach(element => element.classList.remove('reveal-pending'));
      observer.disconnect();
      mutations.disconnect();
    };
    media.addEventListener('change', reduce);
    return () => { observer.disconnect(); mutations.disconnect(); media.removeEventListener('change', reduce); };
  }, []);
  return <div className="lights-out" ref={root} data-intro="light">
    <div className="start-sequence" aria-hidden="true"><div className="start-lights">{[0, 1, 2, 3, 4].map(i => <i key={i} style={{ '--light': i } as React.CSSProperties} />)}</div><div className="start-sweep" /></div>
    {children}
  </div>;
}
