// Local browser fixtures only. No real admin data, MFA enrollment or synchronization.
const {chromium}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const base=process.env.QA_BASE_URL||'http://127.0.0.1:3300';
if(!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(base))throw Error('Localhost required');
const out=process.env.QA_ARTIFACT_DIR||path.join(require('node:os').tmpdir(),'apex-mobile-admin');fs.mkdirSync(out,{recursive:true});
const users=Array.from({length:23},(_,i)=>({id:'local-user-'+i,email:'long.email.address.for.mobile.'+i+'@example.invalid',displayName:'移动端测试用户 '+i,role:'普通用户',provider:'email',isVerified:i%2===0,createdAt:'2026-10-20T00:00:00Z'}));
const days=Array.from({length:7},(_,i)=>({day:'2026-10-'+(20+i),total:12,success:10,error:1,timeout:1,cancelled:0}));
async function fixture(page,aal='aal2'){
 let protectedReads=0;
 await page.route('**/api/auth/session',r=>r.fulfill({json:{user:{id:'local-admin',email:'admin@example.invalid'},session:null}}));
 await page.route('**/api/admin/**',r=>{
  const endpoint=new URL(r.request().url()).pathname;
  if(endpoint.endsWith('/mfa/status'))return r.fulfill({json:{aal}});
  if(endpoint.endsWith('/mfa/enroll'))return r.fulfill({json:{enrolled:true,verified:true,factorId:'local-only'}});
  assert.equal(r.request().method(),'GET','no mutations outside local enroll fixture');protectedReads++;
  if(endpoint.endsWith('/users'))return r.fulfill({json:{users,total:23}});
  if(endpoint.endsWith('/ai/logs'))return r.fulfill({json:{total:1,logs:[{id:'local-log',userId:users[0].id,userEmail:users[0].email,userDisplayName:users[0].displayName,clientIp:'203.0.113.5',userAgent:'local-test',messages:[{role:'user',content:'这是用于检查移动端换行的本地问题。'.repeat(8)}],response:'本地回答。'.repeat(100),model:'local-only',durationMs:1200,tokensEstimated:120,outcome:'success',createdAt:'2026-10-27T10:00:00Z'}]}});
  if(endpoint.endsWith('/ai'))return r.fulfill({json:{provider:'fixture',model:'local-only',totalRequests:123456789,estimatedTokens:987654321,limits:{},monitoring:{available:true,successRate:98,averageDurationMs:1200,totals:{success:70,error:7,timeout:7,cancelled:0},days,events:[{at:'2026-10-27T10:00:00Z',outcome:'error',durationMs:1200}]}}});
  return r.fulfill({json:{season:'2026',cutoffDesc:'本地数据状态',health:{status:'healthy',storageProvider:'memory',storageConnected:true},deployment:{buildId:'a'.repeat(40),environment:'test'},f1:{}}});
 });
 return ()=>protectedReads;
}
async function contained(page,label){assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),label+': no page overflow');}
(async()=>{const browser=await chromium.launch({channel:'chrome'});try{
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),errors=[];page.on('pageerror',e=>errors.push(e.message));await fixture(page);
 for(const width of [375,390,430,768,844,1440]){
  await page.setViewportSize({width,height:width===844?390:844});await page.goto(base+'/admin?tab=users');await page.getByRole('searchbox',{name:'搜索用户'}).waitFor();
  await page.locator('.admin-users tbody tr').first().waitFor();await contained(page,'users '+width);
  if(width<=768){
   assert.ok(await page.locator('.admin-table-scroll').evaluate(el=>el.scrollWidth<=el.clientWidth+1),'mobile user actions must not require horizontal scrolling');
   const row=page.locator('.admin-users tbody tr').first();await row.getByRole('button',{name:/查看.*AI 对话/}).scrollIntoViewIfNeeded();
   const button=await row.getByRole('button',{name:/查看.*AI 对话/}).boundingBox();assert.ok(button.x>=0&&button.x+button.width<=width&&button.height>=44,'user action fits mobile viewport');
   await row.getByRole('button',{name:/查看.*AI 对话/}).click();await page.locator('.audit-record').waitFor();
   assert.ok(await page.evaluate(()=>scrollY<150),'opening another column returns to its heading');
   await page.getByRole('button',{name:'展开详情 ▼',exact:true}).click();await contained(page,'expanded audit '+width);
   await page.screenshot({path:path.join(out,'audit-'+width+'.png'),fullPage:true});
   await page.locator('.mobile-admin-bottom-nav').getByRole('button',{name:/用户/}).click();
   await page.getByRole('searchbox',{name:'搜索用户'}).fill('no-match');await page.getByText('没有符合筛选条件的用户').waitFor();
   await page.getByRole('button',{name:'清除筛选',exact:true}).click();
   await page.getByRole('button',{name:'下一页',exact:true}).click();assert.equal(await page.locator('.admin-users tbody tr').count(),3);
   await page.getByRole('button',{name:'上一页',exact:true}).click();
   await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:path.join(out,'users-'+width+'.png')});
  }
  const nav=page.locator(width<=768?'.mobile-admin-bottom-nav':'.admin-tabs');
  await nav.getByRole('button',{name:/AI 监控/}).click();await page.locator('.monitor-stats').waitFor();
  await contained(page,'AI '+width);
  assert.ok(await page.locator('.monitor-stats').evaluate(el=>el.scrollWidth<=el.clientWidth+1),'large metrics remain contained');
  await page.getByText('查看每日明细',{exact:true}).click();await contained(page,'daily metrics '+width);
  await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:path.join(out,'ai-'+width+'.png')});
  if(width<=768){const bg=await nav.evaluate(el=>getComputedStyle(el).backgroundColor);assert.equal(bg,'rgba(0, 0, 0, 0)','bottom navigation uses clear glass');}
 }
 const locked=await browser.newPage({viewport:{width:375,height:667},isMobile:true,hasTouch:true}),reads=await fixture(locked,'aal1');
 await locked.goto(base+'/admin');await locked.getByRole('button',{name:'TOTP 绑定 / 验证',exact:true}).click();
 await locked.getByRole('dialog').waitFor();assert.equal(reads(),0,'AAL1 cannot read private data');
 const close=await locked.getByRole('button',{name:'关闭双重验证'}).boundingBox();assert.ok(close.width>=44&&close.height>=44,'MFA close target is finger sized');
 await locked.getByLabel('6 位动态验证码',{exact:true}).fill('123456');
 await locked.setViewportSize({width:375,height:380});await locked.getByRole('button',{name:'确认授权',exact:true}).scrollIntoViewIfNeeded();await contained(locked,'keyboard-height MFA');
 await locked.screenshot({path:path.join(out,'mfa-short-viewport.png')});
 await locked.keyboard.press('Escape');await locked.getByRole('dialog').waitFor({state:'hidden'});assert.equal(reads(),0);
 assert.deepEqual(errors,[]);console.log('PASS mobile admin: readable users/actions, pagination, audit, metrics, glass navigation, MFA and six viewports');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
