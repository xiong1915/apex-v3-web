import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchUserProfile, fetchAccountProfile, updateUserProfileApi, uploadAvatarApi, deleteAvatarApi } from '../lib/profile/client';
import { fetchCurrentSession, invalidateIdentityReads } from '../lib/auth/client';

test('concurrent session and profile readers share pending requests only', async () => {
  const original = globalThis.fetch;
  let calls = 0;
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  globalThis.fetch = (async (url: string) => { calls++; await pending; return Response.json(url.includes('profile') ? { profile: { id: 'a' } } : { user: { id: 'a' } }); }) as typeof fetch;
  try {
    const reads = [fetchCurrentSession(), fetchCurrentSession(), fetchUserProfile(), fetchUserProfile()];
    release(); await Promise.all(reads);
    assert.equal(calls, 2);
    await fetchUserProfile(); assert.equal(calls, 3);
  } finally { globalThis.fetch = original; invalidateIdentityReads(); }
});

test('profile failure remains an error while successful identity is retained', async () => {
 const original=globalThis.fetch;
 globalThis.fetch=(async(url:string)=>url.includes('profile')?Response.json({error:'资料暂不可用'},{status:503}):Response.json({user:{id:'a'}})) as typeof fetch;
 try {const result=await fetchAccountProfile();assert.equal(result.user?.id,'a');assert.equal(result.profile,null);assert.equal(result.error,'资料暂不可用');} finally{globalThis.fetch=original;invalidateIdentityReads();}
});

test('profile from a different account is never joined to current identity', async () => {
 const original=globalThis.fetch;
 globalThis.fetch=(async(url:string)=>Response.json(url.includes('profile')?{profile:{id:'old'}}:{user:{id:'new'}})) as typeof fetch;
 try{const result=await fetchAccountProfile();assert.equal(result.profile,null);assert.ok(result.error);}finally{globalThis.fetch=original;invalidateIdentityReads();}
});

test('explicit signed out and identity outage stay distinguishable',async()=>{
 const original=globalThis.fetch;
 try{
  globalThis.fetch=(async()=>Response.json({},{status:401})) as typeof fetch;
  assert.equal((await fetchAccountProfile()).error,undefined);
  globalThis.fetch=(async()=>Response.json({},{status:503})) as typeof fetch;
  assert.ok((await fetchAccountProfile()).error);
 }finally{globalThis.fetch=original;invalidateIdentityReads();}
});

test('identity invalidation prevents an old pending response becoming current', async () => {
  const original = globalThis.fetch;
  let release!: (response: Response) => void;
  globalThis.fetch = (() => new Promise(resolve => { release = resolve; })) as typeof fetch;
  try {
    const oldRead = fetchUserProfile();
    invalidateIdentityReads();
    release(Response.json({ profile: { id: 'old-account' } }));
    const result = await oldRead;
    assert.equal(result.profile, null);
    assert.ok(result.error);
  } finally { globalThis.fetch = original; invalidateIdentityReads(); }
});

test('each profile mutation binds its intended rendered account before sending',async()=>{
 const original=globalThis.fetch,owners:string[]=[];
 globalThis.fetch=(async(_url:any,init:any)=>{owners.push(new Headers(init.headers).get('x-apex-profile-owner')||'');return Response.json({profile:{id:'intended'}});}) as typeof fetch;
 try{
  await updateUserProfileApi({display_name:'名字'},'intended');
  await uploadAvatarApi(new Blob(['fixture']),'intended');
  await deleteAvatarApi('intended');
  assert.deepEqual(owners,['intended','intended','intended']);
  assert.ok((await updateUserProfileApi({},'')).error);
  assert.ok((await uploadAvatarApi(new Blob(), '')).error);
  assert.ok((await deleteAvatarApi('')).error);
  assert.equal(owners.length,3,'missing intended identity must never send mutation');
 }finally{globalThis.fetch=original;invalidateIdentityReads();}
});
