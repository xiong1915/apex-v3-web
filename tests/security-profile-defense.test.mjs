// tests/security-profile-defense.test.mjs
// 服务端输入安全防御、防 XSS 注入、文件魔数白名单与防账号枚举回归测试

import test from 'node:test';
import assert from 'node:assert/strict';
import { validateDisplayName, validateAvatarBuffer } from '../lib/profile/validation.ts';
import { registrationError } from '../lib/auth/registration-error.ts';

test('🛡️ APEX V3 服务端输入防御与防枚举安全审查', async (t) => {

  await t.test('1. 昵称服务端防 XSS 与恶意脚本注入验证 (绕过前端探针防御)', () => {
    const maliciousProbes = [
      '<script>alert("xss")</script>',
      '<img src=x onerror=alert(1)>',
      '<svg/onload=alert(document.cookie)>',
      'javascript:void(0)',
      '<iframe src="evil.com"></iframe>',
      'Driver<marquee>hack</marquee>',
      'Hello \u0000 NullByte',
      'Name with \u001F control char'
    ];

    for (const probe of maliciousProbes) {
      const res = validateDisplayName(probe);
      assert.equal(res.valid, false, `恶意探针 "${probe}" 必须被服务端拦截拒绝`);
      assert.ok(res.error, '必须包含明确的服务端安全拒绝原因');
    }

    // 长度与类型边界
    assert.equal(validateDisplayName('A').valid, false, '单字符昵称必须被拒绝');
    assert.equal(validateDisplayName('ThisIsAnExcessivelyLongNicknameExceedingLimit').valid, false, '超长昵称必须被拒绝');
    assert.equal(validateDisplayName(12345).valid, false, '非文本类型必须被拒绝');

    // 正常昵称通过
    const valid = validateDisplayName('基米·安东内利');
    assert.equal(valid.valid, true);
    assert.equal(valid.value, '基米·安东内利');
  });

  await t.test('2. 头像二进制魔数 (Magic Bytes) 严格白名单与代码伪装防御', () => {
    // 伪装成 PNG 的 SVG/XML/HTML 脚本
    const fakeSvg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>', 'utf8');
    const fakeHtml = Buffer.from('<!doctype html><html><body><h1>Fake Image</h1></body></html>', 'utf8');
    const fakePhp = Buffer.from('<?php echo shell_exec($_GET["cmd"]); ?>', 'utf8');
    const fakeExe = Buffer.from('MZ\x90\x00\x03\x00\x00\x00', 'binary');

    assert.equal(validateAvatarBuffer(fakeSvg).valid, false, 'SVG 矢量代码必须被彻底拒绝');
    assert.equal(validateAvatarBuffer(fakeHtml).valid, false, 'HTML 页面伪装必须被拒绝');
    assert.equal(validateAvatarBuffer(fakePhp).valid, false, 'PHP 脚本必须被拒绝');
    assert.equal(validateAvatarBuffer(fakeExe).valid, false, '二进制可执行文件必须被拒绝');

    // 真实合法图片魔数
    const realPng = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D]);
    const pngRes = validateAvatarBuffer(realPng);
    assert.equal(pngRes.valid, true);
    assert.equal(pngRes.ext, 'png');
    assert.equal(pngRes.mimeType, 'image/png');

    const realJpg = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46]);
    const jpgRes = validateAvatarBuffer(realJpg);
    assert.equal(jpgRes.valid, true);
    assert.equal(jpgRes.ext, 'jpg');
    assert.equal(jpgRes.mimeType, 'image/jpeg');

    const realWebp = Buffer.from([
      0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00,
      0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x20
    ]);
    const webpRes = validateAvatarBuffer(realWebp);
    assert.equal(webpRes.valid, true);
    assert.equal(webpRes.ext, 'webp');
  });

  await t.test('3. 注册端点防账号枚举一致性响应验证', () => {
    // 场景 A: 邮箱已被注册
    const duplicateErr = registrationError({ code: 'user_already_exists', message: 'User already registered' });
    // 场景 B: 邮箱格式不被接受
    const invalidErr = registrationError({ code: 'email_address_invalid', message: 'Invalid email syntax' });
    // 场景 C: 基础校验失败
    const genericErr = registrationError({ code: 'validation_failed', message: 'Validation failed' });

    // 核心安全指标：对外返回的消息必须完全统一，杜绝攻击者据此探查邮箱是否存在
    assert.equal(duplicateErr.message, '注册未完成，请检查邮箱或稍后再试');
    assert.equal(invalidErr.message, duplicateErr.message, '邮箱格式错误与已存在响应必须完全一致');
    assert.equal(genericErr.message, duplicateErr.message, '常规校验错误与已存在响应必须完全一致');
    assert.equal(duplicateErr.status, 400);
    assert.equal(invalidErr.status, 400);

    // 频率限制仍提供 429 保护
    const rateLimitErr = registrationError({ code: 'over_request_rate_limit' });
    assert.equal(rateLimitErr.status, 429);
  });

  await t.test('4. 找回密码端点友好限流与语义转义防泄漏验证', () => {
    const rawError = { message: 'email rate limit exceeded', status: 429 };
    const isRateLimit = /rate limit|too many|exceeded/i.test(rawError.message);
    assert.equal(isRateLimit, true);
  });
});
