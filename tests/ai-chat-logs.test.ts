import test from 'node:test';
import assert from 'node:assert/strict';
import { extractClientIp } from '../lib/auth/client-ip';
import {
  recordAIChatLog,
  getAdminAIChatLogs,
  resetMemoryAIChatLogs,
  type RecordAIChatLogInput
} from '../lib/admin/ai-chat-logs';
import { NextRequest } from 'next/server';
import { GET as getAdminLogsRoute } from '../app/api/admin/ai/logs/route';

test('extractClientIp correctly parses Cloudflare cf-connecting-ip and proxy headers', () => {
  // 1. cf-connecting-ip (Cloudflare Edge)
  const h1 = new Headers();
  h1.set('cf-connecting-ip', '203.0.113.195');
  assert.equal(extractClientIp(h1), '203.0.113.195');

  // 2. x-vercel-forwarded-for
  const h2 = new Headers();
  h2.set('x-vercel-forwarded-for', '198.51.100.42, 10.0.0.1');
  assert.equal(extractClientIp(h2), '198.51.100.42');

  // 3. x-forwarded-for fallback
  const h3 = new Headers();
  h3.set('x-forwarded-for', '192.0.2.1, 127.0.0.1');
  assert.equal(extractClientIp(h3), '192.0.2.1');

  // 4. x-real-ip fallback
  const h4 = new Headers();
  h4.set('x-real-ip', '198.51.100.99');
  assert.equal(extractClientIp(h4), '198.51.100.99');

  // 5. localhost fallback
  const h5 = new Headers();
  h5.set('host', 'localhost:3000');
  assert.equal(extractClientIp(h5), '127.0.0.1');

  // 6. Unknown fallback
  const h6 = new Headers();
  assert.equal(extractClientIp(h6), 'unknown');
});

test('ai-chat-logs correctly records, filters by userId, and calculates pagination', async () => {
  resetMemoryAIChatLogs();

  const userA: RecordAIChatLogInput = {
    userId: 'user-uuid-1',
    userEmail: 'user1@example.com',
    userDisplayName: 'Max',
    clientIp: '114.242.25.10',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X)',
    messages: [
      { role: 'user', content: '2026年澳大利亚大奖赛谁赢了？' }
    ],
    response: '2026赛季澳大利亚大奖赛由勒克莱尔夺得冠军。',
    model: 'deepseek-chat',
    tokensEstimated: 120,
    durationMs: 1420,
    outcome: 'success'
  };

  const userB: RecordAIChatLogInput = {
    userId: 'user-uuid-2',
    userEmail: 'user2@example.com',
    userDisplayName: 'Charles',
    clientIp: '223.104.45.67',
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS)',
    messages: [
      { role: 'user', content: '法拉利车队目前积分多少？' },
      { role: 'assistant', content: '法拉利车队目前积 320 分。' },
      { role: 'user', content: '那红牛呢？' }
    ],
    response: '红牛车队目前积 315 分。',
    model: 'deepseek-chat',
    tokensEstimated: 250,
    durationMs: 1850,
    outcome: 'success'
  };

  await recordAIChatLog(userA);
  await recordAIChatLog(userB);

  // 1. 查询全部日志
  const allLogs = await getAdminAIChatLogs({ limit: 10 });
  assert.equal(allLogs.total, 2);
  assert.equal(allLogs.logs.length, 2);
  // 最新的排在最前面 (userB 后录入)
  assert.equal(allLogs.logs[0].userId, 'user-uuid-2');
  assert.equal(allLogs.logs[0].clientIp, '223.104.45.67');
  assert.equal(allLogs.logs[0].messages.length, 3);
  assert.equal(allLogs.logs[1].userId, 'user-uuid-1');
  assert.equal(allLogs.logs[1].clientIp, '114.242.25.10');

  // 2. 按特定 userId 筛选
  const user1Logs = await getAdminAIChatLogs({ userId: 'user-uuid-1' });
  assert.equal(user1Logs.total, 1);
  assert.equal(user1Logs.logs[0].userId, 'user-uuid-1');
  assert.equal(user1Logs.logs[0].userDisplayName, 'Max');
  assert.equal(user1Logs.logs[0].userEmail, 'user1@example.com');
  assert.equal(user1Logs.logs[0].clientIp, '114.242.25.10');
  assert.equal(user1Logs.logs[0].response, '2026赛季澳大利亚大奖赛由勒克莱尔夺得冠军。');

  // 3. 不存在的用户
  const emptyLogs = await getAdminAIChatLogs({ userId: 'user-uuid-999' });
  assert.equal(emptyLogs.total, 0);
  assert.equal(emptyLogs.logs.length, 0);
});

test('admin ai logs API protects against unauthenticated requests', async () => {
  const req = new NextRequest('http://localhost:3000/api/admin/ai/logs');
  const res = await getAdminLogsRoute(req);
  assert.equal(res.status, 401);
  const json = await res.json();
  assert.ok(json.error);
});
