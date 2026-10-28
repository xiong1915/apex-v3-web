import test from 'node:test';
import assert from 'node:assert/strict';
import {NextRequest} from 'next/server';
import { mockAuthManager, DEFAULT_MOCK_ADMIN_PASS, DEFAULT_MOCK_USER_PASS} from '../lib/auth/mock';
import {AUTH_CONFIG} from '../lib/auth/config';
import {PATCH} from '../app/api/profile/route';
import {POST,DELETE} from '../app/api/profile/avatar/route';
import {getUserProfile,resetMemoryProfileStore,updateUserProfile,uploadUserAvatar} from '../lib/profile/service';

test('stale account A form cannot mutate account B after cookie changes',async()=>{
 mockAuthManager.reset();resetMemoryProfileStore();
 const signIn=(email:string)=>{mockAuthManager.register(email,DEFAULT_MOCK_USER_PASS);mockAuthManager.verifyEmail(mockAuthManager.sentEmails.find(row=>row.to===email)!.token);return mockAuthManager.login(email,DEFAULT_MOCK_USER_PASS);};
 const a=signIn('owner-a@example.test'),b=signIn('owner-b@example.test');
 await updateUserProfile(b.user,{display_name:'B 原始资料',favorite_team_ids:['ferrari']});
 // Existing valid PNG fixture, same minimal magic signature used by profile validation.
 const png=Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000b49444154789c636000020000050001a5f645400000000049454e44ae426082','hex');
 const avatar=await uploadUserAvatar(b.user,png);assert.equal(avatar.error,undefined);
 const before=await getUserProfile(b.user);
 for(const [method,path,handler,body] of [
  ['PATCH','/api/profile',PATCH,JSON.stringify({display_name:'A stale edits',favorite_team_ids:['mclaren']})],
  ['POST','/api/profile/avatar',POST,png],
  ['DELETE','/api/profile/avatar',DELETE,undefined]
 ] as const){
  const request=new NextRequest(`http://localhost${path}`,{method,headers:{cookie:`${AUTH_CONFIG.cookieName}=${b.session!.access_token}`,'x-apex-profile-owner':a.user.id,'content-type':method==='POST'?'image/png':'application/json'},body});
  const response=await handler(request);assert.equal(response.status,409,method);assert.equal(response.headers.get('cache-control'),'private, no-store');
  const after=await getUserProfile(b.user);assert.equal(after.display_name,before.display_name);assert.deepEqual(after.favorite_team_ids,before.favorite_team_ids);assert.equal(after.avatar_path,before.avatar_path);
 }
 const own=new NextRequest('http://localhost/api/profile',{method:'PATCH',headers:{cookie:`${AUTH_CONFIG.cookieName}=${b.session!.access_token}`,'x-apex-profile-owner':b.user.id,'content-type':'application/json'},body:JSON.stringify({display_name:'B 正确更新'})});
 assert.equal((await PATCH(own)).status,200);
});
