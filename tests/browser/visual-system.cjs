// Local browser acceptance only. Identity delay is intercepted; no real login or AI calls.
const assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.QA_BASE_URL||'http://127.0.0.1:3100';
if(!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(base))throw Error('Localhost required');
(async()=>{const b=await chromium.launch({channel:'chrome',headless:true});try{
 const context=await b.newContext({viewport:{width:1440,height:1000}});const p=await context.newPage();
 await context.route('**/api/auth/session',async route=>{await new Promise(resolve=>setTimeout(resolve,2500));await route.fulfill({json:{user:null,session:null}});});
 await p.goto(base+'/ai',{waitUntil:'domcontentloaded'});
 await p.getByRole('heading',{name:'想了解哪一场比赛？'}).waitFor({timeout:1000});
 assert.equal(await p.getByLabel('你的问题',{exact:true}).isDisabled(),true);
 assert.equal(await p.locator('.ai-example-grid>div').count(),3);
 await p.waitForURL('**/login?**');
 await p.goto(base+'/drivers');const cards=p.locator('.driver-tile');
 if(await cards.count()){assert.ok(await cards.first().getAttribute('style').then(style=>style.includes('--team-color')));}
 await p.goto(base+'/standings');const rows=p.locator('.driver-standings tbody tr');
 if(await rows.count()){
  assert.equal(await p.locator('.podium-ribbon>div').count(),3);if(await rows.count()>=10){await rows.nth(9).waitFor({state:'visible'});const tenth=await rows.nth(9).boundingBox();assert.ok(tenth&&tenth.y+tenth.height<=1000,'desktop first viewport includes ten rankings');}
  assert.equal(await rows.first().getAttribute('data-podium'),'true');
  assert.notEqual(await rows.first().evaluate(e=>getComputedStyle(e.firstElementChild).borderLeftColor),'rgba(0, 0, 0, 0)');
 }
 for(const width of [320,375,390,768,1440,1920]){await p.setViewportSize({width,height:1000});assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));}
 await p.goto(base+'/');await p.locator('.home-loading').waitFor({state:'detached'});
 const number=p.locator('.countdown-number').first();
 if(await number.count()){await number.waitFor({state:'visible'});const before=await number.boundingBox();await p.waitForTimeout(10500);await number.waitFor({state:'visible'});const after=await number.boundingBox();assert.ok(Math.abs(before.width-after.width)<.1&&Math.abs(before.x-after.x)<.1,'countdown maintains fixed geometry');}
 await p.emulateMedia({reducedMotion:'reduce'});
 assert.equal(await p.locator('.btn-primary').first().evaluate(e=>getComputedStyle(e).transitionDuration),'0s');
 console.log('PASS visual system: immediate AI skeleton, disabled pending input, login handoff, shared accents when data exists, podium, 6 widths, 10-second countdown stability, reduced motion');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exit(1)});
