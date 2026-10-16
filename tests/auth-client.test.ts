import test from 'node:test';
import assert from 'node:assert/strict';
import { apiLogout } from '../lib/auth/client';

test('logout reports server and network failures rather than pretending to log out', async t => {
  t.mock.method(globalThis, 'fetch', async () => new Response('', {status:503}));
  await assert.rejects(apiLogout(), /退出登录失败/);
  t.mock.method(globalThis, 'fetch', async () => {throw new Error('Offline');});
  await assert.rejects(apiLogout(), /Offline/);
});

test('logout completes only after the server accepts it', async t => {
  t.mock.method(globalThis, 'fetch', async (url: RequestInfo | URL, init?: RequestInit) => {
    assert.equal(url, '/api/auth/logout');
    assert.equal(init?.method, 'POST');
    return new Response(null, {status:204});
  });
  await apiLogout();
});
