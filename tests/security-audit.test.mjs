// tests/security-audit.test.mjs
// APEX V3 核心认证与权限加固专项回归测试套件
// 验证：生产 Mock 禁止、默认管理员失效、无授权码 OAuth、管理员越权、MFA AAL2、Token 泄露与 AI 门禁

import test from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { AUTH_CONFIG, isProduction, isValidUuid, isMockAuthAllowed, isSupabaseConfigured } from '../lib/auth/config.ts';
import { mockAuthManager, DEFAULT_MOCK_ADMIN_PASS, DEFAULT_MOCK_USER_PASS } from '../lib/auth/mock.ts';
import { verifyAdminAccess, getServerSession } from '../lib/auth/server.ts';
import { RedisRateLimitStore } from '../lib/storage/redis/index.ts';
import { POST as loginHandler } from '../app/api/auth/login/route.ts';
import { GET as sessionHandler } from '../app/api/auth/session/route.ts';
import { GET as callbackHandler } from '../app/auth/callback/route.ts';
import { GET as oauthHandler } from '../app/api/auth/oauth/route.ts';
import { POST as registerHandler } from '../app/api/auth/register/route.ts';
import { GET as mfaStatusHandler } from '../app/api/admin/mfa/status/route.ts';
import { POST as mfaVerifyHandler } from '../app/api/admin/mfa/verify/route.ts';
import { GET as adminOverviewHandler } from '../app/api/admin/overview/route.ts';
import { POST as aiChatHandler } from '../app/api/ai/chat/route.ts';

const VALID_ADMIN_UUID = 'e9b2512a-3c48-4c6e-8e81-79282361cf94';
const ATTACKER_UUID = 'b1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';

test('APEX V3 紧急认证安全修复全面审查', async (t) => {

  await t.test('1. 生产环境彻底禁止 Mock 登录、注册、OAuth 与测试 TOTP', async () => {
    const origNodeEnv = process.env.NODE_ENV;
    const origVercelEnv = process.env.VERCEL_ENV;
    const origMockAuth = process.env.MOCK_AUTH;

    try {
      // 模拟 Vercel 生产环境
      process.env.NODE_ENV = 'production';
      process.env.VERCEL_ENV = 'production';
      process.env.MOCK_AUTH = 'true'; // 即便显式声明 MOCK_AUTH，生产环境也必须硬性阻断

      assert.equal(isProduction(), true, '必须识别为生产环境');
      assert.equal(isMockAuthAllowed(), false, '生产环境无论如何禁止 Mock');

      // 1.1 Mock 管理单例直接阻断
      const mockLoginRes = mockAuthManager.login('admin@apex-f1.com', DEFAULT_MOCK_ADMIN_PASS);
      assert.ok(mockLoginRes.error, '生产环境 Mock 登录必须被阻断');
      assert.equal(mockLoginRes.error.status, 403);

      const mockRegRes = mockAuthManager.register('attacker@f1.com', 'Secret123!');
      assert.ok(mockRegRes.error, '生产环境 Mock 注册必须被阻断');
      assert.equal(mockRegRes.error.status, 403);

      assert.throws(() => {
        mockAuthManager.loginOAuth('google');
      }, /生产环境彻底禁止 Mock OAuth 登录/, '生产环境 Mock OAuth 必须直接抛错');

      const mockTotpRes = mockAuthManager.verifyAdminTOTP('any-token', '123456');
      assert.ok(mockTotpRes.error, '生产环境测试 TOTP 必须被阻断');
      assert.equal(mockTotpRes.error.status, 403);

      // 1.2 未配置 Supabase 时生产 API 路由拒绝服务，不发生自动降级
      const reqLogin = new NextRequest('https://f1.tike69.cc.cd/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'admin@apex-f1.com', password: DEFAULT_MOCK_ADMIN_PASS })
      });
      const resLogin = await loginHandler(reqLogin);
      assert.equal(resLogin.status, 503, '未配置 Supabase 生产模式必须拒绝登录 (503)');
      const loginBody = await resLogin.json();
      assert.match(loginBody.error, /未就绪|未配置/);

      const reqRegister = new NextRequest('https://f1.tike69.cc.cd/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'new@f1.com', password: 'Password123!' })
      });
      const resRegister = await registerHandler(reqRegister);
      assert.equal(resRegister.status, 503, '生产环境必须拒绝 Mock 注册 (503)');

      const reqOAuth = new NextRequest('https://f1.tike69.cc.cd/api/auth/oauth?provider=google');
      const resOAuth = await oauthHandler(reqOAuth);
      assert.equal(resOAuth.status, 503, '生产环境必须拒绝 Mock OAuth 地址生成 (503)');
    } finally {
      process.env.NODE_ENV = origNodeEnv;
      process.env.VERCEL_ENV = origVercelEnv;
      process.env.MOCK_AUTH = origMockAuth;
    }
  });

  await t.test('2. 默认管理员失效与严格 UUID 校验', async () => {
    // 2.1 预置管理员 ID 'admin-apex-v3-root' 失效审查
    assert.equal(isValidUuid('admin-apex-v3-root'), false, '预置管理员标识绝不能作为合法 UUID');
    assert.equal(isValidUuid(''), false, '空字符串不能作为合法 UUID');
    assert.equal(isValidUuid(undefined), false);
    assert.equal(isValidUuid(VALID_ADMIN_UUID), true, '标准 UUID 格式必须通过校验');

    // 2.2 当 ADMIN_USER_ID 未设置时，管理后台锁定，任何人无法通过鉴权
    AUTH_CONFIG.adminUserId = '';
    const fakeAdminUser = {
      id: 'admin-apex-v3-root',
      email: 'admin@apex-f1.com',
      email_confirmed_at: '2026-01-01T00:00:00Z',
      role: 'admin',
      user_metadata: {},
      app_metadata: { role: 'admin', aal: 'aal2' },
      created_at: '2026-01-01T00:00:00Z'
    };
    const fakeSession = {
      access_token: 'fake-access',
      refresh_token: 'fake-refresh',
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      expires_in: 3600,
      created_at: Math.floor(Date.now() / 1000),
      user: fakeAdminUser,
      aal: 'aal2'
    };

    // 模拟 mockAuthManager 存放该会话
    mockAuthManager.reset();
    mockAuthManager.sessions.set('fake-admin-tok', { session: fakeSession });

    const reqNoAdminConfig = new NextRequest('https://f1.tike69.cc.cd/api/admin/overview', {
      headers: { cookie: `apex_session_token=fake-admin-tok` }
    });
    const authRes1 = await verifyAdminAccess(reqNoAdminConfig);
    assert.equal(authRes1.ok, false, '未配置 ADMIN_USER_ID 时管理权限必须被锁定');
    assert.equal(authRes1.status, 403);

    // 2.3 设置 ADMIN_USER_ID 为合法 UUID
    AUTH_CONFIG.adminUserId = VALID_ADMIN_UUID;

    // 2.4 邮箱相同、但 ID 不同的攻击者伪造账号被严格阻断 (禁止邮箱匹配)
    const emailImpersonator = {
      ...fakeAdminUser,
      id: ATTACKER_UUID,
      email: 'admin@apex-f1.com' // 相同邮箱，不同 UUID
    };
    const impersonatorSession = { ...fakeSession, user: emailImpersonator };
    mockAuthManager.sessions.set('impersonator-tok', { session: impersonatorSession });

    const reqImpersonator = new NextRequest('https://f1.tike69.cc.cd/api/admin/overview', {
      headers: { cookie: `apex_session_token=impersonator-tok` }
    });
    const authRes2 = await verifyAdminAccess(reqImpersonator);
    assert.equal(authRes2.ok, false, '邮箱相同但 UUID 不同的账号必须被阻断');
    assert.equal(authRes2.status, 403);

    // 2.5 role 为 admin 但 UUID 不同的账号被严格阻断 (禁止普通角色绕过)
    const roleBypassUser = {
      ...fakeAdminUser,
      id: ATTACKER_UUID,
      email: 'hacker@apex-f1.com',
      role: 'admin',
      app_metadata: { role: 'admin', aal: 'aal2' }
    };
    const roleBypassSession = { ...fakeSession, user: roleBypassUser };
    mockAuthManager.sessions.set('role-bypass-tok', { session: roleBypassSession });

    const reqRoleBypass = new NextRequest('https://f1.tike69.cc.cd/api/admin/overview', {
      headers: { cookie: `apex_session_token=role-bypass-tok` }
    });
    const authRes3 = await verifyAdminAccess(reqRoleBypass);
    assert.equal(authRes3.ok, false, 'role:admin 但 UUID 不同的账号必须被阻断');
    assert.equal(authRes3.status, 403);
  });

  await t.test('3. 管理后台必须强制校验真实 AAL2 TOTP 双重验证', async () => {
    AUTH_CONFIG.adminUserId = VALID_ADMIN_UUID;

    // 管理员真实 UUID，但当前仅处于 aal1 级别
    const adminAal1User = {
      id: VALID_ADMIN_UUID,
      email: 'realadmin@apex-f1.com',
      email_confirmed_at: '2026-01-01T00:00:00Z',
      role: 'authenticated',
      user_metadata: {},
      app_metadata: { role: 'admin', aal: 'aal1' },
      created_at: '2026-01-01T00:00:00Z'
    };
    const adminAal1Session = {
      access_token: 'admin-aal1-tok',
      refresh_token: 'admin-aal1-ref',
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      expires_in: 3600,
      created_at: Math.floor(Date.now() / 1000),
      user: adminAal1User,
      aal: 'aal1'
    };
    mockAuthManager.sessions.set('admin-aal1-tok', { session: adminAal1Session });

    const reqAal1 = new NextRequest('https://f1.tike69.cc.cd/api/admin/overview', {
      headers: { cookie: `apex_session_token=admin-aal1-tok` }
    });

    // 默认 requireAal2 = true
    const authAal1 = await verifyAdminAccess(reqAal1);
    assert.equal(authAal1.ok, false, '仅有 AAL1 的管理员请求必须被拦截');
    assert.equal(authAal1.status, 403);
    assert.match(authAal1.message, /AAL2|TOTP/);

    // 管理员 overview 接口调用必须返回 403
    const resOverview = await adminOverviewHandler(reqAal1);
    assert.equal(resOverview.status, 403, 'Admin Overview 接口必须强制拦截 AAL1');

    // 升级为 aal2
    const adminAal2Session = {
      ...adminAal1Session,
      access_token: 'admin-aal2-tok',
      aal: 'aal2',
      user: {
        ...adminAal1User,
        app_metadata: { role: 'admin', aal: 'aal2' }
      }
    };
    mockAuthManager.sessions.set('admin-aal2-tok', { session: adminAal2Session });

    const reqAal2 = new NextRequest('https://f1.tike69.cc.cd/api/admin/overview', {
      headers: { cookie: `apex_session_token=admin-aal2-tok` }
    });
    const authAal2 = await verifyAdminAccess(reqAal2);
    assert.equal(authAal2.ok, true, '具备 AAL2 的管理员鉴权成功');
  });

  await t.test('4. /auth/callback 禁止无授权码创建会话', async () => {
    // 4.1 无 code 参数
    const reqNoCode = new NextRequest('https://f1.tike69.cc.cd/auth/callback');
    const resNoCode = await callbackHandler(reqNoCode);
    assert.equal(resNoCode.status, 307);
    const loc1 = resNoCode.headers.get('location');
    assert.match(loc1 || '', /error=%E7%BC%BA%E5%B0%91%E6%9C%89%E6%95%88/); // 缺少有效 OAuth 授权码
    assert.equal(resNoCode.cookies.get(AUTH_CONFIG.cookieName), undefined, '绝不能设置登录凭据 Cookie');

    // 4.2 空 code 参数
    const reqEmptyCode = new NextRequest('https://f1.tike69.cc.cd/auth/callback?code=');
    const resEmptyCode = await callbackHandler(reqEmptyCode);
    assert.equal(resEmptyCode.status, 307);
    assert.equal(resEmptyCode.cookies.get(AUTH_CONFIG.cookieName), undefined);

    // 4.3 纯空格 code 参数
    const reqBlankCode = new NextRequest('https://f1.tike69.cc.cd/auth/callback?code=%20%20');
    const resBlankCode = await callbackHandler(reqBlankCode);
    assert.equal(resBlankCode.status, 307);
    assert.equal(resBlankCode.cookies.get(AUTH_CONFIG.cookieName), undefined);
  });

  await t.test('5. 登录和会话 API 不得向浏览器暴露 Refresh Token，且严格遵守 30 天周期', async () => {
    // 5.1 登录 API 响应体脱敏审查
    const reqLogin = new NextRequest('https://f1.tike69.cc.cd/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'tester@apex-f1.com', password: DEFAULT_MOCK_USER_PASS })
    });
    const resLogin = await loginHandler(reqLogin);
    assert.equal(resLogin.status, 200);
    const loginData = await resLogin.json();

    assert.ok(loginData.user, '必须返回用户基本信息');
    assert.ok(loginData.session, '必须返回基础会话');
    assert.equal(loginData.session.refresh_token, undefined, '响应体 Session 中绝对禁止包含 refresh_token');
    assert.equal(loginData.refresh_token, undefined, '响应体根节点绝对禁止包含 refresh_token');

    // HttpOnly Cookie 中仍然保留凭据
    const refreshCookie = resLogin.cookies.get(AUTH_CONFIG.refreshCookieName);
    assert.ok(refreshCookie, 'Refresh Token 必须且仅允许置于 HttpOnly Cookie');
    assert.equal(refreshCookie.httpOnly, true, 'Cookie 必须设置 httpOnly');

    // 5.2 会话查询 API 响应体脱敏审查
    const reqSession = new NextRequest('https://f1.tike69.cc.cd/api/auth/session', {
      headers: { cookie: `apex_session_token=${resLogin.cookies.get(AUTH_CONFIG.cookieName)?.value}` }
    });
    const resSession = await sessionHandler(reqSession);
    assert.equal(resSession.status, 200);
    const sessionData = await resSession.json();
    assert.equal(sessionData.session.refresh_token, undefined, 'Session API 响应体绝对禁止包含 refresh_token');

    // 5.3 30 天超期会话强制清除机制
    const thirtyOneDaysAgo = Math.floor(Date.now() / 1000) - 31 * 24 * 3600;
    const reqExpiredSession = new NextRequest('https://f1.tike69.cc.cd/api/auth/session', {
      headers: {
        cookie: `apex_session_token=${resLogin.cookies.get(AUTH_CONFIG.cookieName)?.value}; apex_session_created_at=${thirtyOneDaysAgo}`
      }
    });
    const resExpired = await sessionHandler(reqExpiredSession);
    assert.equal(resExpired.status, 200);
    const expiredData = await resExpired.json();
    assert.equal(expiredData.user, null, '超期会话必须判定为注销');
    assert.equal(expiredData.session, null);
    // 检查清理 Cookie 设置
    const clearedCookie = resExpired.cookies.get(AUTH_CONFIG.cookieName);
    assert.equal(clearedCookie?.maxAge, 0, '必须注销浏览器 Cookie');
  });

  await t.test('6. AI API 鉴权硬屏障与 Redis 异常安全防御', async () => {
    // 6.1 未登录请求直接 401
    const reqUnauth = new NextRequest('https://f1.tike69.cc.cd/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: '2026 赛季赛历' })
    });
    const resUnauth = await aiChatHandler(reqUnauth);
    assert.equal(resUnauth.status, 401, '未登录请求必须阻断返回 401');

    // 6.2 注册但未验证邮箱的用户直接 403，绝不调用 DeepSeek
    const unverifiedUser = {
      id: 'usr_unverified_123',
      email: 'unverified@f1.com',
      email_confirmed_at: null, // 未验证
      role: 'authenticated',
      user_metadata: {},
      app_metadata: { role: 'authenticated', aal: 'aal1' },
      created_at: new Date().toISOString()
    };
    const unverifiedSession = {
      access_token: 'unverified-tok',
      refresh_token: 'unverified-ref',
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      expires_in: 3600,
      created_at: Math.floor(Date.now() / 1000),
      user: unverifiedUser,
      aal: 'aal1'
    };
    mockAuthManager.sessions.set('unverified-tok', { session: unverifiedSession });

    const reqUnverified = new NextRequest('https://f1.tike69.cc.cd/api/ai/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: 'apex_session_token=unverified-tok'
      },
      body: JSON.stringify({ message: '2026 赛季积分榜' })
    });
    const resUnverified = await aiChatHandler(reqUnverified);
    assert.equal(resUnverified.status, 403, '未完成邮箱验证的用户必须阻断返回 403');
    const unverifiedBody = await resUnverified.json();
    assert.match(unverifiedBody.error, /邮箱验证/);

    // 6.3 Redis 故障时降级为内存限流器，彻底杜绝无限放行
    const mockFaultyRedis = {
      incr: async () => { throw new Error('Upstash connection refused'); },
      expire: async () => {},
      ttl: async () => -1
    };

    const redisLimiter = new RedisRateLimitStore(mockFaultyRedis);
    const testKey = 'test:fault:ip:10.0.0.1';
    const limit = 3;
    const windowSec = 10;

    // 前 3 次请求应当允许 (降级使用 MemoryRateLimitStore)
    const r1 = await redisLimiter.checkRateLimit(testKey, limit, windowSec);
    const r2 = await redisLimiter.checkRateLimit(testKey, limit, windowSec);
    const r3 = await redisLimiter.checkRateLimit(testKey, limit, windowSec);
    assert.equal(r1.allowed, true);
    assert.equal(r2.allowed, true);
    assert.equal(r3.allowed, true);

    // 第 4 次请求必须被拦截！绝不能因 Redis 异常无限放行！
    const r4 = await redisLimiter.checkRateLimit(testKey, limit, windowSec);
    assert.equal(r4.allowed, false, 'Redis 异常时降级限流器仍必须有效拦截超频请求，严禁无限放行');
    assert.equal(r4.remaining, 0);
  });
});
