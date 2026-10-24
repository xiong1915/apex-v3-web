import test from 'node:test';
import assert from 'node:assert/strict';
import { RedisRateLimitStore } from '../lib/storage/redis';
test('limiter obtains count and TTL in one atomic operation',async()=>{
  let calls=0;
  const redis={eval:async(script:string,keys:string[],args:unknown[])=>{calls++;assert.match(script,/INCR/);assert.match(script,/EXPIRE/);assert.equal(args[0],60);return [2,55];}};
  const result=await new RedisRateLimitStore(redis as any).checkRateLimit('atomic',3,60);
  assert.equal(calls,1); assert.equal(result.remaining,1); assert.equal(result.allowed,true);
});
test('production AI quotas fail closed if Redis is unavailable',async()=>{
  const before=process.env.NODE_ENV;Reflect.set(process.env,'NODE_ENV','production');
  try {const store=new RedisRateLimitStore({eval:async()=>{throw new Error('offline');}} as any);assert.equal((await store.checkRateLimit('ai:user:test',10,60)).allowed,false);}
  finally{if(before===undefined)Reflect.deleteProperty(process.env,'NODE_ENV');else Reflect.set(process.env,'NODE_ENV',before);}
});
