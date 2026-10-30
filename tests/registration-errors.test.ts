import test from 'node:test';
import assert from 'node:assert/strict';
import {registrationError} from '../lib/auth/registration-error';
import fs from 'node:fs';
import vm from 'node:vm';
import {stripTypeScriptTypes} from 'node:module';
import {NextRequest,NextResponse} from 'next/server';
test('email quota remains a failure with actionable Chinese text and minimum retry interval',()=>{
 const error=registrationError({code:'over_email_send_rate_limit',message:'email rate limit exceeded',status:400});
 assert.equal(error.status,429);assert.equal(error.code,'over_email_send_rate_limit');assert.equal(error.retryAfterSeconds,60);assert.match(error.message,/验证邮件/);assert.doesNotMatch(error.message,/email rate limit/i);
});
test('actual signup route returns quota failure once without a second email sender',async()=>{
 let signups=0;
 const dependencies:Record<string,unknown>={
  '@/lib/auth/config':{AUTH_CONFIG:{},isSupabaseConfigured:()=>true,isMockAuthAllowed:()=>false},
  '@/lib/auth/server':{getTrustedPublicOrigin:()=> 'https://example.invalid',createSupabaseServerClient:async()=>({auth:{signUp:async()=>{signups++;return {data:{user:null},error:{status:400,code:'over_email_send_rate_limit',message:'email rate limit exceeded'}};}}})},
  '@/lib/auth/mock':{mockAuthManager:{}},'@/lib/auth/email':{sendVerificationEmail:()=>{throw Error('must not send a second email');}},
  '@/lib/auth/registration-error':{registrationError},'next/server':{NextRequest,NextResponse}
 };
 const source=fs.readFileSync(new URL('../app/api/auth/register/route.ts',import.meta.url),'utf8');
 const compiled=stripTypeScriptTypes(source,{mode:'strip'}).replace(/import \{([^}]+)\} from ['"]([^'"]+)['"];?/g,'const {$1}=require("$2");').replace(/export /g,'')+'\nmodule.exports=POST;';
 const module={exports:null as any};vm.runInNewContext(compiled,{module,require:(name:string)=>{if(!(name in dependencies))throw Error('Unexpected dependency '+name);return dependencies[name];}});
 const response=await module.exports(new NextRequest('https://example.invalid/api/auth/register',{method:'POST',body:JSON.stringify({email:'test@example.invalid',password:'test-only-password123'})}));
 assert.equal(response.status,429);assert.equal(response.headers.get('retry-after'),'60');assert.match((await response.json()).error,/验证邮件/);assert.equal(signups,1);
});
test('unauthorized recipient and unexpected upstream errors do not leak provider internals',()=>{
 assert.equal(registrationError({code:'email_address_not_authorized',message:'Email address not authorized',status:400}).status,503);
 assert.doesNotMatch(registrationError({message:'database secret-details',status:500}).message,/secret-details/);
 assert.match(registrationError({code:'weak_password',status:422}).message,/密码/);
});
