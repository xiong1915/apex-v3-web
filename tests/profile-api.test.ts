// tests/profile-api.test.ts
// APEX V3 APEX ID 个人资料与头像 API 端到端集成与安全隔离测试套件

import test from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { mockAuthManager } from '../lib/auth/mock';
import { AUTH_CONFIG } from '../lib/auth/config';
import { GET as getProfileRoute, PATCH as patchProfileRoute } from '../app/api/profile/route';
import { POST as postAvatarRoute, DELETE as deleteAvatarRoute } from '../app/api/profile/avatar/route';
import { resetMemoryProfileStore } from '../lib/profile/service';

function createAuthedRequest(method: string, url: string, token: string, body?: any, contentType?: string): NextRequest {
  const headers: Record<string, string> = {
    'cookie': `${AUTH_CONFIG.cookieName}=${token}`
  };
  if (contentType) {
    headers['content-type'] = contentType;
  } else if (body && typeof body === 'object' && !(body instanceof Uint8Array)) {
    headers['content-type'] = 'application/json';
  }

  let requestBody: any = undefined;
  if (body) {
    if (typeof body === 'string' || body instanceof Uint8Array) {
      requestBody = body;
    } else {
      requestBody = JSON.stringify(body);
    }
  }

  return new NextRequest(new URL(url, 'https://f1.tike69.cc.cd'), {
    method,
    headers,
    body: requestBody
  });
}

test('APEX ID 个人中心 API 鉴权、持久化与多用户数据隔离测试', async (t) => {
  mockAuthManager.reset();
  resetMemoryProfileStore();

  // 预置两个独立的测试用户
  const user1Email = 'driver_alonso@f1.com';
  const user2Email = 'driver_leclerc@f1.com';

  mockAuthManager.register(user1Email, 'Formula1Pass2026!');
  mockAuthManager.verifyEmail(mockAuthManager.sentEmails.find(e => e.to === user1Email)!.token);
  const login1 = mockAuthManager.login(user1Email, 'Formula1Pass2026!');
  const tokenUser1 = login1.session!.access_token;
  const user1Id = login1.user.id;

  mockAuthManager.register(user2Email, 'Formula1Pass2026!');
  mockAuthManager.verifyEmail(mockAuthManager.sentEmails.find(e => e.to === user2Email)!.token);
  const login2 = mockAuthManager.login(user2Email, 'Formula1Pass2026!');
  const tokenUser2 = login2.session!.access_token;
  const user2Id = login2.user.id;

  await t.test('1. 未登录拦截 (401 Unauthorized)', async () => {
    const unauthedReq = new NextRequest(new URL('/api/profile', 'https://f1.tike69.cc.cd'), { method: 'GET' });
    const res = await getProfileRoute(unauthedReq);
    assert.equal(res.status, 401);
    const json = await res.json();
    assert.equal(json.error, '请先登录');
  });

  await t.test('2. 登录用户初次获取个人资料 (自动补全 Profile)', async () => {
    const req = createAuthedRequest('GET', '/api/profile', tokenUser1);
    const res = await getProfileRoute(req);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('cache-control'), 'private, no-store');

    const { profile } = await res.json();
    assert.equal(profile.id, user1Id);
    assert.equal(profile.email, user1Email);
    assert.ok(profile.display_name);
    assert.deepEqual(profile.favorite_team_ids, []);
    assert.equal(profile.avatar_path, null);
  });

  await t.test('3. 昵称与最爱车队修改持久化 (PATCH /api/profile)', async () => {
    const patchReq = createAuthedRequest('PATCH', '/api/profile', tokenUser1, {
      display_name: '头哥阿隆索',
      favorite_team_ids: ['aston_martin', 'ferrari']
    });

    const res = await patchProfileRoute(patchReq);
    assert.equal(res.status, 200);
    const { profile } = await res.json();
    assert.equal(profile.display_name, '头哥阿隆索');
    assert.deepEqual(profile.favorite_team_ids, ['aston_martin', 'ferrari']);

    // 二次读取确认持久化存在
    const getReq = createAuthedRequest('GET', '/api/profile', tokenUser1);
    const getRes = await getProfileRoute(getReq);
    const { profile: refreshed } = await getRes.json();
    assert.equal(refreshed.display_name, '头哥阿隆索');
    assert.deepEqual(refreshed.favorite_team_ids, ['aston_martin', 'ferrari']);
  });

  await t.test('4. 越权与恶意参数防御 (禁止通过 profile 修改 role/admin/mfa)', async () => {
    const maliciousReq = createAuthedRequest('PATCH', '/api/profile', tokenUser1, {
      display_name: '普通车迷',
      role: 'admin',
      isAdmin: true,
      aal: 'aal2'
    });

    const res = await patchProfileRoute(maliciousReq);
    assert.equal(res.status, 200);
    const { profile } = await res.json();
    assert.equal(profile.display_name, '普通车迷');
    assert.equal((profile as any).role, undefined, '绝不允许在 profile 中注入角色字段');
    assert.equal((profile as any).isAdmin, undefined);
  });

  await t.test('5. 用户头像上传、隔离与删除 (POST & DELETE /api/profile/avatar)', async () => {
    // 制作合法 PNG 头像二进制
    const validPng = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x01, 0x02]);
    const uploadReq = createAuthedRequest('POST', '/api/profile/avatar', tokenUser1, validPng, 'image/png');

    const uploadRes = await postAvatarRoute(uploadReq);
    assert.equal(uploadRes.status, 200);
    const { profile: updatedProfile } = await uploadRes.json();
    assert.ok(updatedProfile.avatar_path);
    assert.ok(updatedProfile.avatar_path.startsWith(`${user1Id}/avatar-`));
    assert.ok(updatedProfile.avatar_url);

    // 删除头像
    const deleteReq = createAuthedRequest('DELETE', '/api/profile/avatar', tokenUser1);
    const deleteRes = await deleteAvatarRoute(deleteReq);
    assert.equal(deleteRes.status, 200);
    const { profile: deletedProfile } = await deleteRes.json();
    assert.equal(deletedProfile.avatar_path, null);
  });

  await t.test('6. 多用户数据彻底隔离验证 (User1 与 User2 互不干扰)', async () => {
    // 1. 设置 User2 的独立资料
    const patch2 = createAuthedRequest('PATCH', '/api/profile', tokenUser2, {
      display_name: '夏尔·法拉利之王',
      favorite_team_ids: ['ferrari']
    });
    const res2 = await patchProfileRoute(patch2);
    assert.equal(res2.status, 200);
    const { profile: prof2 } = await res2.json();
    assert.equal(prof2.id, user2Id);
    assert.equal(prof2.display_name, '夏尔·法拉利之王');
    assert.deepEqual(prof2.favorite_team_ids, ['ferrari']);

    // 2. 读取 User1，确认未受 User2 影响
    const get1 = createAuthedRequest('GET', '/api/profile', tokenUser1);
    const res1 = await getProfileRoute(get1);
    const { profile: prof1 } = await res1.json();
    assert.equal(prof1.id, user1Id);
    assert.equal(prof1.display_name, '普通车迷');
    assert.deepEqual(prof1.favorite_team_ids, ['aston_martin', 'ferrari']);
    assert.notEqual(prof1.id, prof2.id);
  });
});
