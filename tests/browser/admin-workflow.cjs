// Isolated fixtures only: no real accounts, emails, model calls or synchronization.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const base=process.env.QA_BASE_URL||'http://127.0.0.1:3100';
if(!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(base))throw Error('Localhost required');
const out=process.env.QA_ARTIFACT_DIR||path.join(require('node:os').tmpdir(),'apex-admin-workflow');fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),calls=[],errors=[];let failed=false,holdAI=false,releaseAI,aiStarted,metric=24,holdAudit=false,releaseAudit,auditStarted;
  page.on('pageerror',e=>errors.push(e.message));
  const capture=async name=>{await page.mouse.click(2,2);await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:path.join(out,name),animations:'disabled',fullPage:true});};
  await page.route('**/api/auth/session',r=>r.fulfill({json:{user:{id:'local',email:'admin@example.invalid'},session:null}}));
  await page.route('**/api/admin/**',async r=>{
   const endpoint=new URL(r.request().url()).pathname;calls.push(endpoint);
   if(endpoint.endsWith('/f1')&&r.request().method()==='POST')return r.fulfill({json:{success:true,message:'仅本地同步测试'}});
   assert.equal(r.request().method(),'GET');
   if(endpoint.endsWith('/status'))return r.fulfill({json:{aal:'aal2'}});
   if(failed&&endpoint.endsWith('/users'))return r.fulfill({status:503,json:{error:'本地用户目录故障'}});
   if(endpoint.endsWith('/users'))return r.fulfill({json:{total:2,users:[{id:'alice',email:'alice@example.invalid',displayName:'Alice',role:'普通用户',provider:'google',isVerified:true,createdAt:'2026-10-20T00:00:00Z'},{id:'bob',email:'bob@example.invalid',displayName:'Bob',role:'普通用户',provider:'email',isVerified:false,createdAt:'2026-10-21T00:00:00Z'}]}});
   if(endpoint.endsWith('/ai/logs')){
    const id=new URL(r.request().url()).searchParams.get('userId');
    if(id==='alice'&&holdAudit){holdAudit=false;auditStarted();await new Promise(resolve=>{releaseAudit=resolve;});}
    const logs=(id?[id]:['alice','bob']).map(user=>({id:'log-'+user,userId:user,userEmail:user+'@example.invalid',userDisplayName:user,clientIp:'203.0.113.5',userAgent:'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/140.0.0.0 Safari/537.36',messages:[{role:'user',content:'仅本地测试：轮胎策略'}],response:'仅本地测试回答，不含真实用户内容。',model:'local-only',durationMs:1200,tokensEstimated:123,outcome:'success',createdAt:'2026-10-27T10:00:00Z'}));
    return r.fulfill({json:{logs,total:logs.length}});
   }
   if(endpoint.endsWith('/ai')){const count=metric;if(holdAI){holdAI=false;aiStarted();await new Promise(resolve=>{releaseAI=resolve;});}return r.fulfill({json:{provider:'fixture',model:'local-only',totalRequests:count,monitoring:{available:false},limits:{}}});}
   return r.fulfill({json:{season:'2026',cutoffDesc:'测试数据截止状态',deployment:{buildId:'local-fixture',environment:'test'},health:{status:'healthy',storageProvider:'memory',storageConnected:true},f1:{}}});
  });
  await page.goto(base+'/admin?tab=users');await page.locator('.admin-workspace').waitFor();
  await capture('admin-current.png');
  await page.getByText('alice@example.invalid',{exact:false}).first().waitFor({timeout:4000});
  const input=page.getByRole('searchbox',{name:'搜索用户'});await input.fill('alice');
  assert.equal(await page.locator('.admin-users tbody tr').count(),1);await input.fill('');
  await page.getByLabel('邮箱验证状态').selectOption('pending');assert.equal(await page.locator('.admin-users tbody tr').count(),1);
  await page.getByLabel('邮箱验证状态').selectOption('all');
  const overviewReads=calls.filter(c=>c.endsWith('/overview')).length;
  failed=true;await page.getByRole('button',{name:'刷新当前栏目',exact:true}).click();
  await page.getByRole('alert').filter({hasText:'本地用户目录故障'}).waitFor();
  assert.ok(await page.getByText('alice@example.invalid',{exact:false}).count(),'transient failures retain last known users');
  assert.equal(calls.filter(c=>c.endsWith('/overview')).length,overviewReads,'refresh is scoped to active column');
  failed=false;await page.getByRole('button',{name:'重试读取',exact:true}).click();
  await page.getByRole('alert').filter({hasText:'本地用户目录故障'}).waitFor({state:'hidden'});
  await page.getByRole('button',{name:'AI 监控与用量',exact:true}).click();await page.getByRole('heading',{name:'运行指标',exact:true}).waitFor();
  holdAI=true;metric=11;const began=new Promise(resolve=>{aiStarted=resolve;});await page.getByRole('button',{name:'刷新 AI 数据',exact:true}).click();await began;
  metric=99;await page.getByRole('button',{name:'F1 数据调度',exact:true}).click();await page.getByRole('button',{name:'立即手动同步',exact:true}).click();
  await page.getByRole('button',{name:'AI 监控与用量',exact:true}).click();await page.locator('.monitor-stats').getByText('99',{exact:true}).waitFor();releaseAI();
  await page.waitForTimeout(120);assert.equal(await page.locator('.monitor-stats').getByText('99',{exact:true}).count(),1,'older manual AI read cannot overwrite newer sync read');
  await page.getByRole('button',{name:'用户管理',exact:true}).click();await capture('admin-users-1440.png');
  await page.getByRole('button',{name:'AI 监控与用量',exact:true}).click();await capture('admin-ai-1440.png');
  await page.getByRole('button',{name:'对话记录',exact:true}).click();await page.locator('.audit-record').first().waitFor();
  holdAudit=true;const auditBegan=new Promise(resolve=>{auditStarted=resolve;});await page.getByLabel('目标用户:').selectOption('alice');await auditBegan;
  await page.getByLabel('目标用户:').selectOption('bob');await page.locator('.audit-record').filter({hasText:'bob@example.invalid'}).waitFor();releaseAudit();await page.waitForTimeout(150);
  assert.equal(await page.locator('.audit-record').count(),1);assert.doesNotMatch(await page.locator('.audit-record').innerText(),/alice@example/);
  await capture('admin-records-1440.png');
  for(const width of [320,390]){await page.setViewportSize({width,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'audit records do not overflow at '+width);await page.getByRole('button',{name:'展开详情 ▼',exact:true}).click();assert.equal(await page.getByRole('button',{name:'收起详情 ▲',exact:true}).getAttribute('aria-expanded'),'true');assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'expanded audit contained at '+width);await capture('admin-records-'+width+'.png');await page.getByRole('button',{name:'收起详情 ▲',exact:true}).click();}await page.setViewportSize({width:1440,height:1000});
  assert.equal(new URL(page.url()).searchParams.get('tab'),'ai');await page.reload();await page.getByRole('heading',{name:'运行指标',exact:true}).waitFor();
  await page.goBack();await page.getByRole('searchbox',{name:'搜索用户'}).waitFor();
  for(const width of [320,390,768,1024,1440,1920]){
   await page.setViewportSize({width,height:900});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'admin contained at '+width);
   const nav=page.locator(width>768?'.admin-tabs':'.mobile-admin-bottom-nav');
   for(const tab of width>768?['网站概览','用户管理','AI 监控与用量','F1 数据调度']:['概览','用户','AI 监控','F1 调度'])await nav.getByRole('button',{name:new RegExp(tab)}).click();
   await capture('admin-'+width+'.png');
  }
  assert.deepEqual(errors,[]);console.log('PASS admin workflow: deep links/back/reload, user filters, scoped refresh, retained data/error recovery, six widths and all navigation');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
