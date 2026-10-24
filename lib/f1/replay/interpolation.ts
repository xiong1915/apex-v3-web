import type { ReplayFrame, TelemetryVehicleState } from './types';

/**
 * 真实非均匀时间戳插值器
 * 核心质量门禁：超过 maxGapMs (3000ms = 3s) 缺口坚决不跨缺口插值！
 */
export function interpolateVehiclesAtTimestamp(
  frames: ReplayFrame[],
  targetMs: number,
  maxGapMs = 3000
): TelemetryVehicleState[] {
  if (!frames || frames.length === 0) return [];
  if (targetMs <= frames[0].timestampMs) return frames[0].vehicles;
  if (targetMs >= frames[frames.length - 1].timestampMs) return frames[frames.length - 1].vehicles;

  // 1. 二分查找目标时间的前后临近帧
  let low = 0;
  let high = frames.length - 1;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    if (frames[mid].timestampMs === targetMs) {
      return frames[mid].vehicles;
    }
    if (frames[mid].timestampMs < targetMs) {
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  const prevIdx = Math.max(0, high);
  const nextIdx = Math.min(frames.length - 1, low);

  const prevFrame = frames[prevIdx];
  const nextFrame = frames[nextIdx];

  const gap = nextFrame.timestampMs - prevFrame.timestampMs;

  // 超过 3 秒缺口不跨缺口插值，直接返回前一帧状态
  if (gap > maxGapMs || gap <= 0) {
    return prevFrame.vehicles.map(v => ({ ...v, stale: true, telemetryStale: true }));
  }

  const alpha = (targetMs - prevFrame.timestampMs) / gap;

  // 2. 对两帧中匹配的车手逐一进行平滑插值
  const nextMap = new Map<number, TelemetryVehicleState>();
  nextFrame.vehicles.forEach(v => nextMap.set(v.driverNumber, v));

  const interpolatedVehicles: TelemetryVehicleState[] = prevFrame.vehicles.map(v0 => {
    const v1 = nextMap.get(v0.driverNumber);
    if (!v1) {
      // 下一帧没有该车手（出现掉线/进站），不跨越插值
      return { ...v0, stale: true, telemetryStale: true };
    }
    if (v0.stale || v1.stale) return { ...v0, stale: true, telemetryStale: true };

    return {
      ...v0,
      normX: v0.normX + (v1.normX - v0.normX) * alpha,
      normY: v0.normY + (v1.normY - v0.normY) * alpha,
      speed: Math.round(v0.speed + (v1.speed - v0.speed) * alpha),
      gear: alpha > 0.5 ? v1.gear : v0.gear,
      rpm: v0.rpm && v1.rpm ? Math.round(v0.rpm + (v1.rpm - v0.rpm) * alpha) : v0.rpm,
      drs: alpha > 0.5 ? v1.drs : v0.drs,
      position: alpha > 0.5 ? v1.position : v0.position,
      gapToLeader: v0.gapToLeader !== undefined && v1.gapToLeader !== undefined
        ? Math.round((v0.gapToLeader + (v1.gapToLeader - v0.gapToLeader) * alpha) * 10) / 10
        : v0.gapToLeader,
      gapToAhead: v0.gapToAhead !== undefined && v1.gapToAhead !== undefined
        ? Math.round((v0.gapToAhead + (v1.gapToAhead - v0.gapToAhead) * alpha) * 10) / 10
        : v0.gapToAhead
    };
  });

  return interpolatedVehicles;
}
