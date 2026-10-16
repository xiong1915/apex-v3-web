import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import DriversPage from '../app/drivers/page';
import { defaultF1Service } from '../providers/f1/service';
import { FIXTURE_2026_DRIVERS } from './fixtures/2026_season_fixture';

test('driver page keeps all season entries without classifying rank 21 as a reserve', async t => {
  const drivers = Array.from({length:22}, (_, index) => ({...FIXTURE_2026_DRIVERS[0],
    driverId:`test_${index}`, code:`T${index}`, rank:index+1, name:`测试车手${index+1}`}));
  t.mock.method(defaultF1Service, 'getDriverStandings', async () => drivers);
  const html = renderToStaticMarkup(await DriversPage());
  assert.match(html, /测试车手22/);
  assert.doesNotMatch(html, /替补出场|20 位全赛季正式签约/);
  assert.equal((html.match(/href="\/drivers\//g) || []).length, 22);
});

test('driver page explains unavailable data instead of presenting an empty roster as complete', async t => {
  t.mock.method(defaultF1Service, 'getDriverStandings', async () => []);
  assert.match(renderToStaticMarkup(await DriversPage()), /车手数据暂不可用/);
});
