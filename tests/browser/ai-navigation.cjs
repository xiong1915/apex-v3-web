// Isolated browser regression: auth/history are local fixtures; no real AI or account writes.
const assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.QA_BASE_URL||'http://127.0.0.1:3100';
if(!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(base))throw Error('Localhost required');
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 const context=await browser.newContext();let signedIn=true,chats=0,releaseHistory;
 let delayHistory=true;const historyGate=new Promise(resolve=>{releaseHistory=resolve;});
 const user={id:'navigation-fixture',email:'navigation@example.invalid'};
 await context.route('**/api/auth/session',r=>r.fulfill({json:{user:signedIn?user:null,session:null}}));
 await context.route('**/api/auth/login',r=>{signedIn=true;return r.fulfill({json:{user,session:null}});});
 await context.route('**/api/ai/conversations*',async r=>{if(delayHistory)await historyGate;return r.fulfill({json:{conversations:[]}});});
 await context.route('**/api/ai/chat',r=>{chats++;return r.fulfill({status:503,json:{error:'No automatic model calls allowed in this test'}});});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/drivers/antonelli');
 const driver=await page.locator('h1').innerText();
 const started=Date.now();await page.getByRole('link',{name:/向 APEX AI 了解这位车手/}).click();
 const input=page.getByRole('textbox',{name:'向 APEX AI 提问'});await input.waitFor();
 await page.waitForFunction(name=>document.querySelector('textarea')?.value.includes(name),driver,{timeout:3000});
 assert.equal(await input.isEnabled(),true,'draft is editable before slow history completes');
 console.log(`AI draft available in ${Date.now()-started}ms while history remains pending (local fixture)`);
 assert.match(await page.locator('.history-save-status').innerText(),/正在读取历史/);
 assert.equal(chats,0,'context link must prefill without sending');
 delayHistory=false;releaseHistory();
 await input.fill('我修改过的问题');
 await page.evaluate(()=>history.pushState(null,'','/ai?draft='+encodeURIComponent('再次带入的问题')));
 await page.waitForFunction(()=>document.querySelector('textarea')?.value==='再次带入的问题');
 await input.fill('暂时编辑的草稿');await page.evaluate(()=>history.pushState(null,'','/ai'));await page.waitForTimeout(50);
 await page.evaluate(()=>history.pushState(null,'','/ai?draft='+encodeURIComponent('再次带入的问题')));
 await page.waitForFunction(()=>document.querySelector('textarea')?.value==='再次带入的问题');
 assert.equal(chats,0,'same-page handoff must not submit');
 for(const width of [390,1440]){
  await page.setViewportSize({width,height:900});
  await page.goto(base+'/teams/mercedes');const team=await page.locator('h1').innerText();
  await page.getByRole('link',{name:/向 APEX AI 了解这支车队/}).click();await input.waitFor();
  await page.waitForFunction(name=>document.querySelector('textarea')?.value.includes(name),team);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  if(process.env.QA_ARTIFACT_DIR){const fs=require('node:fs'),path=require('node:path');fs.mkdirSync(process.env.QA_ARTIFACT_DIR,{recursive:true});await page.screenshot({path:path.join(process.env.QA_ARTIFACT_DIR,`ai-prefill-${width}.png`)});}
 }
 await page.goto(base+'/');await page.locator('#race-cockpit').getByRole('link',{name:/AI 赛事分析/}).click();
 await input.waitFor();assert.match(await input.inputValue(),/大奖赛/);assert.equal(chats,0);
 await page.goto(base+'/drivers/antonelli');await page.locator('.nav-ai').click();await input.waitFor();
 assert.equal(new URL(page.url()).pathname,'/ai');
 await page.setViewportSize({width:390,height:900});await page.goto(base+'/drivers/antonelli');
 await page.getByRole('button',{name:'切换导航菜单'}).click();
 await page.getByRole('dialog').getByRole('link',{name:/APEX AI/}).click();await input.waitFor();
 assert.equal(await page.getByRole('dialog').count(),0,'mobile navigation closes after opening AI');
 await page.goto(base+'/teams');await page.locator('footer a[href="/ai"]').click();await input.waitFor();
 // Signed-out visitors must keep the draft through the real login form/callback.
 signedIn=false;await page.goto(base+'/drivers/antonelli');await page.getByRole('link',{name:/向 APEX AI 了解这位车手/}).click();
 await page.waitForURL('**/login?**');const next=new URL(page.url()).searchParams.get('returnUrl');
 assert.ok(next.startsWith('/ai?draft='),'login return path preserves the question');
 await page.getByLabel('电子邮箱',{exact:true}).fill('navigation@example.invalid');
 await page.locator('#auth-password').fill('local-test-password');
 await page.getByRole('button',{name:'登录账号',exact:true}).click();
 await input.waitFor();await page.waitForFunction(name=>document.querySelector('textarea')?.value.includes(name),driver);
 assert.equal(chats,0);
 // A slow history read is bounded and never discards the prepared question.
 let releaseSlowHistory;const slowHistory=new Promise(resolve=>{releaseSlowHistory=resolve;});
 await context.route('**/api/ai/conversations*',async r=>{await slowHistory;await r.abort().catch(()=>{});});
 await page.clock.install();await page.goto(base+'/ai?draft='+encodeURIComponent('慢历史请求中的问题'));
 await page.waitForFunction(()=>document.querySelector('textarea')?.value==='慢历史请求中的问题');
 await page.clock.fastForward(13000);
 await page.getByText('历史对话读取超时，请重试；当前输入已保留',{exact:true}).waitFor();
 assert.equal(await input.inputValue(),'慢历史请求中的问题');releaseSlowHistory();
 // A slow identity read produces a retryable outage, never a false signed-out redirect.
 let releaseIdentity;const identityGate=new Promise(resolve=>{releaseIdentity=resolve;});
 await context.route('**/api/auth/session',async r=>{await identityGate;await r.abort().catch(()=>{});});
 await page.goto(base+'/ai?draft='+encodeURIComponent('登录验证中的问题'));
 await page.getByRole('status').filter({hasText:'正在确认登录状态'}).waitFor();
 await page.clock.fastForward(13000);await page.getByRole('alert').filter({hasText:'登录验证超时'}).waitFor();
 assert.equal(new URL(page.url()).pathname,'/ai');releaseIdentity();
 assert.equal(chats,0);assert.deepEqual(errors,[]);
 // Delay the route payload itself: clicking a main navigation link must give feedback.
 const navigation=await browser.newContext();let releaseRoute;const routeGate=new Promise(resolve=>{releaseRoute=resolve;});
 await navigation.route('**/api/auth/session',r=>r.fulfill({json:{user:null,session:null}}));
 await navigation.route('**/races?**',async r=>{if(r.request().headers().rsc==='1'&&!r.request().headers()['next-router-prefetch'])await routeGate;return r.continue();});
 const destination=await navigation.newPage();await destination.goto(base+'/drivers/antonelli');
 await destination.locator('.nav-link[href="/races"]').click({noWaitAfter:true});
 await destination.getByText(/正在打开页面|加载较慢/).first().waitFor({timeout:5000});
 releaseRoute();await destination.waitForURL('**/races');await destination.getByRole('heading',{name:'赛季日历',exact:true}).waitFor();
 await navigation.close();
 console.log('PASS AI navigation: driver/team/race links, editable draft before history, same-page handoff, generic navigation, login round trip, no automatic AI request');
 await context.close();
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
