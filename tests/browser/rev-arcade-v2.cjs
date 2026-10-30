// tests/browser/rev-arcade-v2.cjs
const path = require('node:path');
const fs = require('node:fs');

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
  console.log('[Playwright] Starting Acoustic Rev Arcade V2.0 browser test...');
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

    // 验证标题
    await pageDesktop.waitForSelector('text=Acoustic Rev Arcade');
    console.log('[Playwright] Brand title verified: Acoustic Rev Arcade');

    // 默认进入 DRAG 直线加速赛
    await pageDesktop.waitForSelector('text=400M 终点');
    console.log('[Playwright] Drag race mode active by default.');

    // 截图 1: 直线加速赛待机界面
    const dragScreenshotPath = path.join(artifactsDir, 'arcade_v2_drag_desktop.png');
    await pageDesktop.screenshot({ path: dragScreenshotPath, fullPage: false });
    console.log('[Playwright] Captured:', dragScreenshotPath);

    // 切换至大厅模式
    console.log('[Playwright] Switching to Lobby mode...');
    await pageDesktop.click('button:has-text("🏛️ 大厅")');
    await pageDesktop.waitForSelector('text=选择你的挑战模式');
    await pageDesktop.waitForSelector('text=0-400M 直线加速赛');
    await pageDesktop.waitForSelector('text=弹射起步技巧挑战');
    await pageDesktop.waitForSelector('text=听声辨引擎盲测');

    // 截图 2: 模式大厅
    const lobbyScreenshotPath = path.join(artifactsDir, 'arcade_v2_lobby_desktop.png');
    await pageDesktop.screenshot({ path: lobbyScreenshotPath, fullPage: false });
    console.log('[Playwright] Captured:', lobbyScreenshotPath);

    // 切换至弹射起步挑战
    console.log('[Playwright] Switching to Launch Control...');
    await pageDesktop.click('button:has-text("🎯 弹射起步")');
    await pageDesktop.waitForSelector('text=LAUNCH CONTROL');
    await pageDesktop.waitForSelector('text=最佳绿区');

    // 截图 3: 弹射起步
    const launchScreenshotPath = path.join(artifactsDir, 'arcade_v2_launch_desktop.png');
    await pageDesktop.screenshot({ path: launchScreenshotPath, fullPage: false });
    console.log('[Playwright] Captured:', launchScreenshotPath);

    // 切换至听声辨引擎
    console.log('[Playwright] Switching to Sound Quiz...');
    await pageDesktop.click('button:has-text("🎧 听声辨引擎")');
    await pageDesktop.waitForSelector('text=SOUND QUIZ');
    await pageDesktop.waitForSelector('text=播放特征声浪');

    // 截图 4: 听声辨引擎
    const quizScreenshotPath = path.join(artifactsDir, 'arcade_v2_quiz_desktop.png');
    await pageDesktop.screenshot({ path: quizScreenshotPath, fullPage: false });
    console.log('[Playwright] Captured:', quizScreenshotPath);

    // 切换回自由声浪
    console.log('[Playwright] Switching to Free Rev...');
    await pageDesktop.click('button:has-text("🔊 自由声浪")');
    await pageDesktop.waitForSelector('text=START ENGINE');
    await pageDesktop.waitForSelector('text=RPM');

    // 截图 5: 自由声浪
    const freeScreenshotPath = path.join(artifactsDir, 'arcade_v2_free_desktop.png');
    await pageDesktop.screenshot({ path: freeScreenshotPath, fullPage: false });
    console.log('[Playwright] Captured:', freeScreenshotPath);

    await contextDesktop.close();

    // 2. 移动端视口测试 (390 x 844 iPhone 14)
    console.log('[Playwright] 2. Mobile 390x844 viewport test...');
    const contextMobile = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true
    });
    const pageMobile = await contextMobile.newPage();
    await pageMobile.goto('http://127.0.0.1:3300/rev', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await pageMobile.waitForSelector('text=Acoustic Rev Arcade');

    // 截图 6: 移动端主界面
    const mobileScreenshotPath = path.join(artifactsDir, 'arcade_v2_mobile_390.png');
    await pageMobile.screenshot({ path: mobileScreenshotPath, fullPage: false });
    console.log('[Playwright] Captured:', mobileScreenshotPath);

    await contextMobile.close();

    console.log('[Playwright] All browser verification stages completed successfully!');
    if (consoleErrors.length > 0) {
      console.warn('[Playwright] Console errors detected:', consoleErrors);
    }
  } catch (err) {
    console.error('[Playwright] Error during browser test:', err);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

run();
