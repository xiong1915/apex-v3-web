// tests/auth.test.mjs
// APEX V3 登录注册、OAuth、30天持久会话及 AI API 鉴权测试套件

import test from 'node:test';
import assert from 'node:assert/strict';
import { mockAuthManager } from '../lib/auth/mock.ts';
import { AUTH_CONFIG } from '../lib/auth/config.ts';

test('APEX V3 身份认证与权限控制体系专项测试', async (t) => {
  // 重置测试状态
  mockAuthManager.reset();

  await t.test('1. 注册流程与校验拦截', () => {
    // 空参数校验
    const r1 = mockAuthManager.register('', '');
    assert.ok(r1.error, '空参数必须报错');

    // 弱密码校验 (<6位)
    const r2 = mockAuthManager.register('newuser@f1.com', '12345');
    assert.ok(r2.error, '短密码必须报错');
    assert.equal(r2.error.status, 400);

    // 正常注册
    const r3 = mockAuthManager.register('fan@f1.com', 'SecurePass2026!');
    assert.equal(r3.error, null);
    assert.equal(r3.user.email, 'fan@f1.com');
    assert.equal(r3.user.email_confirmed_at, null, '新用户邮箱必须初始为未验证');

    // 重复注册拦截
    const r4 = mockAuthManager.register('fan@f1.com', 'SecurePass2026!');
    assert.ok(r4.error, '重复注册必须报错');

    // 检查验证邮件是否派发
    const sent = mockAuthManager.sentEmails.find(e => e.to === 'fan@f1.com' && e.type === 'verification');
    assert.ok(sent, '必须生成邮箱验证邮件');
    assert.ok(sent.token, '必须包含验证 Token');
  });

  await t.test('2. 邮箱验证流程', () => {
    const sent = mockAuthManager.sentEmails.find(e => e.to === 'fan@f1.com' && e.type === 'verification');
    assert.ok(sent);

    // 伪造 Token 验证
    const invalid = mockAuthManager.verifyEmail('fake-token-xyz');
    assert.ok(invalid.error, '伪造 Token 必须失败');

    // 正确 Token 验证
    const valid = mockAuthManager.verifyEmail(sent.token);
    assert.equal(valid.error, null);
    assert.equal(valid.success, true);

    // 二次验证应失效
    const secondTry = mockAuthManager.verifyEmail(sent.token);
    assert.ok(secondTry.error, '已使用的 Token 不能重复使用');
  });

  await t.test('3. 邮箱密码登录与未激活防护', () => {
    // 尚未激活的新用户尝试登录
    mockAuthManager.register('unverified@f1.com', 'Password123!');
    const unverifiedLogin = mockAuthManager.login('unverified@f1.com', 'Password123!');
    assert.ok(unverifiedLogin.error, '未验证邮箱登录必须被拦截');
    assert.equal(unverifiedLogin.error.status, 403);

    // 错误密码登录
    const wrongPass = mockAuthManager.login('fan@f1.com', 'WrongPass!');
    assert.ok(wrongPass.error);
    assert.equal(wrongPass.error.status, 401);

    // 正确已验证账号登录
    const successLogin = mockAuthManager.login('fan@f1.com', 'SecurePass2026!');
    assert.equal(successLogin.error, null);
    assert.ok(successLogin.session);
    assert.ok(successLogin.session.access_token);
    assert.ok(successLogin.session.refresh_token);
    assert.equal(successLogin.session.expires_in, AUTH_CONFIG.sessionMaxAge, '会话必须设置为 30 天时长');
  });

  await t.test('4. Google & GitHub OAuth 登录支持', () => {
    // Google OAuth
    const googleRes = mockAuthManager.loginOAuth('google', {
      email: 'driver_max@gmail.com',
      user_metadata: { name: 'Max Verstappen' }
    });
    assert.ok(googleRes.session);
    assert.equal(googleRes.user.email, 'driver_max@gmail.com');
    assert.equal(googleRes.user.user_metadata.provider, 'google');

    // GitHub OAuth
    const githubRes = mockAuthManager.loginOAuth('github', {
      email: 'engineer_adrian@github.com',
      user_metadata: { name: 'Adrian Newey' }
    });
    assert.ok(githubRes.session);
    assert.equal(githubRes.user.email, 'engineer_adrian@github.com');
    assert.equal(githubRes.user.user_metadata.provider, 'github');
  });

  await t.test('5. 会话恢复、30 天持久化与刷新', () => {
    const loginRes = mockAuthManager.login('fan@f1.com', 'SecurePass2026!');
    const token = loginRes.session.access_token;
    const refreshToken = loginRes.session.refresh_token;

    // 根据有效 Token 恢复会话
    const restored = mockAuthManager.getSession(token);
    assert.ok(restored);
    assert.equal(restored.user.email, 'fan@f1.com');

    // 使用 Refresh Token 刷新会话
    const refreshed = mockAuthManager.refreshSession(refreshToken);
    assert.ok(refreshed);
    assert.notEqual(refreshed.access_token, token, '刷新后必须生成新的 Access Token');

    // 原 Access Token 已被作废
    const oldRestored = mockAuthManager.getSession(token);
    assert.equal(oldRestored, null, '旧 Access Token 必须失效');
  });

  await t.test('6. 退出登录与会话作废', () => {
    const loginRes = mockAuthManager.login('fan@f1.com', 'SecurePass2026!');
    const token = loginRes.session.access_token;

    mockAuthManager.logout(token);
    const sessionAfterLogout = mockAuthManager.getSession(token);
    assert.equal(sessionAfterLogout, null, '退出登录后会话必须立即注销');
  });

  await t.test('7. 无效与伪造 Cookie 防御', () => {
    assert.equal(mockAuthManager.getSession(''), null);
    assert.equal(mockAuthManager.getSession('tampered-token-123'), null);
    assert.equal(mockAuthManager.refreshSession('tampered-refresh-token'), null);
  });

  await t.test('8. 找回密码与重置密码流程', () => {
    // 申请找回密码
    const forgotRes = mockAuthManager.forgotPassword('fan@f1.com');
    assert.equal(forgotRes.success, true);

    const resetMail = mockAuthManager.sentEmails.find(e => e.to === 'fan@f1.com' && e.type === 'reset');
    assert.ok(resetMail);
    assert.ok(resetMail.token);

    // 伪造 Token 重置
    const fakeReset = mockAuthManager.resetPassword('fake-reset-token', 'NewPass2026!');
    assert.ok(fakeReset.error);

    // 有效 Token 重置
    const validReset = mockAuthManager.resetPassword(resetMail.token, 'NewPass2026!');
    assert.equal(validReset.success, true);

    // 用新密码登录
    const newLogin = mockAuthManager.login('fan@f1.com', 'NewPass2026!');
    assert.equal(newLogin.error, null);
    assert.ok(newLogin.session);

    // 原密码失效
    const oldLogin = mockAuthManager.login('fan@f1.com', 'SecurePass2026!');
    assert.ok(oldLogin.error);
  });

  await t.test('9. AI API /api/ai/chat 身份安全硬屏障审查', async () => {
    const fs = await import('fs');
    const routeCode = fs.readFileSync('app/api/ai/chat/route.ts', 'utf8');

    // 必须导入服务端鉴权模块
    assert.ok(routeCode.includes('getServerUser'), 'AI 路由必须导入 getServerUser 服务端鉴权');

    // 必须存在 401 拦截逻辑
    assert.ok(routeCode.includes('status: 401'), '未登录调用 AI 必须直接阻断返回 401');
    assert.ok(routeCode.includes('未登录用户无法调用 AI 服务'), '必须包含明确的未登录错误提示');

    // 校验必须在模型推理或流式前发生
    const authIdx = routeCode.indexOf('getServerUser');
    const orchestratorIdx = routeCode.indexOf('defaultAIOrchestrator.streamAnswer');
    assert.ok(authIdx > 0 && authIdx < orchestratorIdx, '鉴权校验必须置于任何模型推演之前');
  });

  await t.test('10. 开放重定向 (Open Redirect) 防御机制', async () => {
    const fs = await import('fs');
    const callbackCode = fs.readFileSync('app/auth/callback/route.ts', 'utf8');

    assert.ok(callbackCode.includes('getSafeRedirectUrl'), 'OAuth 回调必须包含安全重定向校验');
    assert.ok(callbackCode.includes("next.startsWith('/')"), '仅允许相对站内路径跳转');
    assert.ok(callbackCode.includes("!next.startsWith('//')"), '阻断协议相对 URL 注入');
  });
});
