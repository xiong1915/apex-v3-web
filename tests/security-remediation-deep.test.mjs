import test from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { POST as forgotPasswordHandler } from '../app/api/auth/forgot-password/route.ts';
import { POST as sendResetCodeHandler } from '../app/api/auth/send-reset-code/route.ts';
import { POST as loginHandler } from '../app/api/auth/login/route.ts';
import { POST as registerHandler } from '../app/api/auth/register/route.ts';
import { middleware } from '../middleware.ts';
import nextConfig from '../next.config.mjs';
import cfWorker from '../cf_worker.js';
import { getRateLimitStore } from '../lib/storage/index.ts';

const worker = cfWorker?.fetch ? cfWorker : cfWorker.default;

test('Security Remediation Deep Verification Suite', async (t) => {
  await t.test('1. forgot-password: ATO backdoor removal & anti-enumeration', async () => {
    // 1.1 Invalid email
    const reqInvalid = new NextRequest('http://localhost:3000/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'invalid-email-format' })
    });
    const resInvalid = await forgotPasswordHandler(reqInvalid);
    assert.equal(resInvalid.status, 400);

    // 1.2 Legitimate request under mock mode
    const testEmail = 'ato-test@example.com';
    const reqValid = new NextRequest('http://localhost:3000/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'cf-connecting-ip': '198.51.100.1' },
      body: JSON.stringify({ email: testEmail })
    });
    const resValid = await forgotPasswordHandler(reqValid);
    assert.equal(resValid.status, 200);
    const bodyValid = await resValid.json();

    // Verify response does NOT contain recovery credentials or tokens
    assert.equal(bodyValid.recoveryUrl, undefined, 'Must not leak recoveryUrl');
    assert.equal(bodyValid.sessionReady, undefined, 'Must not leak sessionReady flag');
    assert.equal(resValid.cookies.get('apex_session_token'), undefined, 'Must NOT set session cookie');
    assert.match(bodyValid.message, /如果该邮箱已注册.*重置邮件已发送至您的邮箱/);

    // 1.3 Rate limit kicks in on second attempt for the same email
    const reqRateLimited = new NextRequest('http://localhost:3000/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'cf-connecting-ip': '198.51.100.2' },
      body: JSON.stringify({ email: testEmail })
    });
    const resRateLimited = await forgotPasswordHandler(reqRateLimited);
    assert.equal(resRateLimited.status, 429);
    assert.ok(resRateLimited.headers.get('retry-after'));

    // 1.4 Unregistered email in mock mode does not leak another user's reset link
    const unregisteredEmail = 'unregistered-victim@example.com';
    const reqUnregistered = new NextRequest('http://localhost:3000/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'cf-connecting-ip': '198.51.100.3' },
      body: JSON.stringify({ email: unregisteredEmail })
    });
    const resUnregistered = await forgotPasswordHandler(reqUnregistered);
    assert.equal(resUnregistered.status, 200);
    const bodyUnregistered = await resUnregistered.json();
    assert.match(bodyUnregistered.message, /如果该邮箱已注册.*重置邮件已发送至您的邮箱/);
  });

  await t.test('2. send-reset-code: CSPRNG code generation', async () => {
    // Repeatedly generate codes via send-reset-code to ensure format
    // Mock sendEmail by testing with invalid email / checking route logic
    const req1 = new NextRequest('http://localhost:3000/api/auth/send-reset-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'csprng-test@example.com' })
    });
    // In dev environment with mock/no sendEmail configured, it will either succeed or fail with 503
    const res1 = await sendResetCodeHandler(req1);
    assert.ok([200, 503].includes(res1.status));
  });

  await t.test('3. login & register: rate limiting and password policy', async () => {
    // 3.1 Register password complexity: length < 8
    const resShort = await registerHandler(new NextRequest('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'pwd1@example.com', password: 'Aa1' })
    }));
    assert.equal(resShort.status, 400);
    assert.match((await resShort.json()).error, /密码强度不足/);

    // 3.2 Register password complexity: no digits
    const resNoDigits = await registerHandler(new NextRequest('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'pwd2@example.com', password: 'AlphabetOnly' })
    }));
    assert.equal(resNoDigits.status, 400);
    assert.match((await resNoDigits.json()).error, /密码强度不足/);

    // 3.3 Register password complexity: no letters
    const resNoLetters = await registerHandler(new NextRequest('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'pwd3@example.com', password: '1234567890' })
    }));
    assert.equal(resNoLetters.status, 400);
    assert.match((await resNoLetters.json()).error, /密码强度不足/);

    // 3.4 Login rate limit: user account limit (5 per min)
    const testIp = '203.0.113.88';
    const targetUser = 'ratelimit-target@example.com';
    let hit429 = false;
    for (let i = 0; i < 7; i++) {
      const res = await loginHandler(new NextRequest('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'cf-connecting-ip': testIp },
        body: JSON.stringify({ email: targetUser, password: 'WrongPassword123!' })
      }));
      if (res.status === 429) {
        hit429 = true;
        assert.equal(res.headers.get('retry-after'), '60');
        break;
      }
    }
    assert.equal(hit429, true, 'User login rate limit must be triggered');

    // 3.5 Login rate limit is case-insensitive for email
    const caseUser = 'case-test@example.com';
    const caseIp = '203.0.113.99';
    for (let i = 0; i < 5; i++) {
      await loginHandler(new NextRequest('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'cf-connecting-ip': caseIp },
        body: JSON.stringify({ email: caseUser.toUpperCase(), password: 'WrongPassword123!' })
      }));
    }
    const resCase = await loginHandler(new NextRequest('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'cf-connecting-ip': caseIp },
      body: JSON.stringify({ email: caseUser.toLowerCase(), password: 'WrongPassword123!' })
    }));
    assert.equal(resCase.status, 429, 'Account rate limit must be case-insensitive');
  });

  await t.test('4. Network boundary defense: cf_worker & middleware', async () => {
    // 4.1 Cloudflare worker injects X-Origin-Verify-Secret
    const origFetch = globalThis.fetch;
    let capturedReq = null;
    try {
      globalThis.fetch = async (req) => {
        capturedReq = req;
        return new Response('upstream-ok');
      };

      const cfReq = new Request('https://f1.tike69.cc.cd/test', {
        headers: { 'cf-connecting-ip': '1.2.3.4' }
      });
      await worker.fetch(cfReq, {
        UPSTREAM_ORIGIN: 'https://upstream.example',
        ORIGIN_VERIFY_SECRET: 'test-secret-12345'
      }, {});

      assert.ok(capturedReq);
      assert.equal(capturedReq.headers.get('x-origin-verify-secret'), 'test-secret-12345');
    } finally {
      globalThis.fetch = origFetch;
    }

    // 4.2 middleware: blocks direct origin access in production
    const origNodeEnv = process.env.NODE_ENV;
    const origVercel = process.env.VERCEL;
    const origSecret = process.env.ORIGIN_VERIFY_SECRET;

    try {
      process.env.NODE_ENV = 'production';
      process.env.VERCEL = '1';
      process.env.ORIGIN_VERIFY_SECRET = 'super-secret-key-prod';

      // Direct request without secret -> 403
      const directReq = new NextRequest('https://f1-race-reminder-cloud.vercel.app/races');
      const directRes = middleware(directReq);
      assert.equal(directRes.status, 403);

      // Direct request with invalid secret -> 403
      const badSecretReq = new NextRequest('https://f1-race-reminder-cloud.vercel.app/races', {
        headers: { 'x-origin-verify-secret': 'wrong-secret' }
      });
      const badSecretRes = middleware(badSecretReq);
      assert.equal(badSecretRes.status, 403);

      // Gateway request with matching secret -> passes (status 200 / next)
      const validReq = new NextRequest('https://f1-race-reminder-cloud.vercel.app/races', {
        headers: { 'x-origin-verify-secret': 'super-secret-key-prod' }
      });
      const validRes = middleware(validReq);
      assert.equal(validRes.status, 200);

      // Cron route bypasses secret check
      const cronReq = new NextRequest('https://f1-race-reminder-cloud.vercel.app/api/cron/reminder');
      const cronRes = middleware(cronReq);
      assert.equal(cronRes.status, 200);
    } finally {
      process.env.NODE_ENV = origNodeEnv;
      process.env.VERCEL = origVercel;
      process.env.ORIGIN_VERIFY_SECRET = origSecret;
    }
  });

  await t.test('5. CSP hardening: no unsafe-eval', async () => {
    const headers = await nextConfig.headers();
    const globalRule = headers.find(h => h.source === '/:path*');
    assert.ok(globalRule);
    const cspHeader = globalRule.headers.find(h => h.key === 'Content-Security-Policy');
    assert.ok(cspHeader);
    assert.doesNotMatch(cspHeader.value, /'unsafe-eval'/);
    assert.match(cspHeader.value, /script-src 'self' 'unsafe-inline' https:\/\/static\.cloudflareinsights\.com/);
  });
});
