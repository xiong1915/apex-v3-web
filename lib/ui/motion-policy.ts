export function standingRatio(points: number, leader: number): number {
  return Number.isFinite(points) && Number.isFinite(leader) && leader > 0
    ? Math.max(0, Math.min(1, points / leader)) : 0;
}
