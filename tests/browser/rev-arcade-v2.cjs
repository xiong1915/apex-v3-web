// tests/browser/rev-arcade-v2.cjs
const path = require('node:path');
const fs = require('node:fs');

let playwright;
try {
  playwright = require('playwright');
} catch (_) {
  playwright = require('C:/Users/Administrator/AppData/Local/npm-cache/_npx/dea9475797100b20/node_modules/playwright-core');
}

const artifactsDir = 'C:/Users/Administrator/.gemini/antigravity/brain/177d99ed-9770-4077-9346-f62578c5334c';

async function run() {
  console.log('[Playwright] Starting Acoustic Rev Arcade V2.0 user-flow verification...');
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

    console.log('[Playwright] Navigating to http://127.0.0.1:3300/rev ...');
    const resp = await pageDesktop.goto('http://127.0.0.1:3300/rev', { waitUntil: 'domcontentloaded', timeout: 20000 });
    console.log('[Playwright] Status code:', resp.status());

    // 默认展示模式大厅
    await pageDesktop.waitForSelector('text=选择你的挑战模式');
    console.log('[Playwright] Verified: Default mode is now Arcade Lobby!');

    const lobbyScreenshotPath = path.join(artifactsDir, 'arcade_v2_lobby_desktop.png');
    await pageDesktop.screenshot({ path: lobbyScreenshotPath, fullPage: false });

    // 从大厅卡片点击「立即发车」进入直线加速赛
    console.log('[Playwright] Clicking Drag Race card...');
    await pageDesktop.click('text=0-400M 直线加速赛');
    await pageDesktop.waitForSelector('text=点击开始发车程序');
    console.log('[Playwright] Verified: Entered Drag Race View!');

    const dragScreenshotPath = path.join(artifactsDir, 'arcade_v2_drag_desktop.png');
    await pageDesktop.screenshot({ path: dragScreenshotPath, fullPage: false });

    // 点击发车程序
    console.log('[Playwright] Clicking launch sequence button...');
    await pageDesktop.click('text=点击开始发车程序');
    console.log('[Playwright] Waiting for 5 lights countdown & lights out...');
    await pageDesktop.waitForTimeout(6500);

    // 灭灯后踩下 Space 发车
    console.log('[Playwright] Pressing Space to launch & accelerate...');
    await pageDesktop.keyboard.down('Space');
    await pageDesktop.waitForTimeout(1500);
    await pageDesktop.keyboard.up('Space');

    // 检查挡位和速度是否成功起步
    const gearText = await pageDesktop.locator('text=GEAR').locator('..').textContent();
    const speedText = await pageDesktop.locator('text=KM/H').locator('..').textContent();
    console.log('[Playwright] Car Telemetry after launch:', gearText.replace(/\s+/g, ' '), speedText.replace(/\s+/g, ' '));

    if (speedText.includes('0 KM/H') && gearText.includes('N')) {
      throw new Error('CRITICAL FAILURE: Car did not launch on Space throttle press!');
    }
    console.log('[Playwright] SUCCESS: Car launched dynamically on Space press!');

    // 切换至弹射起步挑战
    console.log('[Playwright] Switching to Launch Control...');
    await pageDesktop.click('button:has-text("🎯 弹射起步")');
    await pageDesktop.waitForSelector('text=LAUNCH CONTROL');

    // 切换至听声辨引擎
    console.log('[Playwright] Switching to Sound Quiz...');
    await pageDesktop.click('button:has-text("🎧 听声辨引擎")');
    await pageDesktop.waitForSelector('text=SOUND QUIZ');

    // 切换回自由声浪
    console.log('[Playwright] Switching to Free Rev...');
    await pageDesktop.click('button:has-text("🔊 自由声浪")');
    await pageDesktop.waitForSelector('text=START ENGINE');

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
    await pageMobile.waitForSelector('text=选择你的挑战模式');

    const mobileScreenshotPath = path.join(artifactsDir, 'arcade_v2_mobile_390.png');
    await pageMobile.screenshot({ path: mobileScreenshotPath, fullPage: false });

    await contextMobile.close();

    console.log('[Playwright] All end-to-end verification passed with flying colors!');
  } catch (err) {
    console.error('[Playwright] Verification failed:', err);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

run();
