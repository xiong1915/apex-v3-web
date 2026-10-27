import test from 'node:test';
import assert from 'node:assert/strict';
import { extractClientIp } from '../lib/auth/client-ip';
import {
  recordAIChatLog,
  getAdminAIChatLogs,
  resetMemoryAIChatLogs,
  type RecordAIChatLogInput
} from '../lib/admin/ai-chat-logs';
import { parseUserPersona } from '../lib/admin/user-persona';
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

test('parseUserPersona accurately identifies OS, browser, device, and hardware signals', () => {
  // 1. Windows 10/11 x64 PC Chrome
  const winUA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36';
  const p1 = parseUserPersona(winUA, {
    screen: '1920x1080',
    viewport: '1440x820',
    dpr: 1.25,
    cores: 16,
    memory: 16,
    touch: false,
    language: 'zh-CN',
    colorScheme: 'light',
    country: 'CN'
  }, '54.178.4.224');

  assert.equal(p1.os.name, 'Windows 10 / 11');
  assert.equal(p1.os.architecture, '64位 (x64)');
  assert.equal(p1.browser.name, 'Google Chrome');
  assert.equal(p1.browser.version, '155.0');
  assert.equal(p1.device.type, 'desktop');
  assert.equal(p1.hardware.cores, 16);
  assert.equal(p1.hardware.memoryGb, 16);
  assert.equal(p1.hardware.touch, false);
  assert.equal(p1.display.screenResolution, '1920 × 1080');
  assert.equal(p1.display.pixelRatio, 1.25);
  assert.equal(p1.environment.ip, '54.178.4.224');
  assert.equal(p1.environment.country, 'CN');

  // 2. iPhone Safari iOS 18
  const iosUA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1';
  const p2 = parseUserPersona(iosUA, {
    screen: '390x844',
    dpr: 3,
    touch: true
  }, '114.242.25.10');

  assert.equal(p2.os.name, 'iOS (iPhone)');
  assert.equal(p2.os.version, '18.1');
  assert.equal(p2.browser.name, 'Apple Safari');
  assert.equal(p2.browser.version, '18.1');
  assert.equal(p2.device.type, 'mobile');
  assert.equal(p2.hardware.touch, true);

  // 3. Android WeChat WebView
  const wechatUA = 'Mozilla/5.0 (Linux; Android 14; SM-S928B Build/UP1A.231005.007; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/122.0.6261.119 Mobile Safari/537.36 MicroMessenger/8.0.48.2580(0x28003036)';
  const p3 = parseUserPersona(wechatUA);

  assert.equal(p3.os.name, 'Android');
  assert.equal(p3.os.version, '14');
  assert.equal(p3.browser.name, '微信内置浏览器');
  assert.equal(p3.device.type, 'mobile');
  assert.equal(p3.device.model, 'SM-S928B');
});
