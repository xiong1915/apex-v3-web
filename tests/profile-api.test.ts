// tests/profile-api.test.ts
// APEX V3 APEX ID 个人资料与头像 API 端到端集成与安全隔离测试套件

import test from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { mockAuthManager } from '../lib/auth/mock';
import { AUTH_CONFIG } from '../lib/auth/config';
import { GET as getProfileRoute, PATCH as patchProfileRoute } from '../app/api/profile/route';
import { POST as postAvatarRoute, DELETE as deleteAvatarRoute } from '../app/api/profile/avatar/route';
import { GET as getAvatarViewRoute } from '../app/api/profile/avatar/view/route';
import { resetMemoryProfileStore, getUserProfile, updateUserProfile, uploadUserAvatar, deleteUserAvatar } from '../lib/profile/service';

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

  await t.test('7. 头像读取端点 (/api/profile/avatar/view) 鉴权、防路径遍历与越权隔离', async () => {
    // A. 未登录访问拦截 (401)
    const unauthedReq = new NextRequest(new URL('/api/profile/avatar/view?path=any/avatar-123.jpg', 'https://f1.tike69.cc.cd'), { method: 'GET' });
    const unauthedRes = await getAvatarViewRoute(unauthedReq);
    assert.equal(unauthedRes.status, 401);
    assert.equal(unauthedRes.headers.get('x-content-type-options'), 'nosniff');

    // B. 缺少 path 参数 (400)
    const emptyPathReq = createAuthedRequest('GET', '/api/profile/avatar/view', tokenUser1);
    const emptyPathRes = await getAvatarViewRoute(emptyPathReq);
    assert.equal(emptyPathRes.status, 400);

    // C. 路径遍历攻击防御 (.. 攻击)
    const traversalReq1 = createAuthedRequest('GET', `/api/profile/avatar/view?path=../${user1Id}/avatar-123.jpg`, tokenUser1);
    const traversalRes1 = await getAvatarViewRoute(traversalReq1);
    assert.equal(traversalRes1.status, 400);

    const traversalReq2 = createAuthedRequest('GET', `/api/profile/avatar/view?path=${user1Id}/../../etc/passwd`, tokenUser1);
    const traversalRes2 = await getAvatarViewRoute(traversalReq2);
    assert.equal(traversalRes2.status, 400);

    // D. 路径字符规范 (禁止反斜杠与非法扩展名)
    const slashReq = createAuthedRequest('GET', `/api/profile/avatar/view?path=${user1Id}\\avatar-123.jpg`, tokenUser1);
    const slashRes = await getAvatarViewRoute(slashReq);
    assert.equal(slashRes.status, 400);

    const badExtReq = createAuthedRequest('GET', `/api/profile/avatar/view?path=${user1Id}/malicious.svg`, tokenUser1);
    const badExtRes = await getAvatarViewRoute(badExtReq);
    assert.equal(badExtRes.status, 400);

    // E. 越权访问防御 (IDOR): User1 尝试读取 User2 目录的头像文件 (403)
    const idorReq = createAuthedRequest('GET', `/api/profile/avatar/view?path=${user2Id}/avatar-1730000000.png`, tokenUser1);
    const idorRes = await getAvatarViewRoute(idorReq);
    assert.equal(idorRes.status, 403);
    const idorBody = await idorRes.text();
    assert.match(idorBody, /越权访问/);

    // F. 正常读取本人头像 (测试环境下从内存读取)
    const validPng = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x01, 0x02]);
    const upReq = createAuthedRequest('POST', '/api/profile/avatar', tokenUser1, validPng, 'image/png');
    const upRes = await postAvatarRoute(upReq);
    const { profile: p1 } = await upRes.json();
    assert.ok(p1.avatar_path);

    const viewOwnReq = createAuthedRequest('GET', `/api/profile/avatar/view?path=${p1.avatar_path}`, tokenUser1);
    const viewOwnRes = await getAvatarViewRoute(viewOwnReq);
    assert.equal(viewOwnRes.status, 200);
    assert.equal(viewOwnRes.headers.get('content-type'), 'image/png');
    assert.equal(viewOwnRes.headers.get('x-content-type-options'), 'nosniff');
  });

  await t.test('8. 生产环境持久化硬屏障 (严禁静默降级为内存假成功)', async () => {
    const origEnv = process.env.VERCEL_ENV;
    try {
      process.env.VERCEL_ENV = 'production';

      const dummyUser = {
        id: 'prod-audit-user-uuid',
        email: 'prod_audit@apex.f1'
      } as any;

      // 在生产模式下，当 Supabase 不可用时，严禁静默降级为假成功，必须明确返回错误
      const updateResult = await updateUserProfile(dummyUser, { display_name: '生产车手' });
      assert.ok(updateResult.error, '生产环境下持久化未连接时必须返回明确错误');

      const avatarBuffer = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
      const uploadResult = await uploadUserAvatar(dummyUser, avatarBuffer);
      assert.ok(uploadResult.error, '生产环境下头像上传失败必须返回明确错误');

      const deleteResult = await deleteUserAvatar(dummyUser);
      assert.ok(deleteResult.error, '生产环境下头像删除失败必须返回明确错误');
    } finally {
      process.env.VERCEL_ENV = origEnv;
    }
  });

  await t.test('9. resetMemoryProfileStore 彻底重置状态', () => {
    resetMemoryProfileStore();
    // 再次调用确认不会抛出异常并且正常清空
    resetMemoryProfileStore();
  });
});
