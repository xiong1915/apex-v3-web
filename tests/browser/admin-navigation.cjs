// No real accounts or admin writes: run only against an isolated local build.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const base = process.env.QA_BASE_URL || 'http://127.0.0.1:3100';
if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(base)) throw Error('Localhost required');
(async () => {
 const browser = await chromium.launch({ headless: true, channel: 'chrome' });
 try {
  const page = await browser.newPage();
  await page.route('**/api/auth/session', r => r.fulfill({ json: { user: { id: 'local-test', email: 'test@example.invalid' }, session: null } }));
  await page.route('**/api/admin/**', r => {
   assert.equal(r.request().method(), 'GET');
   return r.fulfill({ json: r.request().url().endsWith('/status') ? { aal: 'aal2' } : { users: [], total: 0, f1: {}, ai: {}, health: {} } });
  });
  await page.goto(base + '/admin');
  await page.locator('.admin-workspace').waitFor();
  for (const width of [1024, 769, 900, 1100, 1101, 1440, 1920, 768, 390]) {
   await page.setViewportSize({ width, height: 900 });
   const desktop = page.getByRole('button', { name: '网站概览', exact: true });
   assert.equal(await desktop.isVisible(), width > 768, `desktop tabs at ${width}px`);
   const nav = page.locator(width > 768 ? '.admin-tabs' : '.mobile-admin-bottom-nav');
   for (const [label, content] of width > 768
    ? [['用户管理', '真实注册用户'], ['AI 监控与用量', '累计有效提问'], ['F1 数据调度', 'F1 赛事数据管理与手动调度'], ['网站概览', '当前生产版本']]
    : [['用户', '真实注册用户'], ['AI 监控', '累计有效提问'], ['F1 调度', 'F1 赛事数据管理与手动调度'], ['概览', '当前生产版本']]) {
    await nav.getByRole('button', { name: new RegExp(label) }).click();
    await page.getByText(content, { exact: false }).first().waitFor({ state: 'visible' });
    if (width === 1024 && label === 'F1 数据调度' && process.env.QA_ARTIFACT_DIR) {
     await page.screenshot({ path: require('node:path').join(process.env.QA_ARTIFACT_DIR, 'admin-navigation-1024.png') });
    }
   }
   assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
   console.log(`${width}px: all four admin tabs switch`);
  }
 } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
