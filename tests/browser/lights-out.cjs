// Run against an isolated local production build. Uses an existing Playwright installation.
// PLAYWRIGHT_MODULE may point to a preinstalled package; no production credentials required.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.QA_BASE_URL || 'http://127.0.0.1:3100';
if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(base)) throw new Error('Browser acceptance requires an isolated localhost server');
const out = process.env.QA_ARTIFACT_DIR || path.join(require('node:os').tmpdir(), 'apex-lights-out');
fs.mkdirSync(out, { recursive: true });
const results = { widths: [], routes: [], errors: [], checks: [], metrics: null };
async function settle(page) { await page.waitForTimeout(1550); }
async function overflow(page) { return page.evaluate(() => ({ viewport: innerWidth, scroll: document.documentElement.scrollWidth, offenders: [...document.querySelectorAll('main *')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&(r.right>innerWidth+2||r.left< -2)&&getComputedStyle(e).position!=='absolute'&&getComputedStyle(e).position!=='fixed'}).slice(0,8).map(e=>({tag:e.tagName,class:e.className,width:e.getBoundingClientRect().width})) })); }
(async () => {
 const browser = await chromium.launch({ headless: true, ...(process.env.QA_BROWSER_PATH ? { executablePath: process.env.QA_BROWSER_PATH } : { channel: 'chrome' }) });
 try {
 const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
 const page = await context.newPage();
 page.on('pageerror', error => results.errors.push(error.message));
 await page.addInitScript(() => {
   window.__metrics={cls:0,lcp:0,longTasks:0,maxLongTask:0};
   for (const type of ['largest-contentful-paint','layout-shift','longtask']) {
    try { new PerformanceObserver(list => {for(const e of list.getEntries()) {if(type==='largest-contentful-paint')window.__metrics.lcp=e.startTime;if(type==='layout-shift'&&!e.hadRecentInput)window.__metrics.cls+=e.value;if(type==='longtask'){window.__metrics.longTasks++;window.__metrics.maxLongTask=Math.max(window.__metrics.maxLongTask,e.duration)}}}).observe({type,buffered:true});}catch{}
   }
 });
 await page.goto(base, {waitUntil:'commit'});
 await page.waitForFunction(()=>document.querySelector('.lights-out')?.dataset.intro==='full');
 assert.equal(await page.locator('.start-sequence').evaluate(e=>getComputedStyle(e).pointerEvents),'none');
 await page.screenshot({path:path.join(out,'intro-early.png')});
 await page.waitForTimeout(450);
 await page.screenshot({path:path.join(out,'intro-lights.png')});
 await page.waitForLoadState('domcontentloaded');
 await settle(page);
 assert.equal(await page.locator('.start-sequence').evaluate(e=>getComputedStyle(e).visibility),'hidden');
 assert.equal(await page.evaluate(()=>document.body.style.overflow),'');
 results.checks.push('first-visit entrance finishes without locking scroll or input');
 results.metrics=await page.evaluate(()=>({...window.__metrics, navigation:performance.getEntriesByType('navigation')[0].toJSON()}));
 assert.ok((await overflow(page)).scroll <= 1441, 'first-visit animation must not expand the page');
 await page.screenshot({path:path.join(out,'home-1440.png')});
 // Real controls, including roving tab focus and selected panel.
 const tabs=page.getByRole('tab');
 await tabs.nth(0).focus();await page.keyboard.press('ArrowRight');
 assert.equal(await tabs.nth(1).getAttribute('aria-selected'),'true');
 assert.equal(await tabs.nth(1).evaluate(e=>e===document.activeElement),true);
 await page.keyboard.press('Home');assert.equal(await tabs.nth(0).getAttribute('aria-selected'),'true');
 results.checks.push('championship tabs: click/arrow/Home selection and focus');
 await page.locator('.hero-actions .btn-primary').hover();
 assert.notEqual(await page.locator('.hero-actions .btn-primary').evaluate(e=>getComputedStyle(e).transform),'none');
 await page.locator('.hero-actions .btn-primary').click();
 await page.waitForTimeout(600);assert.ok(await page.locator('#weekend').evaluate(e=>e.getBoundingClientRect().top)<150);
 results.checks.push('hover feedback and anchored race navigation');
 // Reveal every section once for a meaningful full-page screenshot.
 for(let y=0;y<await page.evaluate(()=>document.body.scrollHeight);y+=700){await page.evaluate(y=>scrollTo(0,y),y);await page.waitForTimeout(70)}
 await page.evaluate(()=>scrollTo(0,0));await page.waitForTimeout(600);
 await page.screenshot({path:path.join(out,'home-desktop-full.png'),fullPage:true});
 for (const width of [375,390,768,1440,1920]) {
  await page.setViewportSize({width,height:width<768?844:1080});await page.goto(base,{waitUntil:'domcontentloaded'});await settle(page);
  assert.equal(await page.locator('.lights-out').getAttribute('data-intro'),'light');
  const layout=await overflow(page);results.widths.push({width,...layout});assert.ok(layout.scroll<=width+1,`home overflows at ${width}`);
  await page.screenshot({path:path.join(out,`home-${width}.png`)});
  if(width===390){await page.getByRole('button',{name:'切换导航菜单'}).click();await page.getByRole('dialog').waitFor();assert.equal(await page.locator('main').evaluate(e=>e.inert),true);await page.screenshot({path:path.join(out,'mobile-menu.png')});await page.keyboard.press('Escape');assert.equal(await page.getByRole('dialog').count(),0);assert.equal(await page.locator('main').evaluate(e=>e.inert),false);assert.equal(await page.getByRole('button',{name:'切换导航菜单'}).evaluate(e=>e===document.activeElement),true);results.checks.push('mobile menu opens, isolates content, Escape closes and restores focus')}
 }
 // Reduced motion must have no intro or staged hidden content.
 await page.emulateMedia({reducedMotion:'reduce'});await page.reload({waitUntil:'domcontentloaded'});await page.waitForTimeout(300);
 assert.equal(await page.locator('.lights-out').getAttribute('data-intro'),'none');assert.equal(await page.locator('.reveal-pending').count(),0);assert.equal(await page.locator('.start-sequence').evaluate(e=>getComputedStyle(e).display),'none');results.checks.push('reduced motion shows final state and all sections');
 await page.emulateMedia({reducedMotion:'no-preference'});
 for(const route of ['/races','/standings','/drivers','/teams','/login','/register','/forgot-password','/replay?session=demo-singapore']){
  for(const width of [390,1440]){
   await page.setViewportSize({width,height:width===390?844:1000});const response=await page.goto(base+route,{waitUntil:'domcontentloaded'});await settle(page);const layout=await overflow(page);const entry={route,width,status:response.status(),...layout};results.routes.push(entry);assert.equal(entry.status,200);assert.ok(entry.scroll<=width+1,`${route} overflows at ${width}`);await page.screenshot({path:path.join(out,`${route.split('?')[0].slice(1)}-${width}.png`)});
  }
 }
 await page.getByRole('button',{name:/暂停/}).click();await page.getByRole('button',{name:/播放/}).waitFor();await page.getByRole('button',{name:/播放/}).click();await page.getByRole('button',{name:/暂停/}).waitFor();results.checks.push('explicit replay demo renders and play/pause toggles');
 await page.goto(base+'/drivers',{waitUntil:'domcontentloaded'});const driver=await page.locator('main a[href^="/drivers/"]').first().getAttribute('href');
 await page.goto(base+'/teams',{waitUntil:'domcontentloaded'});const team=await page.locator('main a[href^="/teams/"]').first().getAttribute('href');
 for(const route of ['/races/1',driver,team]){if(!route)continue;await page.setViewportSize({width:390,height:844});const response=await page.goto(base+route,{waitUntil:'domcontentloaded'});const layout=await overflow(page);results.routes.push({route,width:390,status:response.status(),...layout});assert.equal(response.status(),200);assert.ok(layout.scroll<=391,`${route} detail overflow`)}
 // Anonymous AI redirects through the original authentication path.
 await page.goto(base+'/ai',{waitUntil:'domcontentloaded'});await page.waitForURL('**/login?returnUrl=/ai');results.checks.push('anonymous AI retains login gate');
 const admin=await page.request.get(base+'/api/admin/overview');assert.equal(admin.status(),401);results.checks.push('anonymous admin API remains 401');
 // Local-only HTTP stubs validate UI stream rendering without credentials or paid calls.
 await page.route('**/api/auth/session',route=>route.fulfill({json:{user:{id:'browser-test',email:'browser@example.invalid'},session:null}}));
 await page.route('**/api/ai/chat',route=>route.fulfill({status:200,contentType:'text/event-stream',body:'data: {"type":"delta","content":"浏览器测试：策略解读。"}\n\ndata: {"type":"done"}\n\n'}));
 await page.goto(base+'/ai',{waitUntil:'domcontentloaded'});await page.getByRole('textbox',{name:'向 APEX AI 提问'}).fill('解释轮胎策略');await page.getByRole('textbox',{name:'向 APEX AI 提问'}).press('Enter');await page.getByText('浏览器测试：策略解读。',{exact:true}).waitFor();results.checks.push('local stub AI stream reaches completed message');
 await page.screenshot({path:path.join(out,'ai-390.png')});
 assert.equal(results.errors.length,0,JSON.stringify(results.errors));
 fs.writeFileSync(path.join(out,'acceptance.json'),JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));
 } finally { await browser.close(); }
})().catch(error=>{fs.writeFileSync(path.join(out,'acceptance-partial.json'),JSON.stringify({...results,error:error.stack},null,2));console.error(error);process.exit(1)});
