// Local identity fixtures only; no real sign-in, logout or profile changes.
const assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.QA_BASE_URL||'http://127.0.0.1:3100';
if(!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(base))throw Error('Localhost required');
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 const context=await browser.newContext({viewport:{width:1440,height:900}});
 let owner='a',hold=false,authFail=false,sessionReads=0,profileReads=0;const pending=[];
 const profile=id=>({id,display_name:id==='a'?'稳定账号 A':'新账号 B',avatar_url:null,favorite_team_ids:[],created_at:'2026-01-01T00:00:00Z'});
 const wait=async()=>{if(hold)await new Promise(resolve=>pending.push(resolve));};
 await context.route('**/api/auth/session',async r=>{sessionReads++;const id=owner,failed=authFail;await wait();return r.fulfill({status:failed?503:200,json:{user:id?{id,email:id+'@example.invalid'}:null,session:null}});});
 await context.route('**/api/profile',async r=>{profileReads++;const id=owner;await wait();return r.fulfill({status:id?200:401,json:{profile:id?profile(id):null}});});
 await context.route('**/api/auth/logout',r=>{owner=null;return r.fulfill({json:{ok:true}});});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/login');await page.locator('.account-button-text').filter({hasText:'稳定账号 A'}).waitFor();
 const initial={session:sessionReads,profile:profileReads};
 await page.locator('.account-button').evaluate(e=>{e.dataset.preserved='yes';});
 hold=true;
 for(const route of ['/drivers','/teams','/races']){
  await page.locator(`.nav-link[href="${route}"]`).click();await page.waitForURL('**'+route);await page.waitForTimeout(80);
  assert.equal(await page.locator('.account-button').isVisible(),true,'route changes must not blank account UI');
  assert.equal(await page.locator('.account-button').getAttribute('data-preserved'),'yes','account button must stay mounted');
 }
 assert.deepEqual({session:sessionReads,profile:profileReads},initial,'ordinary route navigation does not reload identity/profile');
 await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await page.waitForTimeout(100);
 assert.ok(sessionReads>initial.session,'focus still revalidates');
 assert.equal(await page.locator('.account-button-text').innerText(),'稳定账号 A','background verification keeps visible identity');
 assert.equal(await page.locator('.nav-actions').getByText('账户加载中…',{exact:true}).count(),0);
 // A real cross-tab identity change clears A, while an old held A response cannot overwrite B.
 owner='b';hold=false;
 await page.evaluate(()=>window.dispatchEvent(new StorageEvent('storage',{key:'apex:identity-revision',newValue:'changed'})));
 await page.locator('.account-button-text').filter({hasText:'新账号 B'}).waitFor();
 pending.splice(0).forEach(resolve=>resolve());await page.waitForTimeout(100);
 assert.equal(await page.locator('.account-button-text').innerText(),'新账号 B');
 authFail=true;await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
 await page.getByRole('button',{name:'账户暂不可用 · 重试',exact:true}).waitFor();
 assert.equal(await page.locator('.nav-login[href="/login"]').count(),0,'outage must not become a false signed-out state');
 authFail=false;await page.getByRole('button',{name:'账户暂不可用 · 重试',exact:true}).click();
 await page.locator('.account-button-text').filter({hasText:'新账号 B'}).waitFor();
 await page.evaluate(()=>window.dispatchEvent(new CustomEvent('apex:profile-updated',{detail:{id:'b',display_name:'更新昵称 B',avatar_url:null}})));
 await page.locator('.account-button-text').filter({hasText:'更新昵称 B'}).waitFor();
 await page.locator('.account-button').click();await page.getByRole('button',{name:'退出登录',exact:true}).click();
 await page.locator('.nav-login[href="/login"]').waitFor();assert.equal(await page.locator('.account-button').count(),0);
 assert.deepEqual(errors,[]);console.log('PASS navbar identity: no route reload or remount, quiet focus revalidation, cross-tab switch, stale-response isolation, outage/retry recovery, profile update and logout');
 await context.close();
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
