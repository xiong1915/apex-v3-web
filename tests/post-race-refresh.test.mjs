import test from 'node:test';
import assert from 'node:assert/strict';
import { GET as refresh, POST as refreshPost } from '../app/api/cron/post-race-refresh/route.ts';
import { NextRequest } from 'next/server';

const SECRET = '<redacted>';
const envKeys = ['POST_RACE_REFRESH_SECRET', 'UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN', 'KV_REST_API_URL', 'KV_REST_API_TOKEN', 'STORAGE_PROVIDER'];
const methods = ['getCalendarResult', 'getDriverStandingsResult', 'getConstructorStandingsResult', 'getLastRaceResultResult', 'getOverview'];

const hoursAgo = (h) => new Date(Date.now() - h * 3600000).toISOString();
// Race that ended one hour ago: started three hours ago, lasted two hours.
const inWindowCalendar = [{ round: 20, sessions: [{ type: 'race', startTimeUTC: hoursAgo(3), durationMinutes: 120 }] }];
// Race that ended eight hours ago: outside the six-hour window.
const outsideWindowCalendar = [{ round: 20, sessions: [{ type: 'race', startTimeUTC: hoursAgo(10), durationMinutes: 120 }] }];

async function withStubbedService(stubs, run) {
  const { defaultF1Service } = await import('../providers/f1/service.ts');
  const previousEnv = Object.fromEntries(envKeys.map((k) => [k, process.env[k]]));
  const originals = Object.fromEntries(methods.map((m) => [m, defaultF1Service[m]]));
  try {
    process.env.POST_RACE_REFRESH_SECRET = SECRET;
    process.env.UPSTASH_REDIS_REST_URL = 'https://example.test';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token';
    delete process.env.STORAGE_PROVIDER;
    for (const [name, fn] of Object.entries(stubs)) defaultF1Service[name] = fn;
    return await run();
  } finally {
    methods.forEach((m) => { defaultF1Service[m] = originals[m]; });
    envKeys.forEach((k) => { if (previousEnv[k] === undefined) delete process.env[k]; else process.env[k] = previousEnv[k]; });
  }
}

const authedRequest = (method = 'GET') => new NextRequest('https://example.test/api/cron/post-race-refresh?season=2026', {
  method,
  headers: { authorization: `Bearer ${SECRET}` },
});

test('post-race refresh fails closed with no secret configured', async () => {
  const previous = process.env.POST_RACE_REFRESH_SECRET;
  try {
    delete process.env.POST_RACE_REFRESH_SECRET;
    assert.equal((await refresh(new NextRequest('https://example.test/api/cron/post-race-refresh'))).status, 401);
  } finally {
    if (previous === undefined) delete process.env.POST_RACE_REFRESH_SECRET; else process.env.POST_RACE_REFRESH_SECRET = previous;
  }
});

test('post-race refresh rejects a wrong secret and query-string credentials', async () => {
  await withStubbedService({}, async () => {
    const wrong = new NextRequest('https://example.test/api/cron/post-race-refresh', { headers: { authorization: 'Bearer wrong' } });
    assert.equal((await refresh(wrong)).status, 401);
    const queryOnly = new NextRequest(`https://example.test/api/cron/post-race-refresh?token=${SECRET}`);
    assert.equal((await refresh(queryOnly)).status, 401);
  });
});

test('outside the six-hour window nothing is force-refreshed', async () => {
  let forcedCalls = 0;
  await withStubbedService({
    getCalendarResult: async (season, force) => {
      assert.equal(force, undefined);
      return { source: 'live', data: outsideWindowCalendar, fetchedAt: new Date().toISOString() };
    },
    getDriverStandingsResult: async () => { forcedCalls++; },
    getConstructorStandingsResult: async () => { forcedCalls++; },
    getLastRaceResultResult: async () => { forcedCalls++; },
  }, async () => {
    const response = await refresh(authedRequest());
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.success, true);
    assert.equal(body.refreshed, false);
    assert.equal(body.reason, 'outside_post_session_window');
    assert.equal(forcedCalls, 0);
  });
});

test('inside the window only results and standings are force-refreshed, never the calendar', async () => {
  const forced = [];
  await withStubbedService({
    getCalendarResult: async (season, force) => {
      assert.equal(force, undefined);
      return { source: 'live', data: inWindowCalendar, fetchedAt: new Date().toISOString() };
    },
    getDriverStandingsResult: async (season, force) => { forced.push(['drivers', season, force]); return { source: 'live', data: [], fetchedAt: new Date().toISOString() }; },
    getConstructorStandingsResult: async (season, force) => { forced.push(['constructors', season, force]); return { source: 'live', data: [], fetchedAt: new Date().toISOString() }; },
    getLastRaceResultResult: async (season, force) => { forced.push(['lastResult', season, force]); return { source: 'live', data: {}, fetchedAt: new Date().toISOString() }; },
    getOverview: async () => ({
      standingsCutoffVerified: true,
      scopeDetail: { driverStandingsRound: 20, constructorStandingsRound: 20 },
      previousRace: { round: 20 },
      hasLatestRaceResult: true,
    }),
  }, async () => {
    const response = await refreshPost(authedRequest('POST'));
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.success, true);
    assert.equal(body.refreshed, true);
    assert.equal(body.reconciled, true);
    assert.equal(body.event.round, 20);
    assert.equal(body.event.type, 'race');
    assert.deepEqual(forced.map(([name]) => name).sort(), ['constructors', 'drivers', 'lastResult']);
    assert.ok(forced.every(([, season, force]) => season === '2026' && force === true));
  });
});

test('an upstream failure inside the window is reported, not masked as success', async () => {
  await withStubbedService({
    getCalendarResult: async () => ({ source: 'live', data: inWindowCalendar, fetchedAt: new Date().toISOString() }),
    getDriverStandingsResult: async () => ({ source: 'live', data: [], fetchedAt: new Date().toISOString() }),
    getConstructorStandingsResult: async () => ({ source: 'lkg', data: [], fetchedAt: new Date().toISOString() }),
    getLastRaceResultResult: async () => ({ source: 'live', data: {}, fetchedAt: new Date().toISOString() }),
    getOverview: async () => ({
      standingsCutoffVerified: false,
      scopeDetail: { driverStandingsRound: 20, constructorStandingsRound: 19 },
      previousRace: { round: 20 },
      hasLatestRaceResult: true,
    }),
  }, async () => {
    const response = await refresh(authedRequest());
    assert.equal(response.status, 503);
    const body = await response.json();
    assert.equal(body.success, false);
    assert.equal(body.summary.constructors.success, false);
    assert.equal(body.summary.drivers.success, true);
    assert.equal(body.reconciled, false);
  });
});

test('an unavailable calendar is reported as an upstream failure', async () => {
  await withStubbedService({
    getCalendarResult: async () => ({ source: 'unavailable', data: [], fetchedAt: undefined }),
  }, async () => {
    const response = await refresh(authedRequest());
    assert.equal(response.status, 503);
    const body = await response.json();
    assert.equal(body.success, false);
    assert.equal(body.error, 'Calendar unavailable');
  });
});
