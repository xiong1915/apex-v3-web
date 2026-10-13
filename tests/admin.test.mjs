// tests/admin.test.mjs
// APEX Control 私人管理后台安全、鉴权、TOTP MFA 与数据真实性测试套件

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { mockAuthManager } from '../lib/auth/mock.ts';
import { AUTH_CONFIG } from '../lib/auth/config.ts';
import { getAdminOverview, getAdminUsers, getAdminAIMetrics, executeAdminF1Sync } from '../lib/admin/service.ts';

test('APEX Control 权限安全与管理后台功能测试', async (t) => {
  mockAuthManager.reset();

  await t.test('1. PWA 资源与清单规范审查', () => {
    // 检查 manifest.json
    const manifestPath = path.join(process.cwd(), 'public', 'manifest.json');
    assert.ok(fs.existsSync(manifestPath), '必须存在 public/manifest.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

    assert.equal(manifest.name, 'APEX Control');
    assert.equal(manifest.display, 'standalone', 'PWA 必须配置 standalone 全屏主屏幕启动');
    assert.equal(manifest.start_url, '/admin', '启动路径必须直接指向 /admin');
    assert.ok(manifest.icons && manifest.icons.length > 0, '必须包含应用图标');

    // 检查 admin-icon.svg 及 PNG 图标
    const iconPath = path.join(process.cwd(), 'public', 'admin-icon.svg');
    assert.ok(fs.existsSync(iconPath), '必须存在 public/admin-icon.svg 图标');
    assert.ok(fs.existsSync(path.join(process.cwd(), 'public', 'admin-icon-192.png')), '必须存在 public/admin-icon-192.png');
    assert.ok(fs.existsSync(path.join(process.cwd(), 'public', 'admin-icon-512.png')), '必须存在 public/admin-icon-512.png');
    assert.ok(fs.existsSync(path.join(process.cwd(), 'public', 'apple-touch-icon.png')), '必须存在 public/apple-touch-icon.png (iOS Safari 专用)');
  });

  await t.test('2. 管理员身份隔离验证 (401 / 403 严格门禁)', () => {
    // 普通用户会话
    const regularUserRes = mockAuthManager.login('tester@apex-f1.com', 'Formula1Pass2026!');
    assert.ok(regularUserRes.session);
    const regSession = regularUserRes.session;

    // 检查管理员判断逻辑
    const isRegularAdmin =
      regSession.user.id === AUTH_CONFIG.adminUserId ||
      regSession.user.email.toLowerCase() === AUTH_CONFIG.adminEmail.toLowerCase() ||
      regSession.user.role === 'admin';
    assert.equal(isRegularAdmin, false, '普通用户绝不能被识别为管理员');

    // 管理员账号登录
    const adminUserRes = mockAuthManager.login(AUTH_CONFIG.adminEmail, 'ApexAdmin2026!');
    assert.ok(adminUserRes.session);
    const adminSession = adminUserRes.session;

    const isAdmin =
      adminSession.user.id === AUTH_CONFIG.adminUserId ||
      adminSession.user.email.toLowerCase() === AUTH_CONFIG.adminEmail.toLowerCase() ||
      adminSession.user.role === 'admin';
    assert.equal(isAdmin, true, '管理员账号必须成功识别');
  });

  await t.test('3. TOTP MFA 与 AAL2 提权保护', () => {
    const adminUserRes = mockAuthManager.login(AUTH_CONFIG.adminEmail, 'ApexAdmin2026!');
    const token = adminUserRes.session.access_token;

    // 初始会话为 aal1
    const s1 = mockAuthManager.getSession(token);
    assert.equal(s1?.aal, 'aal1');

    // 错误 TOTP 验证码
    const wrongTotp = mockAuthManager.verifyAdminTOTP(token, '000000');
    assert.ok(wrongTotp.error, '错误 TOTP 必须报错');

    // 正确 TOTP 验证码 (接受标准测试码 123456)
    const validTotp = mockAuthManager.verifyAdminTOTP(token, '123456');
    assert.equal(validTotp.error, null);
    assert.equal(validTotp.success, true);
    assert.ok(validTotp.session);
    assert.equal(validTotp.session.aal, 'aal2', '验证成功后会话必须升级至 aal2');
  });

  await t.test('4. 真实数据源读取 (无伪造统计与指标累加)', async () => {
    const { recordAIRequestStart, recordAITokenUsage, recordAIRateLimitHit } = await import('../lib/admin/service.ts');

    // 网站概览
    const overview = await getAdminOverview();
    assert.ok(overview.health.status);
    assert.ok(overview.deployment.buildId);
    assert.ok(overview.f1.season === '2026');

    // 用户管理
    const users = await getAdminUsers();
    assert.ok(typeof users.total === 'number');
    assert.ok(Array.isArray(users.users));
    assert.ok(users.total >= 2, '包含预置管理员和测试用户');

    // AI 监控：先读取基准
    const aiBefore = await getAdminAIMetrics();
    const reqBefore = aiBefore.totalRequests;
    const tokenBefore = aiBefore.estimatedTokens;
    const rlBefore = aiBefore.rateLimitHits;

    // 模拟真实 API 统计累加
    await recordAIRequestStart();
    await recordAITokenUsage(120);
    await recordAIRateLimitHit();

    // 再次读取验证累加生效
    const aiAfter = await getAdminAIMetrics();
    assert.equal(aiAfter.totalRequests, reqBefore + 1, '请求计数必须真实自增');
    assert.equal(aiAfter.estimatedTokens, tokenBefore + 120, 'Token 用量必须真实累加');
    assert.equal(aiAfter.rateLimitHits, rlBefore + 1, '限流拦截必须真实计数');
    assert.ok(aiAfter.lastActiveTime, '必须记录最新请求时间戳');
  });

  await t.test('5. F1 手动同步隔离：严禁触发飞书提醒，30 秒冷却防刷', async () => {
    // 第一次触发同步
    const syncRes1 = await executeAdminF1Sync();
    assert.equal(syncRes1.success, true);
    assert.ok(syncRes1.details);
    assert.equal(syncRes1.details.feishuNotificationSuppressed, true, '必须严禁触发飞书提醒');

    // 紧接着第二次触发（冷却期内）
    const syncRes2 = await executeAdminF1Sync();
    assert.equal(syncRes2.success, false, '冷却期内必须拦截请求');
    assert.ok(syncRes2.cooldownRemaining && syncRes2.cooldownRemaining > 0, '必须告知剩余冷却时间');
  });

  await t.test('6. 管理接口防缓存审查 (Cache-Control: private, no-store)', () => {
    const adminRoutes = [
      'app/api/admin/overview/route.ts',
      'app/api/admin/users/route.ts',
      'app/api/admin/ai/route.ts',
      'app/api/admin/f1/route.ts',
      'app/api/admin/mfa/status/route.ts',
      'app/api/admin/mfa/verify/route.ts'
    ];

    for (const r of adminRoutes) {
      const fullPath = path.join(process.cwd(), r);
      assert.ok(fs.existsSync(fullPath), `管理接口必须存在: ${r}`);
      const code = fs.readFileSync(fullPath, 'utf8');
      assert.ok(code.includes('no-store'), `${r} 必须强制 no-store 防缓存`);
      assert.ok(code.includes('private'), `${r} 必须标记 private 禁止公共缓存`);
    }
  });
});
