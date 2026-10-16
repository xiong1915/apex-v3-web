import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { RaceCover } from '../components/race-cover';
import type { F1Overview } from '../lib/f1/types';

function overview(target: number | null): F1Overview {
  return { season: '2026', currentMeeting: { round: 18, name: 'Test Grand Prix', nameZh: '测试大奖赛', circuitId: 'americas', circuitName: '美洲赛道', locality: '奥斯汀', country: '美国', sessions: [] }, nextSession: { session: null, status: 'UPCOMING', targetUtcMs: target }, driverStandings: [], constructorStandings: [] } as unknown as F1Overview;
}
test('cover foregrounds the supplied race without a branded opening overlay', () => {
  const html = renderToStaticMarkup(<RaceCover overview={overview(null)} seasonEnded={false} />);
  assert.match(html, /测试大奖赛/);
  assert.match(html, /第 18 站/);
  assert.doesNotMatch(html, /LIGHTS OUT|start-sequence|start-lights/);
  assert.match(html, /开赛时间暂不可用/);
  assert.doesNotMatch(html, /countdown-grid/);
});
test('cover distinguishes a completed season from an unavailable next-session time', () => {
  const html = renderToStaticMarkup(<RaceCover overview={overview(null)} seasonEnded />);
  assert.match(html, /赛季回顾/);
  assert.match(html, /本赛季赛程已结束/);
});
