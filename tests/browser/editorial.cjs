// Acceptance runs only against an isolated local build. Authenticated views use local fixtures.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.QA_BASE_URL || 'http://127.0.0.1:3100';
if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(base)) throw new Error('Localhost required');
const out = process.env.QA_ARTIFACT_DIR || path.join(require('node:os').tmpdir(), 'apex-editorial');
fs.mkdirSync(out, { recursive: true });
const results = { routes: [], checks: [], errors: [] };
const widths = [375, 390, 768, 1440, 1920];
(async () => {
 const browser = await chromium.launch({ headless: true, channel: 'chrome' });
 try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.on('pageerror', e => results.errors.push(e.message));
  async function capture(name, route, expected = 200) {
   const response = await page.goto(base + route, { waitUntil: 'domcontentloaded' });
   assert.equal(response.status(), expected, route);
   await page.locator('.home-loading').waitFor({ state: 'detached' });
   await page.waitForTimeout(450);
   for (const width of widths) {
    await page.setViewportSize({ width, height: width < 768 ? 844 : 1000 });
    await page.waitForTimeout(350);
    const scroll = await page.evaluate(() => document.documentElement.scrollWidth);
    results.routes.push({ route, width, status: response.status(), scroll });
    assert.ok(scroll <= width + 1, `${route}: ${scroll}px at ${width}px`);
    if (name === 'login') {
     assert.equal(await page.locator('.auth-frame').evaluate(e => getComputedStyle(e).display), 'grid');
     assert.equal(await page.locator('.auth-intro').isVisible(), width >= 768);
    }
    if (name === 'system') assert.equal(await page.locator('.system-layout').evaluate(e => getComputedStyle(e).display), 'grid');
    if ([390, 1440].includes(width) || name === 'home') {
     await page.screenshot({ path: path.join(out, `${name}-${width}.png`) });
     if (width === 1440) await page.screenshot({ path: path.join(out, `${name}-full.png`), fullPage: true });
    }
   }
  }
  for (const [name, route] of [
   ['home', '/'], ['races', '/races'], ['standings', '/standings'], ['drivers', '/drivers'],
   ['teams', '/teams'], ['race-detail', '/races/1'], ['driver-detail', '/drivers/antonelli'],
   ['team-detail', '/teams/mercedes'], ['login', '/login'], ['register', '/register'],
   ['forgot-password', '/forgot-password'], ['reset-password', '/reset-password'],
   ['system', '/system'], ['live', '/live']
  ]) await capture(name, route);
  assert.equal((await page.request.get(base+'/replay?season=2026&round=18', {maxRedirects:0})).status(),308);
  assert.equal((await page.request.get(base+'/api/f1/replay')).status(),410);
  results.checks.push('legacy replay redirects to live; retired replay API returns Gone');
  await capture('not-found', '/not-a-real-apex-page', 404);
  await page.goto(base);
  await page.locator('.home-loading').waitFor({ state: 'detached' });
  assert.equal(await page.locator('.start-sequence').count(), 0);
  const tabs = page.getByRole('tab');
  await tabs.nth(0).focus(); await page.keyboard.press('ArrowRight');
  assert.equal(await tabs.nth(1).getAttribute('aria-selected'), 'true');
  await page.keyboard.press('Home');
  assert.equal(await tabs.nth(0).getAttribute('aria-selected'), 'true');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: '切换导航菜单' }).click();
  await page.getByRole('dialog').waitFor();
  assert.equal(await page.locator('main').evaluate(e => e.inert), true);
  await page.screenshot({ path: path.join(out, 'mobile-menu.png') });
  await page.keyboard.press('Shift+Tab');
  assert.equal(await page.getByRole('dialog').evaluate(e => e.contains(document.activeElement)), true);
  await page.keyboard.press('Escape');
  assert.equal(await page.getByRole('dialog').count(), 0);
  assert.equal(await page.locator('main').evaluate(e => e.inert), false);
  results.checks.push('championship keyboard tabs; mobile focus trap and Escape');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  assert.equal(await page.locator('.page-transition').evaluate(e => getComputedStyle(e).animationName), 'none');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto(base + '/standings');
  await page.getByRole('combobox', { name: '选择赛季：' }).selectOption('2004');
  await page.waitForURL('**/standings?season=2004');
  await page.getByRole('heading', { name: '车手锦标赛' }).waitFor();
  assert.equal(await page.locator('.data-table a[href^="/drivers/"], .data-table a[href^="/teams/"]').count(), 0);
  results.checks.push('historical season preserves historical records without current-profile links');
  await page.goto(base + '/login');
  await page.locator('input[type=email]').focus();
  await page.keyboard.press('Tab');
  assert.notEqual(await page.evaluate(() => getComputedStyle(document.activeElement).outlineStyle), 'none');
  await page.screenshot({ path: path.join(out, 'login-keyboard-focus.png') });
  await page.goto(base + '/ai'); await page.waitForURL('**/login?returnUrl=/ai');
  const anonymousAdmin = await page.request.get(base + '/api/admin/overview');
  assert.equal(anonymousAdmin.status(), 503, 'isolated build has no identity-service configuration');
  assert.match(anonymousAdmin.headers()['cache-control'], /private.*no-store/);
  assert.equal((await anonymousAdmin.json()).error, '后台概览暂不可用，请稍后重试');
  results.checks.push('visible keyboard focus; anonymous AI/login and admin API gates');
  await page.route('**/api/auth/session', r => r.fulfill({ json: { user: { id: 'browser-test', email: 'browser@example.invalid' }, session: null } }));
  let fixtureHistory = null;
  await page.route('**/api/ai/conversations*', r => {
   if (r.request().method() === 'GET') return r.fulfill({ json: { conversations: [] } });
   fixtureHistory = { id: '00000000-0000-4000-8000-000000000001', title: '浏览器验收对话', revision: (fixtureHistory?.revision || 0) + 1, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), messages: r.request().postDataJSON().messages || [] };
   return r.fulfill({ json: { conversation: fixtureHistory } });
  });
  await page.route('**/api/ai/chat', r => r.fulfill({ contentType: 'text/event-stream', body: 'data: {"type":"delta","content":"浏览器测试：策略解读。"}\n\ndata: {"type":"done"}\n\n' }));
  await capture('ai-local-fixture', '/ai');
  const input = page.getByRole('textbox', { name: '向 APEX AI 提问' });
  await input.fill('解释轮胎策略'); await input.press('Enter');
  await page.getByText('浏览器测试：策略解读。', { exact: true }).waitFor();
  await page.screenshot({ path: path.join(out, 'ai-stream-local-fixture.png') });
  await page.route('**/api/ai/chat', async r => {
   await new Promise(resolve => setTimeout(resolve, 1500));
   await r.fulfill({ status: 503, json: { error: '本地验收：服务暂不可用，请重试。' } });
  });
  await input.fill('验证失败后的恢复操作'); await input.press('Enter');
  await page.getByText('正在判断问题类型…', {exact:true}).waitFor();
  await page.screenshot({ path: path.join(out, 'ai-loading-local-fixture.png') });
  await page.getByRole('button', { name: '重试', exact: true }).waitFor();
  await page.screenshot({ path: path.join(out, 'ai-error-local-fixture.png') });
  await page.route('**/api/admin/**', r => {
   const isEnroll = new URL(r.request().url()).pathname.endsWith('/enroll');
   assert.equal(r.request().method(), isEnroll ? 'POST' : 'GET', 'only explicit local MFA enrollment fixture may POST');
   const endpoint = new URL(r.request().url()).pathname;
   return r.fulfill({ json: endpoint.endsWith('/status') ? { aal: 'aal2' } : endpoint.endsWith('/enroll') ? { verified: true } : { users: [], total: 0, f1: {}, ai: {}, health: {} } });
  });
  await capture('admin-local-fixture', '/admin');
  for (const [name, label] of [['users', '用户管理'], ['ai', 'AI 监控与用量'], ['f1', 'F1 数据调度']]) {
   await page.getByRole('button', { name: new RegExp(label) }).first().click();
   await page.screenshot({ path: path.join(out, `admin-${name}-local-fixture.png`) });
  }
  await page.route('**/api/admin/mfa/status', r => r.fulfill({ json: { aal: 'aal1' } }));
  await page.reload();
  await page.getByRole('button', {name:'TOTP 绑定 / 验证',exact:true}).click();
  const code = page.locator('input[autocomplete="one-time-code"]');
  await code.waitFor(); await code.fill('123456');
  assert.equal(await code.evaluate(e => getComputedStyle(e).color), 'rgb(23, 25, 29)');
  await page.screenshot({ path: path.join(out, 'admin-mfa-local-fixture.png') });
  results.checks.push('local-only AI streaming and admin layout fixtures; no real account writes');
  assert.deepEqual(results.errors, []);
  fs.writeFileSync(path.join(out, 'acceptance.json'), JSON.stringify(results, null, 2));
  console.log(JSON.stringify({ checks: results.checks, responsiveChecks: results.routes.length, errors: results.errors }));
 } finally { await browser.close(); }
})().catch(e => { fs.writeFileSync(path.join(out, 'acceptance-partial.json'), JSON.stringify({ ...results, error: e.stack }, null, 2)); console.error(e); process.exitCode = 1; });
