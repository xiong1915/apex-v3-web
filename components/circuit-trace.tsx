import { CircuitRegistry } from '@/lib/circuits/registry';
import { circuitOutlines } from '@/lib/circuits/outlines';

export function CircuitTrace({ circuitId, season, meetingName, className = '' }: { circuitId: string; season: string; meetingName?: string; className?: string }) {
  const meta = CircuitRegistry.getCircuit(circuitId, season, {meetingName});
  const path = meta && circuitOutlines[meta.svgFile.split('/').pop()!.replace('.svg', '')];
  if (!meta || !path) return <div className={`trace-missing ${className}`}>真实赛道构型暂缺</div>;
  return <svg className={`circuit-trace ${className}`} viewBox={meta.viewBox} role="img" aria-label={`${meta.nameZh} · ${season} 赛道轮廓`} fill="none">
    <path d={path} className="trace-underlay" />
    <path d={path} pathLength="1" className="trace-line" />
    <circle cx={meta.startFinish.x} cy={meta.startFinish.y} r="5" className="trace-start" />
  </svg>;
}
