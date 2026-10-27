// Local mocked responses only. Never creates a real account or sends a real email.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const base=process.env.QA_BASE_URL||'http://127.0.0.1:3100';if(!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(base))throw Error('Localhost required');
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 const page=await browser.newPage({viewport:{width:390,height:844}});let calls=0,release;const gate=new Promise(resolve=>{release=resolve;});
 await page.route('**/api/auth/session',r=>r.fulfill({json:{user:null,session:null}}));
 await page.route('**/api/auth/register',async r=>{calls++;await gate;return r.fulfill({status:429,headers:{'Retry-After':'60'},json:{error:'email rate limit exceeded'}});});
 await page.goto(base+'/register');await page.clock.install();
 await page.getByLabel('电子邮箱',{exact:true}).fill('test@example.invalid');await page.locator('#auth-password').fill('test-password-123');await page.locator('#auth-confirm').fill('test-password-123');
 await page.locator('form').evaluate(form=>{form.requestSubmit();form.requestSubmit();});await page.waitForTimeout(100);assert.equal(calls,1);
 release();await page.getByRole('alert').filter({hasText:'验证邮件发送已触发限流'}).waitFor();
 assert.equal(await page.getByRole('button',{name:/请等待.*秒再重试/}).isDisabled(),true);assert.equal(await page.getByLabel('电子邮箱',{exact:true}).inputValue(),'test@example.invalid');
 await page.reload();await page.getByRole('button',{name:/请等待.*秒再重试/}).waitFor();assert.equal(calls,1,'reload never resends signup');
 await page.clock.install();await page.clock.fastForward(61000);assert.equal(await page.getByRole('button',{name:'立即注册',exact:true}).isEnabled(),true);
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 if(process.env.QA_ARTIFACT_DIR){fs.mkdirSync(process.env.QA_ARTIFACT_DIR,{recursive:true});await page.screenshot({path:path.join(process.env.QA_ARTIFACT_DIR,'registration-390.png'),fullPage:true});}
 console.log('PASS registration: localized quota error, one inflight submission, cooldown/reload persistence, manual retry, mobile layout; no email sent');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
