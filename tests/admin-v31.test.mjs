import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { stripTypeScriptTypes } from 'node:module';
import { createClient } from '@supabase/supabase-js';

// Load actual route/service code while replacing only external boundaries.
function load(file, dependencies, env = {}) {
  const source = fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
  const exported = [...source.matchAll(/export (?:async )?(?:function|class|const) (\w+)/g)].map(match => match[1]);
  const compiled = stripTypeScriptTypes(source, { mode: 'transform' })
    .replace(/import \{([^}]+)\} from ['"]([^'"]+)['"];?/g, 'const {$1} = require("$2");')
    .replace(/import\(['"]([^'"]+)['"]\)/g, 'Promise.resolve(require("$1"))')
    .replace(/export /g, '') + `\nObject.assign(exports, {${exported.join(',')}});`;
  const module = { exports: {} };
  vm.runInNewContext(compiled, { module, exports: module.exports, require(name) {
    if (!(name in dependencies)) throw new Error(`Unexpected dependency: ${name}`);
    return dependencies[name];
  }, process: { env }, console, Date, URL, Promise, Error, Number, Math, Object, Boolean, String, Array, JSON, Buffer }, { filename: file });
  return module.exports;
}
const user = { id: 'admin-id', email: 'admin@example.test' };
const session = { user, access_token: 'validated-token', aal: 'aal1' };
const config = { AUTH_CONFIG: { adminUserId: user.id, cookieName: 'session', refreshCookieName: 'refresh', sessionMaxAge: 3600 }, isValidUuid: () => true, isSupabaseConfigured: () => true, isMockAuthAllowed: () => false, isProduction: () => true };
const response = { json(body, options = {}) { return { body, status: options.status || 200, headers: options.headers || {}, cookies: { set() {} } }; } };
const request = (origin = 'https://app.test', body = {}) => ({ url: 'https://app.test/api/admin/mfa/enroll', nextUrl: new URL('https://app.test/api/admin/mfa/enroll'), headers: new Headers({ origin }), cookies: { get() {} }, json: async () => body });
function service(overrides = {}) {
  return load('lib/admin/service.ts', {
    '@/providers/f1/service': {}, '@/lib/storage': { getCacheStore: () => ({ get: async () => null }) },
    '@/lib/build-info': {}, '@/lib/auth/config': config, '@/lib/auth/mock': {}, '@/lib/auth/server': {},
    './ai-monitor': { providerConfiguration: () => ({}), readAIMonitor: async () => ({ available: true }) },
    ...overrides,
  });
}
test('missing user administration configuration is unavailable rather than an empty database', async () => {
  await assert.rejects(() => service().getAdminUsers(), /不可用|未配置/);
});
test('user count includes every page and a failed later page never returns a partial total', async () => {
  const users = Array.from({ length: 201 }, (_, i) => ({ id: String(i), created_at: '2026-01-01', app_metadata: {} }));
  const deps = {
    '@/lib/auth/config': { ...config, AUTH_CONFIG: { ...config.AUTH_CONFIG, supabaseServiceRoleKey: 'test', supabaseUrl: 'https://auth.test' } },
    '@supabase/supabase-js': { createClient: () => ({ auth: { admin: { listUsers: async ({ page, perPage } = {}) => ({ data: { users: users.slice(((page || 1) - 1) * (perPage || 50), (page || 1) * (perPage || 50)) }, error: null }) } } }) },
  };
  const actual = await service(deps).getAdminUsers();
  assert.equal(actual.total, 201);
  assert.equal(actual.users.length, 201);
  deps['@supabase/supabase-js'].createClient = () => ({ auth: { admin: { listUsers: async ({ page } = {}) => page > 1 ? { error: new Error('storage down') } : { data: { users: users.slice(0, 200) } } } } });
  await assert.rejects(() => service(deps).getAdminUsers());
});
test('AI storage outage never reports zero counters', async () => {
  await assert.rejects(() => service({ '@/lib/storage': { getCacheStore: () => ({ get: async () => { throw new Error('offline'); } }) } }).getAdminAIMetrics());
});
test('AI metrics use strict reads so Redis outages cannot become null and zero', async () => {
  await assert.rejects(() => service({ '@/lib/storage': { getCacheStore: () => ({ get: async () => null, getStrict: async () => { throw new Error('redis down'); } }) } }).getAdminAIMetrics());
});
test('AI metrics start independent storage reads together', async () => {
  const pending = [];
  const result = service({ '@/lib/storage': { getCacheStore: () => ({ get: () => new Promise(resolve => pending.push(resolve)) }) } }).getAdminAIMetrics();
  assert.equal(pending.length, 4);
  pending.forEach(resolve => resolve(null));
  assert.equal((await result).totalRequests, 0);
});
test('overview health verifies storage and F1 availability instead of trusting configuration', async () => {
  const snapshot = { season: '2026', dataSource: 'live', upstreamSyncSuccess: true, isStale: false };
  const read = async (overview, fails = false) => service({
    '@/providers/f1/service': { defaultF1Service: { getOverview: async () => overview } },
    '@/lib/storage': { getStorageInfo: () => ({ connected: true, provider: 'redis' }), getCacheStore: () => ({ getStrict: async () => { if (fails) throw new Error('offline'); return null; } }) },
  }).getAdminOverview();
  assert.equal((await read(snapshot)).health.status, 'healthy');
  const failedStorage = await read(snapshot, true);
  assert.equal(failedStorage.health.storageConnected, false);
  assert.equal(failedStorage.health.status, 'degraded');
  assert.equal((await read({ ...snapshot, dataSource: 'unavailable' })).health.status, 'offline');
  assert.equal((await read({ ...snapshot, dataSource: 'lkg', isStale: true })).health.status, 'degraded');
  assert.equal((await read({ ...snapshot, upstreamSyncSuccess: false })).health.status, 'degraded');
});

function routes({ client, auth = async () => ({ ok: true, user, session }), unavailable = false, allowed = true, credential = async (_, candidate) => candidate?.access_token === 'upgraded' ? { ...session, aal: 'aal2', access_token: 'upgraded' } : null } = {}) {
  const deps = {
    'next/server': { NextResponse: response }, '@/lib/auth/config': config,
    'next/headers': { cookies: async () => ({ getAll: () => [] }) },
    '@/lib/auth/server': { verifyAdminAccess: auth, getServerSession: unavailable ? async () => { throw new Error('auth offline'); } : async () => session },
    '@/lib/auth/verified-session': { verifySessionCredential: credential },
    '@supabase/supabase-js': { createClient: () => client },
    '@/lib/storage': { getRateLimitStore: () => ({ checkRateLimit: async () => ({ allowed }) }) },
    '@/lib/auth/mock': {},
  };
  let helpers;
  try { helpers = load('app/api/admin/_security.ts', deps); } catch (e) { if (e.code !== 'ENOENT') throw e; }
  deps['../../_security'] = helpers;
  deps['../_security'] = helpers;
  deps['@/lib/admin/service'] = { getAdminUsers: async () => { throw new Error('unavailable'); }, getAdminAIMetrics: async () => { throw new Error('unavailable'); }, getAdminOverview: async () => { throw new Error('unavailable'); } };
  deps['@/providers/f1/service'] = {};
  return { helpers, enroll: load('app/api/admin/mfa/enroll/route.ts', deps), status: load('app/api/admin/mfa/status/route.ts', deps), verify: load('app/api/admin/mfa/verify/route.ts', deps), users: load('app/api/admin/users/route.ts', deps), ai: load('app/api/admin/ai/route.ts', deps), overview: load('app/api/admin/overview/route.ts', deps), f1: load('app/api/admin/f1/route.ts', deps) };
}
test('MFA enrollment GET cannot change factors and every response disables caching', async () => {
  const result = await routes().enroll.GET(request());
  assert.equal(result.status, 405);
  assert.match(result.headers['Cache-Control'], /no-store/);
});
test('MFA status trusts validated session AAL only, and auth outages are 503', async () => {
  session.user.app_metadata = { aal: 'aal2' };
  const result = await routes().status.GET(request());
  assert.equal(result.body.isAal2, false);
  const failed = await routes({ unavailable: true, auth: async () => { throw new Error('auth offline'); } }).status.GET(request());
  assert.equal(failed.status, 503);
  assert.match(failed.headers['Cache-Control'], /no-store/);
});
test('MFA POST rejects a cross-origin enrollment without mutating factors', async () => {
  const result = await routes().enroll.POST(request('https://evil.test'));
  assert.equal(result.status, 403);
});
test('verified factors are preserved even when rebind is requested', async () => {
  const client = { auth: { getUser: async () => ({ data: { user } }), mfa: { listFactors: async () => ({ data: { all: [{ id: 'verified', factor_type: 'totp', status: 'verified' }] } }), unenroll: async () => { assert.fail('must never remove verified MFA'); }, enroll: async () => { assert.fail('must not replace verified MFA'); } } } };
  const req = request(); req.nextUrl.searchParams.set('rebind', '1');
  const result = await routes({ client }).enroll.POST(req);
  assert.equal(result.status, 409);
});
test('verification rejects factors not owned by the validated token user', async () => {
  const client = { auth: { getUser: async () => ({ data: { user } }), mfa: { listFactors: async () => ({ data: { all: [{ id: 'mine', factor_type: 'totp', status: 'verified' }] } }), challengeAndVerify: async () => { assert.fail('foreign factor challenged'); } } } };
  const result = await routes({ client }).verify.POST(request('https://app.test', { factorId: 'foreign', code: '123456' }));
  assert.equal(result.status, 400);
});
test('MFA never uses an abandoned enrollment to bypass an existing verified factor', async () => {
  const client = { auth: { getUser: async () => ({ data: { user } }), mfa: { listFactors: async () => ({ data: { all: [{ id: 'verified', factor_type: 'totp', status: 'verified' }, { id: 'abandoned', factor_type: 'totp', status: 'unverified' }] } }), challengeAndVerify: async () => { assert.fail('abandoned secret challenged'); } } } };
  const result = await routes({ client }).verify.POST(request('https://app.test', { factorId: 'abandoned', code: '123456' }));
  assert.equal(result.status, 400);
});
test('MFA blocks throttled requests and mismatching authenticated client identities', async () => {
  assert.equal((await routes({ allowed: false }).verify.POST(request('https://app.test', { code: '123456' }))).status, 429);
  const client = { auth: { getUser: async () => ({ data: { user: { id: 'different-user' } } }), mfa: { listFactors: async () => { assert.fail('wrong identity reached MFA'); } } } };
  assert.equal((await routes({ client }).verify.POST(request('https://app.test', { code: '123456' }))).status, 503);
});
test('verified upgrade must belong to the same user and contain AAL2', async () => {
  const client = { auth: { getUser: async () => ({ data: { user } }), mfa: { listFactors: async () => ({ data: { all: [{ id: 'mine', factor_type: 'totp', status: 'verified' }] } }), challengeAndVerify: async () => ({ data: { access_token: 'upgraded' } }) } } };
  for (const credential of [async () => ({ ...session, aal: 'aal1' }), async () => ({ ...session, aal: 'aal2', user: { id: 'different' } })]) {
    const result = await routes({ client, credential }).verify.POST(request('https://app.test', { code: '123456', factorId: 'mine' }));
    assert.equal(result.status, 503);
  }
});
test('every admin handler converts auth outages to private no-store 503 responses', async () => {
  const handlers = routes({ auth: async () => { throw new Error('auth down'); } });
  for (const name of ['users', 'ai', 'overview', 'f1', 'status']) {
    const result = await handlers[name].GET(request());
    assert.equal(result.status, 503, name);
    assert.match(result.headers['Cache-Control'], /private.*no-store/, name);
  }
  for (const name of ['enroll', 'verify', 'f1']) {
    const result = await handlers[name].POST(request());
    assert.equal(result.status, 503, name);
    assert.match(result.headers['Cache-Control'], /private.*no-store/, name);
  }
});
test('admin storage failures are explicit 503 responses', async () => {
  for (const name of ['users', 'ai', 'overview']) {
    assert.equal((await routes()[name].GET(request())).status, 503);
  }
});
test('real Supabase SDK MFA requests consistently use the validated token', async () => {
  const calls = [];
  const fakeFetch = async (url, init) => {
    calls.push({ path: new URL(url).pathname, authorization: new Headers(init.headers).get('authorization') });
    const path = new URL(url).pathname;
    if (path.endsWith('/user')) return Response.json({ ...user, factors: [{ id: 'mine', factor_type: 'totp', status: 'verified' }] });
    if (path.endsWith('/challenge')) return Response.json({ id: 'challenge', type: 'totp', expires_at: 9999999999 });
    if (path.endsWith('/verify')) return Response.json({ access_token: 'upgraded', refresh_token: 'refresh', token_type: 'bearer', expires_in: 3600, user });
    if (path.endsWith('/factors')) return Response.json({ id: 'new', type: 'totp', totp: { qr_code: '<svg/>', secret: 'test', uri: 'otpauth://test' } });
    assert.fail(`unexpected network request ${path}`);
  };
  const helper = load('app/api/admin/_security.ts', {
    'next/server': { NextResponse: response }, '@/lib/auth/config': { ...config, AUTH_CONFIG: { ...config.AUTH_CONFIG, supabaseUrl: 'https://auth.test', supabaseAnonKey: 'anon-test-key' } },
    '@/lib/auth/server': {}, '@/lib/storage': {},
    '@supabase/supabase-js': { createClient: (url, key, options) => createClient(url, key, { ...options, global: { ...options.global, fetch: fakeFetch } }) },
  });
  const client = await helper.boundMFAClient(session);
  assert.equal((await client.auth.mfa.listFactors()).data.all[0].id, 'mine');
  assert.equal((await client.auth.mfa.enroll({ factorType: 'totp' })).data.id, 'new');
  assert.equal((await client.auth.mfa.challengeAndVerify({ factorId: 'mine', code: '123456' })).data.access_token, 'upgraded');
  assert.ok(calls.some(call => call.path.endsWith('/verify')));
  assert.ok(calls.every(call => call.authorization === 'Bearer validated-token'));
});
test('Redis strict reads preserve failures and production MFA rate limiting fails closed', async () => {
  const { RedisCacheStore, RedisRateLimitStore } = load('lib/storage/redis/index.ts', {
    '@upstash/redis': {}, '../../ai/types': {}, '../interfaces': {},
    '../memory': { MemoryRateLimitStore: class { async checkRateLimit() { return { allowed: true }; } } },
  }, { NODE_ENV: 'production' });
  const redis = { get: async () => { throw new Error('offline'); }, eval: async () => { throw new Error('offline'); } };
  await assert.rejects(() => new RedisCacheStore(redis).getStrict('counter'), /offline/);
  assert.equal((await new RedisRateLimitStore(redis).checkRateLimit('admin:mfa:verify:admin-id', 5, 60)).allowed, false);
});

test('same-origin protection recognizes the existing Cloudflare public origin without trusting forwarded origins', () => {
  const req=request('https://f1.tike69.cc.cd');
  req.url='https://f1-race-reminder-cloud.vercel.app/api/admin/mfa/enroll';
  assert.equal(routes().helpers.sameOrigin(req),true);
  const hostile=request('https://evil.test');
  hostile.headers.set('x-forwarded-host','evil.test');
  assert.equal(routes().helpers.sameOrigin(hostile),false);
});