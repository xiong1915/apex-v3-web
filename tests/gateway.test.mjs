import test from 'node:test';
import assert from 'node:assert/strict';
import rawGatewayWorker from '../cf_worker.js';

const gatewayWorker = rawGatewayWorker?.fetch ? rawGatewayWorker : (rawGatewayWorker?.default || rawGatewayWorker);

test('Apex V3 Web Gateway: 纯反向代理，无 Cron 且不拦截 /api/cron/reminder', async () => {
  // 1. 验证 Worker 导出中没有 scheduled 处理器
  assert.strictEqual(gatewayWorker.scheduled, undefined, '网关 Worker 绝不包含 scheduled cron 触发器');

  // 2. 验证常规请求被正确反向代理至上游并附加网关头
  const origFetch = globalThis.fetch;
  let forwardedReq = null;

  try {
    globalThis.fetch = async (req) => {
      forwardedReq = req;
      return new Response('<html>APEX V3 Web Content</html>', {
        status: 200,
        headers: { 'Content-Type': 'text/html' }
      });
    };

    const req = new Request('https://f1.tike69.cc.cd/races/17', {
      headers: {
        'cf-connecting-ip': '203.0.113.195',
        'user-agent': 'TestAgent/1.0'
      }
    });

    const res = await gatewayWorker.fetch(req, { UPSTREAM_ORIGIN: 'https://f1-race-reminder-cloud.vercel.app' }, {});
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.headers.get('X-Tike-Gateway'), 'Cloudflare-Edge-Native-V3');

    assert.ok(forwardedReq);
    const forwardedUrl = new URL(forwardedReq.url);
    assert.strictEqual(forwardedUrl.pathname, '/races/17');
    assert.strictEqual(forwardedReq.headers.get('X-Real-IP'), '203.0.113.195');
    assert.strictEqual(forwardedReq.headers.get('X-Forwarded-Host'), 'f1.tike69.cc.cd');
  } finally {
    globalThis.fetch = origFetch;
  }
});

test('Apex V3 Web Gateway: /api/cron/reminder 不再被网关拦截接管，直接转发至上游', async () => {
  const origFetch = globalThis.fetch;
  let forwardedUrl = null;

  try {
    globalThis.fetch = async (req) => {
      forwardedUrl = req.url;
      // 模拟上游 Vercel（由于已删除该路由）返回 404 Not Found
      return new Response(JSON.stringify({ error: 'Not Found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    };

    const reminderReq = new Request('https://f1.tike69.cc.cd/api/cron/reminder', {
      headers: { 'Authorization': 'Bearer some-secret' }
    });

    const res = await gatewayWorker.fetch(reminderReq, { UPSTREAM_ORIGIN: 'https://f1-race-reminder-cloud.vercel.app' }, {});
    // 网关不做任何特殊拦截或状态返回，完全保持透明透传
    assert.strictEqual(res.status, 404, '上游 404 应直接穿透返回给调用者，网关绝不原生拦截执行提醒');
    assert.ok(forwardedUrl.includes('/api/cron/reminder'), '请求必须原样转发到上游');
  } finally {
    globalThis.fetch = origFetch;
  }
});
