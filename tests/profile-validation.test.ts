// tests/profile-validation.test.ts
// APEX V3 APEX ID 个人资料输入验证与头像安全性测试套件

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateDisplayName,
  validateFavoriteTeamIds,
  validateAvatarBuffer,
  MAX_AVATAR_BYTES
} from '../lib/profile/validation';

test('APEX ID 个人资料与头像安全校验专项测试', async (t) => {
  await t.test('1. 昵称长度与修剪校验', () => {
    // 正常中英文昵称
    const v1 = validateDisplayName('车手汉密尔顿');
    assert.equal(v1.valid, true);
    assert.equal(v1.value, '车手汉密尔顿');

    const v2 = validateDisplayName('  Max Verstappen  ');
    assert.equal(v2.valid, true);
    assert.equal(v2.value, 'Max Verstappen', '必须自动剥离首尾空格');

    // 边界：恰好 2 个字符
    const v3 = validateDisplayName('F1');
    assert.equal(v3.valid, true);
    assert.equal(v3.value, 'F1');

    // 边界：恰好 24 个字符
    const v24 = validateDisplayName('一二三四五六七八九十一二三四五六七八九十一二三四');
    assert.equal(v24.valid, true);

    // 过短拦截 (<2 字符)
    const tooShort1 = validateDisplayName('A');
    assert.equal(tooShort1.valid, false);
    assert.ok(tooShort1.error?.includes('至少需要 2 个字符'));

    const tooShortEmpty = validateDisplayName('     ');
    assert.equal(tooShortEmpty.valid, false);

    // 过长拦截 (>24 字符)
    const tooLong = validateDisplayName('一二三四五六七八九十一二三四五六七八九十一二三四五');
    assert.equal(tooLong.valid, false);
    assert.ok(tooLong.error?.includes('不能超过 24 个字符'));

    // 非字符串拦截
    const nonStr = validateDisplayName(null as any);
    assert.equal(nonStr.valid, false);
  });

  await t.test('2. 昵称非法控制字符与 XSS/HTML 注入拦截', () => {
    // 控制字符 (ASCII 0-31)
    const ctrl1 = validateDisplayName('Admin\u0000User');
    assert.equal(ctrl1.valid, false);
    assert.ok(ctrl1.error?.includes('控制字符'));

    const ctrl2 = validateDisplayName('Racer\u001B[31m');
    assert.equal(ctrl2.valid, false);

    // HTML / Script 标签注入
    const xss1 = validateDisplayName('<script>alert("hack")</script>');
    assert.equal(xss1.valid, false);
    assert.ok(xss1.error?.includes('HTML 标签'));

    const xss2 = validateDisplayName('<img src=x onerror=alert(1)>');
    assert.equal(xss2.valid, false);

    const xss3 = validateDisplayName('<b>速度之王</b>');
    assert.equal(xss3.valid, false);

    const xss4 = validateDisplayName('javascript:evil()');
    assert.equal(xss4.valid, false);
  });

  await t.test('3. 最爱车队校验、去重与别名归一化', () => {
    // 正常多选车队
    const teams1 = validateFavoriteTeamIds(['ferrari', 'mclaren', 'red_bull']);
    assert.equal(teams1.valid, true);
    assert.deepEqual(teams1.value, ['ferrari', 'mclaren', 'red_bull']);

    // 包含重复项与大小写
    const teamsDupe = validateFavoriteTeamIds(['Ferrari', 'ferrari', 'MCLAREN ']);
    assert.equal(teamsDupe.valid, true);
    assert.deepEqual(teamsDupe.value, ['ferrari', 'mclaren'], '必须自动去重并转小写规范化');

    // 历史车队别名映射 (sauber -> audi)
    const teamsAlias = validateFavoriteTeamIds(['sauber', 'kick_sauber']);
    assert.equal(teamsAlias.valid, true);
    assert.deepEqual(teamsAlias.value, ['audi'], 'sauber 与 kick_sauber 必须归一化为 audi 并去重');

    // 未知/非法车队 ID 拦截
    const teamsInvalid = validateFavoriteTeamIds(['ferrari', 'fake_racing_team']);
    assert.equal(teamsInvalid.valid, false);
    assert.ok(teamsInvalid.error?.includes('未知的 F1 车队标识'));

    // 非数组输入防御
    const nonArr = validateFavoriteTeamIds('ferrari' as any);
    assert.equal(nonArr.valid, false);
  });

  await t.test('4. 头像文件二进制 Magic Bytes 与格式校验', () => {
    // 真实 JPEG Magic Bytes: FF D8 FF
    const jpegBuffer = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46]);
    const vJpg = validateAvatarBuffer(jpegBuffer);
    assert.equal(vJpg.valid, true);
    assert.equal(vJpg.ext, 'jpg');
    assert.equal(vJpg.mimeType, 'image/jpeg');

    // 真实 PNG Magic Bytes: 89 50 4E 47 0D 0A 1A 0A
    const pngBuffer = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00]);
    const vPng = validateAvatarBuffer(pngBuffer);
    assert.equal(vPng.valid, true);
    assert.equal(vPng.ext, 'png');
    assert.equal(vPng.mimeType, 'image/png');

    // 真实 WebP Magic Bytes: RIFF....WEBP
    const webpBuffer = Buffer.from([
      0x52, 0x49, 0x46, 0x46, // RIFF
      0x20, 0x00, 0x00, 0x00,
      0x57, 0x45, 0x42, 0x50, // WEBP
      0x56, 0x50, 0x38, 0x20
    ]);
    const vWebp = validateAvatarBuffer(webpBuffer);
    assert.equal(vWebp.valid, true);
    assert.equal(vWebp.ext, 'webp');
    assert.equal(vWebp.mimeType, 'image/webp');

    // 空文件拦截
    assert.equal(validateAvatarBuffer(Buffer.alloc(0)).valid, false);

    // 超出 2MB 大小拦截
    const oversizedBuffer = Buffer.alloc(MAX_AVATAR_BYTES + 1);
    oversizedBuffer[0] = 0xFF;
    oversizedBuffer[1] = 0xD8;
    oversizedBuffer[2] = 0xFF;
    const vOver = validateAvatarBuffer(oversizedBuffer);
    assert.equal(vOver.valid, false);
    assert.ok(vOver.error?.includes('超过限制'));

    // 恶意 SVG 矢量文件拦截 (严防 XSS)
    const svgBuffer = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"></svg>');
    const vSvg = validateAvatarBuffer(svgBuffer);
    assert.equal(vSvg.valid, false);
    assert.ok(vSvg.error?.includes('不支持 SVG'));

    // 恶意 HTML 伪装文件拦截
    const htmlBuffer = Buffer.from('<!DOCTYPE html><html><body><script>alert(1)</script></body></html>');
    const vHtml = validateAvatarBuffer(htmlBuffer);
    assert.equal(vHtml.valid, false);

    // 伪造的非法二进制
    const fakeBin = Buffer.from([0x00, 0x01, 0x02, 0x03, 0x04]);
    assert.equal(validateAvatarBuffer(fakeBin).valid, false);
  });
});
