// Local acceptance with intercepted auth, model and history. No real provider calls.
require('tsx/cjs');
const { ConversationService, MemoryConversationStore } = require('../lib/ai/conversations.ts');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const base = process.env.QA_BASE_URL || 'http://127.0.0.1:3100';
if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(base)) throw Error('Localhost required');
(async () => {
 const browser = await chromium.launch({headless:true,channel:'chrome'});
 try {
  const service = new ConversationService(new MemoryConversationStore());
  const context = await browser.newContext({viewport:{width:1440,height:1000}});
  let requests = 0, fail = false, latestContext = [], creations = 0;
  let account='v31-test', holdChat=false, chatStarted, releaseChat;
  let holdHistory=false, historyStarted, releaseHistory;
  const historyRequests=[], chatRequests=[];
  await context.route('**/*', async route => {
   const req = route.request(), url = new URL(req.url());
   if (url.origin !== base) return route.abort();
   if (url.pathname === '/api/auth/session') return route.fulfill({json:{user:{id:account,email:'test@example.invalid'},session:null}});
   if (url.pathname === '/api/ai/conversations') {
    const owner=req.headers()['x-apex-history-owner'];
    historyRequests.push({owner,method:req.method(),body:req.postData()});
    if(owner!==account) return route.fulfill({status:409,json:{error:'账号已变化'}});
    const storeOwner=account==='v31-test'?'v31':account;
    const body = req.method() === 'GET' ? {} : req.postDataJSON();
    const id = url.searchParams.get('id');
    try {
     let data;
     if(req.method()==='GET') data=id ? {conversation:await service.read(storeOwner,id)} : {conversations:await service.list(storeOwner)};
     if(req.method()==='POST') { creations++; await new Promise(resolve=>setTimeout(resolve,200)); data={conversation:await service.create(storeOwner,body.messages,body.id)}; }
     if(req.method()==='PUT') data={conversation:await service.update(storeOwner,id,body)};
     if(req.method()==='GET' && holdHistory) { holdHistory=false; historyStarted?.(); await new Promise(resolve=>{releaseHistory=resolve;}); }
     return route.fulfill({json:data});
    } catch(e) {return route.fulfill({status:e.status || 400,json:{error:e.message}});}
   }
   if(url.pathname==='/api/ai/chat') {
    requests++; latestContext=req.postDataJSON().messages;
    chatRequests.push({owner:req.headers()['x-apex-history-owner'],messages:latestContext});
    if(holdChat) { holdChat=false; chatStarted?.(); await new Promise(resolve=>{releaseChat=resolve;}); }
    if(fail) return route.fulfill({status:503,json:{error:'test model failed'}});
    return route.fulfill({contentType:'text/event-stream',body:'data: {"type":"meta","mode":"fast","label":"事实快答 · 统一赛事数据"}\n\ndata: {"type":"delta","content":"本地事实回答"}\n\ndata: {"type":"done"}\n\n'});
   }
   return route.continue();
  });
  const page=await context.newPage();
  await page.goto(base+'/ai?q='+encodeURIComponent('自动携带的问题'));
  await page.getByText('本地事实回答',{exact:true}).waitFor();
  await page.getByText('已保存到云端 · AI 参考最近的对话上下文',{exact:true}).waitFor();
  assert.equal(requests,1,'query prompt must send once after auth and history loading');
  assert.equal(creations,1,'fast completion during slow draft save must not create another conversation');
  assert.equal((await service.list('v31')).length,1);
  await page.reload();
  await page.getByRole('textbox',{name:'向 APEX AI 提问'}).waitFor();
  assert.equal(requests,1,'consumed q must not send after reload');
  const input=page.getByRole('textbox',{name:'向 APEX AI 提问'});
  await input.fill('一次同步双击测试');
  await page.getByRole('button',{name:'发送',exact:true}).evaluate(button=>{
   button.click(); button.click();
   // Same event turn: history still has the previous render's generating=false.
   document.querySelector('.history-select')?.click();
  });
  await page.getByText('本地事实回答',{exact:true}).waitFor();
  await page.getByText('已保存到云端 · AI 参考最近的对话上下文',{exact:true}).waitFor();
  assert.equal(requests,2,'synchronous double click must submit once');
  assert.equal(await page.locator('.ai-chat-console').getByText('一次同步双击测试',{exact:true}).count(),1,'history selection cannot replace the generating context');
  fail=true;
  await input.fill('失败后重试的问题');await input.press('Enter');
  await page.getByRole('button',{name:'重试',exact:true}).waitFor();
  await page.getByText('已保存到云端 · AI 参考最近的对话上下文',{exact:true}).waitFor();
  fail=false;
  await page.getByRole('button',{name:'重试',exact:true}).click();
  await page.getByText('已保存到云端 · AI 参考最近的对话上下文',{exact:true}).waitFor();
  await page.waitForFunction(()=>!document.querySelector('textarea').disabled);
  assert.equal(requests,4);
  assert.equal(latestContext.filter(m=>m.role==='user'&&m.content==='失败后重试的问题').length,1,'retry reuses the existing user turn');
  assert.equal(await page.locator('.ai-chat-console').getByText('失败后重试的问题',{exact:true}).count(),1);
  // Revalidating the same identity on focus must preserve an in-flight answer.
  holdChat=true;
  const sameAccountStarted=new Promise(resolve=>{chatStarted=resolve;});
  await input.fill('同账号焦点切换不中断'); await input.press('Enter'); await sameAccountStarted;
  await page.evaluate(()=>window.dispatchEvent(new Event('apex:identity-changed')));
  await page.getByRole('textbox',{name:'向 APEX AI 提问'}).waitFor();
  releaseChat();
  await page.getByText('已保存到云端 · AI 参考最近的对话上下文',{exact:true}).waitFor();
  assert.equal((await service.list('v31')).some(c=>c.messageCount>=2),true);
  assert.equal(await page.locator('.ai-chat-console').getByText('同账号焦点切换不中断',{exact:true}).count(),1);
  assert.equal((await page.locator('.ai-chat-console').getByText('本地事实回答',{exact:true}).count())>=1,true);
  // Capture a valid A history response, delay its delivery, then switch to B.
  holdHistory=true;
  const staleReadStarted=new Promise(resolve=>{historyStarted=resolve;});
  await page.evaluate(()=>window.dispatchEvent(new Event('apex:identity-changed')));
  await staleReadStarted;
  const beforeSwitch=historyRequests.length;
  account='v31-account-b';
  await page.evaluate(()=>window.dispatchEvent(new Event('apex:identity-changed')));
  await page.getByRole('textbox',{name:'向 APEX AI 提问'}).waitFor();
  await page.waitForFunction(()=>document.querySelector('textarea') && !document.querySelector('textarea').disabled);
  releaseHistory();
  await page.waitForFunction(()=>!document.querySelector('.history-save-status')?.textContent.includes('正在保存'));
  assert.equal(await page.locator('.ai-chat-console').getByText('同账号焦点切换不中断',{exact:true}).count(),0);
  assert.equal(await page.locator('.history-select').count(),0,'late A history must not refill B sidebar');
  assert.equal(historyRequests.slice(beforeSwitch).filter(r=>r.owner==='v31-account-b'&&r.method!=='GET').length,0,'switching cannot save A messages to B');
  await input.fill('账号B独立问题'); await input.press('Enter');
  await page.getByText('已保存到云端 · AI 参考最近的对话上下文',{exact:true}).waitFor();
  assert.equal(chatRequests.at(-1).owner,'v31-account-b');
  assert.deepEqual(chatRequests.at(-1).messages.filter(m=>m.role==='user').map(m=>m.content),['账号B独立问题']);
  const bRecords=await service.list('v31-account-b'); assert.equal(bRecords.length,1);
  const bConversation=await service.read('v31-account-b',bRecords[0].id);
  assert.deepEqual(bConversation.messages.filter(m=>m.role==='user').map(m=>m.content),['账号B独立问题']);
  const previousRequests=requests;
  const nextQuestion=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/ai/chat');
  await page.evaluate(()=>history.pushState(null,'','/ai?q='+encodeURIComponent('同页面的新问题')));
  await nextQuestion;
  assert.equal(requests,previousRequests+1,'same-page q handoff sends exactly once');
  assert.equal(chatRequests.at(-1).messages.at(-1).content,'同页面的新问题');
  console.log('PASS v31 AI: auto prompt once/reload and same-page handoff, synchronous duplicate submission, delayed draft save, retry without duplicate user turn, same-account focus and cross-account isolation');
 } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
