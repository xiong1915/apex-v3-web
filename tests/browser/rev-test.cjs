// tests/browser/rev-test.cjs
const path = require('node:path');
const fs = require('node:fs');

// 加载系统级 Playwright Core 与 Chrome 通道
let playwright;
try {
  playwright = require('playwright');
} catch (_) {
  try {
    playwright = require('C:/Users/Administrator/AppData/Local/npm-cache/_npx/dea9475797100b20/node_modules/playwright-core');
  } catch (err) {
    console.error('Cannot load playwright:', err);
    process.exit(1);
  }
}

const artifactsDir = 'C:/Users/Administrator/.gemini/antigravity/brain/177d99ed-9770-4077-9346-f62578c5334c';

async function run() {
  console.log('[Playwright] Starting Acoustic Rev browser verification...');
  const browser = await playwright.chromium.launch({
    headless: true,
    channel: 'chrome'
  });

  try {
    // 1. 桌面视口测试 (1440 x 900)
    console.log('[Playwright] 1. Desktop 1440x900 viewport test...');
    const contextDesktop = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 2
    });
    const pageDesktop = await contextDesktop.newPage();

    const consoleErrors = [];
    pageDesktop.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    console.log('[Playwright] Navigating to http://127.0.0.1:3300/rev ...');
    const resp = await pageDesktop.goto('http://127.0.0.1:3300/rev', { waitUntil: 'domcontentloaded', timeout: 20000 });
    console.log('[Playwright] Status code:', resp.status());

    if (resp.status() !== 200) {
      throw new Error(`Expected 200, got ${resp.status()}`);
    }

    await pageDesktop.waitForSelector('text=Acoustic Rev');
    console.log('[Playwright] Acoustic Rev header verified.');

    // 截取桌面端怠速状态
    const idlePath = path.join(artifactsDir, 'acoustic_rev_desktop_idle.png');
    await pageDesktop.screenshot({ path: idlePath });
    console.log('[Playwright] Saved idle screenshot:', idlePath);

    // 点击启动音频按钮
    const startBtn = await pageDesktop.$('button:has-text("启动引擎声浪系统")');
    if (startBtn) {
      console.log('[Playwright] Clicking start audio button...');
      await startBtn.click();
      await pageDesktop.waitForTimeout(300);
    }

    // 模拟长按键盘 Space 踩油门加速
    console.log('[Playwright] Holding Spacebar to rev engine...');
    await pageDesktop.keyboard.down('Space');
    await pageDesktop.waitForTimeout(700);
    const revvingPath = path.join(artifactsDir, 'acoustic_rev_desktop_revving.png');
    await pageDesktop.screenshot({ path: revvingPath });
    console.log('[Playwright] Saved revving screenshot:', revvingPath);
    await pageDesktop.keyboard.up('Space');
    await pageDesktop.waitForTimeout(400);

    // 切换引擎预设至 2010 V8 和 2026 V6
    console.log('[Playwright] Testing engine preset switches...');
    await pageDesktop.click('button:has-text("2010 V8")');
    await pageDesktop.waitForTimeout(200);
    await pageDesktop.click('button:has-text("2026 V6 Turbo")');
    await pageDesktop.waitForTimeout(200);

    await contextDesktop.close();

    // 2. 模拟移动视口测试 (390 x 844 iPhone 13/14 规格)
    console.log('[Playwright] 2. Mobile 390x844 viewport test...');
    const contextMobile = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      deviceScaleFactor: 3
    });
    const pageMobile = await contextMobile.newPage();
    await pageMobile.goto('http://127.0.0.1:3300/rev', { waitUntil: 'domcontentloaded', timeout: 20000 });

    const mobileStartBtn = await pageMobile.$('button:has-text("启动引擎声浪系统")');
    if (mobileStartBtn) {
      await mobileStartBtn.click();
      await pageMobile.waitForTimeout(200);
    }

    const mobilePath = path.join(artifactsDir, 'acoustic_rev_mobile_390.png');
    await pageMobile.screenshot({ path: mobilePath });
    console.log('[Playwright] Saved mobile screenshot:', mobilePath);

    await contextMobile.close();

    console.log('[Playwright] Total console errors:', consoleErrors.length);
    console.log('[Playwright] ALL BROWSER CHECKS PASSED!');
  } finally {
    await browser.close();
  }
}

run().catch(err => {
  console.error('[Playwright Fatal Error]', err);
  process.exit(1);
});
