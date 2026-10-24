// tests/browser/profile.cjs
// APEX V3 — APEX ID 个人中心多端端到端浏览器自动化验收测试
// 覆盖 375px / 390px / 768px / 1440px / 1920px 视口、水平溢出检测与组件交互

const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');

let pwModule = process.env.PLAYWRIGHT_MODULE || 'playwright';
let chromium;
try {
  chromium = require(pwModule).chromium;
} catch {
  chromium = require('C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright').chromium;
}

const base = process.env.QA_BASE_URL || 'http://127.0.0.1:3100';
if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(base)) {
  throw new Error('Localhost server required for QA browser tests');
}

const out = process.env.QA_ARTIFACT_DIR || path.join(process.cwd(), '.qa-screenshots');
fs.mkdirSync(out, { recursive: true });

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));

    // 1. Mock 身份会话与个人资料
    let currentDisplayName = '费尔南多·阿隆索';
    let currentFavoriteTeams = ['aston_martin'];
    let currentAvatarUrl = null;

    await page.route('**/api/auth/session', (route) => {
      route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        json: {
          user: {
            id: 'fa14-alonso-uuid',
            email: 'fernando.alonso@astonmartin.f1',
            user_metadata: { name: '费尔南多·阿隆索' },
            app_metadata: { provider: 'email' },
            created_at: '2026-01-01T00:00:00.000Z'
          },
          session: { access_token: 'mock-token' }
        }
      });
    });

    await page.route('**/api/profile', (route) => {
      const method = route.request().method();
      if (method === 'GET') {
        return route.fulfill({
          status: 200,
          headers: { 'Content-Type': 'application/json' },
          json: {
            profile: {
              id: 'fa14-alonso-uuid',
              email: 'fernando.alonso@astonmartin.f1',
              display_name: currentDisplayName,
              avatar_url: currentAvatarUrl,
              avatar_path: currentAvatarUrl ? 'fa14-alonso-uuid/avatar-mock.png' : null,
              favorite_team_ids: currentFavoriteTeams,
              provider: 'email',
              created_at: '2026-01-01T00:00:00.000Z',
              updated_at: '2026-03-01T00:00:00.000Z'
            }
          }
        });
      }

      if (method === 'PATCH') {
        const body = JSON.parse(route.request().postData() || '{}');
        if (body.display_name !== undefined) currentDisplayName = body.display_name;
        if (body.favorite_team_ids !== undefined) currentFavoriteTeams = body.favorite_team_ids;

        return route.fulfill({
          status: 200,
          headers: { 'Content-Type': 'application/json' },
          json: {
            profile: {
              id: 'fa14-alonso-uuid',
              email: 'fernando.alonso@astonmartin.f1',
              display_name: currentDisplayName,
              avatar_url: currentAvatarUrl,
              avatar_path: currentAvatarUrl ? 'fa14-alonso-uuid/avatar-mock.png' : null,
              favorite_team_ids: currentFavoriteTeams,
              provider: 'email',
              created_at: '2026-01-01T00:00:00.000Z',
              updated_at: new Date().toISOString()
            }
          }
        });
      }

      route.continue();
    });

    await page.route('**/api/profile/avatar', (route) => {
      const method = route.request().method();
      if (method === 'POST') {
        currentAvatarUrl = '/api/profile/avatar/view?path=fa14-alonso-uuid/avatar-mock.png';
        return route.fulfill({
          status: 200,
          json: {
            profile: {
              id: 'fa14-alonso-uuid',
              email: 'fernando.alonso@astonmartin.f1',
              display_name: currentDisplayName,
              avatar_url: currentAvatarUrl,
              avatar_path: 'fa14-alonso-uuid/avatar-mock.png',
              favorite_team_ids: currentFavoriteTeams,
              provider: 'email',
              created_at: '2026-01-01T00:00:00.000Z',
              updated_at: new Date().toISOString()
            }
          }
        });
      }
      if (method === 'DELETE') {
        currentAvatarUrl = null;
        return route.fulfill({
          status: 200,
          json: {
            profile: {
              id: 'fa14-alonso-uuid',
              email: 'fernando.alonso@astonmartin.f1',
              display_name: currentDisplayName,
              avatar_url: null,
              avatar_path: null,
              favorite_team_ids: currentFavoriteTeams,
              provider: 'email',
              created_at: '2026-01-01T00:00:00.000Z',
              updated_at: new Date().toISOString()
            }
          }
        });
      }
      route.continue();
    });

    // 2. 访问 /profile 页面
    await page.goto(base + '/profile', { waitUntil: 'domcontentloaded' });
    await page.locator('.profile-page-shell').waitFor({ state: 'visible', timeout: 15000 });
    await page.locator('.identity-card').waitFor({ state: 'visible', timeout: 10000 });

    // 3. 验证 5 种视口尺寸的适配与水平溢出
    const viewports = [375, 390, 768, 1440, 1920];
    for (const width of viewports) {
      const height = width < 768 ? 844 : 960;
      await page.setViewportSize({ width, height });
      await page.waitForTimeout(150);

      // A. 严格水平溢出防御 (移动端与桌面端不得出现横向滚动条)
      const isOverflowing = await page.evaluate(() => {
        return document.documentElement.scrollWidth > window.innerWidth + 1;
      });
      assert.equal(isOverflowing, false, `Viewport ${width}px exhibits horizontal overflow`);

      // B. 身份卡片与输入框验证
      const input = page.locator('#nickname-input');
      await input.waitFor({ state: 'visible' });
      const val = await input.inputValue();
      assert.equal(val, '费尔南多·阿隆索');

      // C. 按钮移动端触摸高度 (>= 44px) 验证
      if (width <= 640) {
        const btnBox = await page.locator('.apex-btn-primary').first().boundingBox();
        assert.ok(btnBox && btnBox.height >= 44, `Primary button height at ${width}px must be >= 44px (got ${btnBox ? btnBox.height : 0})`);
      }

      // D. 导出高清截屏
      const screenshotPath = path.join(out, `profile-${width}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: false });
      console.log(`[QA Profile Browser] Verified ${width}px viewport, saved screenshot: ${screenshotPath}`);
    }

    // 4. 交互测试：车队卡片勾选与保存偏好
    const ferrariCard = page.locator('.team-card').filter({ hasText: '法拉利' }).first();
    await ferrariCard.scrollIntoViewIfNeeded();
    await ferrariCard.click();
    await page.waitForTimeout(150);

    // 点击保存偏好
    const saveTeamsBtn = page.getByRole('button', { name: '保存偏好' });
    await saveTeamsBtn.click();
    await page.locator('text=✓ 车队偏好已持久化').waitFor({ state: 'visible', timeout: 5000 });
    console.log('[QA Profile Browser] Verified favorite teams toggle and persistence notification');

    // 5. 交互测试：修改昵称并保存
    const nicknameInput = page.locator('#nickname-input');
    await nicknameInput.fill('两届世界冠军阿隆索');
    const saveNicknameBtn = page.getByRole('button', { name: '保存昵称' });
    await saveNicknameBtn.click();
    await page.locator('text=✓ 昵称已更新并同步全站').waitFor({ state: 'visible', timeout: 5000 });
    console.log('[QA Profile Browser] Verified nickname modification and synchronization feedback');

    assert.equal(errors.length, 0, `Page errors detected: ${errors.join(', ')}`);
    console.log('PASS: APEX ID profile browser test passed across all 5 viewports with zero page errors');
  } finally {
    await browser.close();
  }
})().catch((err) => {
  console.error('[QA Profile Browser FAILED]', err);
  process.exitCode = 1;
});
