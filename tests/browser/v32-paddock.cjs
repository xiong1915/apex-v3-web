const assert=require('node:assert/strict');
let chromium;
try {chromium=require(process.env.PLAYWRIGHT_MODULE||'playwright').chromium;}
catch {chromium=require('C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright').chromium;}
const base=process.env.QA_BASE_URL||'http://127.0.0.1:3100';
if(!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(base))throw Error('Localhost server required');
const user={id:'paddock-fixture-user',email:'paddock@example.test',created_at:'2026-01-01T00:00:00Z'};
const profile={...user,display_name:'围场测试车迷',avatar_url:null,avatar_path:null,favorite_team_ids:['ferrari','mclaren'],provider:'email',updated_at:'2026-01-01T00:00:00Z'};
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'chrome'});
 try{
  const context=await browser.newContext({viewport:{width:1440,height:960}});
  const page=await context.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  let state='ready',release,account=user,accountProfile=profile;
  const gate=new Promise(resolve=>{release=resolve;});
  let delayed=true;
  await page.context().route('**/api/auth/session',async route=>{if(delayed)await gate;await route.fulfill({status:state==='auth-error'?503:200,json:state==='signed-out'?{user:null,session:null}:state==='auth-error'?{error:'身份服务暂不可用'}:{user:account,session:{}}});});
  await page.context().route('**/api/profile',async route=>{if(delayed)await gate;await route.fulfill({status:state==='profile-error'?503:state==='signed-out'?401:200,json:state==='profile-error'?{error:'测试资料读取失败'}:{profile:state==='empty'?{...accountProfile,favorite_team_ids:[]}:accountProfile}});});
  await page.goto(base+'/',{waitUntil:'domcontentloaded',timeout:90000});
  await page.locator('.nav-actions [role="status"]').waitFor();
  assert.equal(await page.locator('.nav-login[href="/login"]').count(),0,'pending identity must not flash anonymous login');
  delayed=false;release();
  await page.getByText('已登录，可直接开启对话',{exact:true}).waitFor();
  const paddock=page.locator('#paddock');
  await paddock.locator('a[href="/teams/ferrari"]').waitFor({timeout:90000});
  assert.equal(await paddock.locator('article').count(),2,'only persisted favorite IDs appear');
  for(const width of [320,375,390,768,1440,1920]){
   await page.setViewportSize({width,height:width<768?844:960});
   await page.waitForTimeout(100);
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`overflow at ${width}`);
   assert.equal(await paddock.locator('table').count(),2,'one aligned driver table per team');
   if(process.env.QA_ARTIFACT_DIR){const fs=require('node:fs'),path=require('node:path');fs.mkdirSync(process.env.QA_ARTIFACT_DIR,{recursive:true});await paddock.screenshot({path:path.join(process.env.QA_ARTIFACT_DIR,`paddock-${width}.png`),animations:'disabled',style:'.site-header,.skip-link{visibility:hidden!important}'});}
  }
  const range=paddock.locator('article details').first();await range.locator('summary').focus();await page.keyboard.press('Enter');assert.equal(await range.getAttribute('open'),'');assert.match(await range.innerText(),/截止|待核实/);await range.locator('summary').press('Enter');
  const source=paddock.locator('details').last();await source.locator('summary').click();await source.getByRole('link',{name:/查看积分榜统计范围与来源/}).waitFor();
  await page.locator('#race-cockpit').waitFor({timeout:90000});
  assert.match(await page.locator('#race-cockpit').innerText(),/预计|计划|实际开始|时间待公布|暂不可用/);
  const cockpit=page.locator('#race-cockpit');await cockpit.getByRole('heading',{name:'周末时间表',exact:true}).waitFor();
  for(const width of [320,390,768,1440,1920]){await page.setViewportSize({width,height:960});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`cockpit overflow at ${width}`);if(process.env.QA_ARTIFACT_DIR){const fs=require('node:fs'),path=require('node:path');await cockpit.screenshot({path:path.join(process.env.QA_ARTIFACT_DIR,`cockpit-${width}.png`),animations:'disabled',style:'.site-header,.skip-link{visibility:hidden!important}'});}}
  const explanation=cockpit.locator('details').last();await explanation.locator('summary').focus();await page.keyboard.press('Enter');assert.equal(await explanation.getAttribute('open'),'');assert.match(await explanation.innerText(),/未收录成绩不代表比赛尚未结束/);
  const detailLinks=page.locator('#race-cockpit a[href*="/races/"]');
  if(await detailLinks.count())assert.match(await detailLinks.first().getAttribute('href'),/\?season=\d{4}/);
  assert.equal(await page.locator('#race-cockpit a[href*="/races/0"]').count(),0,'unavailable calendar must not invent round 0');
  // A delayed update for another account must not replace persisted favorites.
  await page.evaluate(()=>window.dispatchEvent(new CustomEvent('apex:profile-updated',{detail:{id:'old-account',favorite_team_ids:['red_bull']}})));
  assert.equal(await paddock.locator('article').count(),2);
  state='empty';await page.evaluate(()=>window.dispatchEvent(new Event('apex:identity-changed')));
  await paddock.getByText(/你还没有收藏车队/).waitFor();
  state='profile-error';await page.evaluate(()=>window.dispatchEvent(new Event('apex:identity-changed')));
  await paddock.getByRole('alert').waitFor();assert.match(await paddock.innerText(),/测试资料读取失败/);
  state='ready';await paddock.getByRole('button',{name:'重新加载'}).click();await paddock.locator('article').first().waitFor();
  state='auth-error';await page.evaluate(()=>window.dispatchEvent(new Event('apex:identity-changed')));
  await paddock.getByRole('alert').waitFor();assert.equal(await paddock.getByRole('link',{name:/登录 APEX ID/}).count(),0);
  state='signed-out';await paddock.getByRole('button',{name:'重新加载'}).click();await paddock.getByRole('link',{name:/登录 APEX ID/}).waitFor();
  state='profile-error';await page.goto(base+'/profile',{waitUntil:'domcontentloaded'});await page.getByRole('heading',{name:'个人资料暂不可用'}).waitFor();
  assert.equal(await page.locator('#nickname-input').count(),0,'failed profile must not show editable invented defaults');
  state='ready';await page.getByRole('button',{name:'重新连接'}).click();await page.locator('#nickname-input').waitFor();assert.equal(await page.locator('#nickname-input').inputValue(),profile.display_name);
  await page.locator('input[type="file"]').setInputFiles({name:'private-a.png',mimeType:'image/png',buffer:Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000b49444154789c636000020000050001a5f645400000000049454e44ae426082','hex')});
  await page.getByRole('dialog',{name:'调整头像位置与缩放'}).waitFor();
  const other=await page.context().newPage();await other.goto(base+'/login',{waitUntil:'domcontentloaded'});
  account={...user,id:'account-b',email:'b@example.test'};accountProfile={...profile,...account,display_name:'账号乙',favorite_team_ids:['mclaren']};
  await other.evaluate(()=>localStorage.setItem('apex:identity-revision',String(Date.now())));
  await page.waitForFunction(()=>document.querySelector('#nickname-input')?.value==='账号乙');
  assert.equal(await page.getByRole('dialog',{name:'调整头像位置与缩放'}).count(),0,'old account avatar draft must close after identity changes');
  assert.equal(await page.locator('.identity-card').getByText(profile.display_name,{exact:true}).count(),0,'cross-tab account signal must clear old identity');
  account={...user,id:'account-c',email:'c@example.test'};accountProfile={...profile,...account,display_name:'账号丙'};
  await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
  await page.waitForFunction(()=>document.querySelector('#nickname-input')?.value==='账号丙');
  await other.close();
  assert.deepEqual(errors,[]);
  console.log('PASS: persisted favorites, six responsive widths and keyboard-accessible data details, explicit identity/profile failures, retry, no login flash, stale account event isolation, cockpit source and season links');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
