// Isolated local fixtures only. No real credentials, admin mutations, or screenshots.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const base = process.env.QA_BASE_URL || 'http://127.0.0.1:3100';
if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(base)) throw new Error('Localhost required');

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const protectedReads = [];
    const enrollMethods = [];
    let usersAvailable = false, aiState = 'unavailable';
    await page.route('**/api/auth/session', route => route.fulfill({ json: { user: { id: 'local-admin', email: 'admin@example.invalid' }, session: null } }));
    await page.route('**/api/admin/**', route => {
      const path = new URL(route.request().url()).pathname;
      if (path.endsWith('/mfa/status')) return route.fulfill({ json: { isAdmin: true, aal: 'aal1', isAal2: false } });
      if (path.endsWith('/mfa/enroll')) {
        enrollMethods.push(route.request().method());
        return route.fulfill({ json: { enrolled: true, verified: true, factorId: 'local-factor' } });
      }
      if (path.endsWith('/mfa/verify')) return route.fulfill({ json: { success: true, aal: 'aal2' } });
      protectedReads.push(path);
      if (path.endsWith('/f1') && route.request().method() === 'POST') return route.fulfill({status:403,contentType:'text/html',body:'Forbidden'});
      if (path.endsWith('/overview')) return route.fulfill({ json: { health: { status: 'healthy', storageConnected: true }, deployment: { buildId: 'fixture-build-private', environment: 'test', vercelEnv: 'test', deployedAt: '2026-01-01T00:00:00Z' }, f1: {} } });
      if (path.endsWith('/users')) return route.fulfill({ status: usersAvailable ? 200 : 503, json: usersAvailable ? { total: 0, users: [] } : { error: '用户目录测试不可用' } });
      if (path.endsWith('/ai') && aiState === 'permission') return route.fulfill({status:403,contentType:'text/html',body:'<h1>Forbidden by gateway</h1>'});
      if (path.endsWith('/ai')) return route.fulfill({ status: aiState === 'permission' ? 403 : aiState === 'unavailable' ? 503 : 200, json: aiState === 'ok' ? { totalRequests: 42, estimatedTokens: 84, rateLimitHits: 0, limits: {}, provider: 'fixture', model: 'fixture', monitoring: { available: false } } : { error: 'AI 测试暂不可用' } });
      return route.fulfill({ json: { season: '2026' } });
    });
    await page.goto(`${base}/admin`);
    await page.getByText('TOTP 双重身份验证 (AAL2) 未就绪', { exact: true }).waitFor();
    assert.equal(protectedReads.length, 0, 'AAL1 must not read private data');
    assert.equal(enrollMethods.length, 0, 'AAL1 must not enroll automatically');
    assert.equal(await page.getByRole('heading', { name: '绑定 TOTP 双重验证器', exact: true }).count(), 0);
    await page.getByRole('button', { name: 'TOTP 绑定 / 验证', exact: true }).click();
    await page.getByRole('heading', { name: 'TOTP 双重身份验证 (AAL2)', exact: true }).waitFor();
    assert.deepEqual(enrollMethods, ['POST']);
    assert.equal(await page.getByText('更换 / 重新绑定手机验证器', { exact: true }).count(), 0);
    await page.getByPlaceholder('000000').fill('123456');
    await page.getByRole('button', { name: '确认授权', exact: true }).click();
    await page.getByText('fixture-build-private', { exact: true }).waitFor();
    await page.getByRole('button', { name: /用户管理/ }).click();
    await page.getByText('用户目录测试不可用', { exact: true }).waitFor();
    assert.equal(await page.getByText('暂无注册用户', { exact: true }).count(), 0, '503 must not become empty users');
    assert.equal(await page.getByText(/真实注册用户/).count(), 0);
    usersAvailable = true;
    await page.getByRole('button', { name: '重试读取', exact: true }).click();
    await page.getByText('暂无注册用户', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'AI 监控与用量', exact: true }).click();
    aiState = 'ok';
    await page.getByRole('button', { name: '刷新 AI 数据', exact: true }).click();
    await page.locator('.monitor-stats').getByText('42', { exact: true }).waitFor();
    aiState = 'permission';
    await page.getByRole('button', { name: '刷新 AI 数据', exact: true }).click();
    await page.getByText('TOTP 双重身份验证 (AAL2) 未就绪', { exact: true }).waitFor();
    assert.equal(await page.locator('.monitor-stats').count(), 0, 'permission failure must clear private metrics');
    await page.getByRole('button', { name: '网站概览', exact: true }).click();
    assert.equal(await page.getByText('fixture-build-private', { exact: true }).count(), 0, 'permission failure must clear all private stats');

    aiState='ok';
    await page.getByRole('button',{name:'TOTP 绑定 / 验证',exact:true}).click();
    await page.getByPlaceholder('000000').fill('123456');
    await page.getByRole('button',{name:'确认授权',exact:true}).click();
    await page.getByText('fixture-build-private',{exact:true}).waitFor();
    await page.getByRole('button',{name:'F1 数据调度',exact:true}).click();
    await page.getByRole('button',{name:'立即手动同步',exact:true}).click();
    await page.getByText('TOTP 双重身份验证 (AAL2) 未就绪',{exact:true}).waitFor();
    await page.getByRole('button',{name:'网站概览',exact:true}).click();
    assert.equal(await page.getByText('fixture-build-private',{exact:true}).count(),0,'sync HTML403 must clear loaded private panels');
    const outagePage = await browser.newPage();
    await outagePage.route('**/api/auth/session', route => route.fulfill({ json: { user: { id: 'local-admin' }, session: null } }));
    await outagePage.route('**/api/admin/mfa/status', route => route.fulfill({ status: 503, json: { error: '身份测试暂不可用' } }));
    await outagePage.goto(`${base}/admin`);
    await outagePage.getByRole('alert').filter({ hasText: '身份测试暂不可用' }).waitFor();
    assert.equal(await outagePage.getByText('访问被拒绝 (403 Forbidden)', { exact: true }).count(), 0);
    console.log('Admin V3.1: AAL1 read gate, explicit POST enrollment, error/empty states, permission clearing, auth outage passed');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
