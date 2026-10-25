import test from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { GET } from '../app/api/auth/session/route';
test('signed-out and expired sessions are always private and never shared cached', async () => {
 for (const cookie of ['', 'apex_session_created_at=1']) {
  const response=await GET(new NextRequest('https://f1.tike69.cc.cd/api/auth/session', {headers:{cookie}}));
  assert.match(response.headers.get('cache-control') || '', /private/);
  assert.match(response.headers.get('cache-control') || '', /no-store/);
 }
});
