// tests/auth-callback.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { GET } from '../app/auth/callback/route';

test('OAuth callback error handling and safe redirect', async (t) => {
  await t.test('1. access_denied produces friendly cancellation notice', async () => {
    const req = new NextRequest('https://f1.tike69.cc.cd/auth/callback?error=access_denied&error_description=User+cancelled');
    const res = await GET(req);
    assert.equal(res.status, 307);
    const location = res.headers.get('location') || '';
    assert.ok(location.includes('/login?error='));
    const url = new URL(location);
    assert.match(url.searchParams.get('error') || '', /已取消第三方授权登录/);
  });

  await t.test('2. Missing code returns error notice', async () => {
    const req = new NextRequest('https://f1.tike69.cc.cd/auth/callback');
    const res = await GET(req);
    assert.equal(res.status, 307);
    const location = res.headers.get('location') || '';
    const url = new URL(location);
    assert.match(url.searchParams.get('error') || '', /缺少有效 OAuth 授权码/);
  });

  await t.test('3. Other OAuth provider error produces readable error', async () => {
    const req = new NextRequest('https://f1.tike69.cc.cd/auth/callback?error=server_error&error_description=Upstream+failed');
    const res = await GET(req);
    assert.equal(res.status, 307);
    const location = res.headers.get('location') || '';
    const url = new URL(location);
    assert.equal(url.searchParams.get('error'), 'Upstream failed');
  });
});
