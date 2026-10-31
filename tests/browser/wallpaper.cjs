// Local real-browser acceptance. No real login, messages, or AI requests.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.QA_BASE_URL||'http://127.0.0.1:3100';
if(!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(base))throw Error('Localhost required');
const out=process.env.QA_ARTIFACT_DIR||path.join(require('node:os').tmpdir(),'apex-wallpaper');fs.mkdirSync(out,{recursive:true});
(async()=>{const b=await chromium.launch({channel:'chrome',headless:true});try{
 const c=await b.newContext({viewport:{width:1440,height:1000}}),p=await c.newPage(),errors=[],requests=[];
 p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>{if(r.url().includes('/wallpapers/'))requests.push(r.url());});
 await p.goto(base+'/login');await p.keyboard.press('Tab');assert.equal(await p.evaluate(()=>document.activeElement?.classList.contains('skip-link')),true,'original skip link stays first in keyboard order');const toggle=p.getByRole('button',{name:'壁纸背景',exact:true});await toggle.waitFor();
 await p.waitForFunction(()=>document.querySelector('.wallpaper-video')?.readyState>=2&&document.querySelector('.wallpaper-video')?.currentTime>.3);
 assert.equal(await toggle.getAttribute('aria-pressed'),'true');assert.match(await p.locator('.auth-frame>.glass-surface').evaluate(e=>getComputedStyle(e).backdropFilter),/blur\(14px\)/,'compiled desktop glass filter must really apply');
 const headerAlpha=await p.locator('.site-header').evaluate(e=>Number(getComputedStyle(e).backgroundColor.split(',')[3]?.replace(')','')));assert.equal(headerAlpha,0,'header has no colored fill');const footerMaterial=await p.locator('.site-footer').evaluate(e=>({bg:getComputedStyle(e).backgroundColor,filter:getComputedStyle(e).backdropFilter}));assert.ok(footerMaterial.bg.startsWith('rgba('),'footer is translucent');assert.ok(footerMaterial.filter.includes('blur('),'footer is frosted');
 const video=p.locator('.wallpaper-video');
 const media=await video.evaluate(v=>({muted:v.muted,loop:v.loop,inline:v.playsInline,duration:v.duration,time:v.currentTime,width:v.videoWidth,source:v.currentSrc}));
 assert.ok(media.muted&&media.loop&&media.inline&&media.duration>15);assert.ok(media.source.endsWith('nachoneko-1440.mp4'));assert.equal(media.width,2560);
 assert.equal(await p.locator('.site-wallpaper').evaluate(e=>getComputedStyle(e).pointerEvents),'none');
 const layout=()=>p.locator('main').evaluate(e=>({text:e.innerText,headings:[...e.querySelectorAll('h1,h2,p,input,button')].map(n=>{const r=n.getBoundingClientRect();return [n.tagName,r.x,r.y,r.width,r.height,getComputedStyle(n).fontFamily,getComputedStyle(n).fontSize]})}));
 await p.screenshot({path:path.join(out,'after-desktop.png'),fullPage:true});await p.evaluate(()=>document.fonts.ready);await p.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));const on=await layout();
 await toggle.click();await p.waitForFunction(()=>!document.documentElement.dataset.wallpaper);
 assert.equal(await p.locator('.wallpaper-video').count(),0);assert.deepEqual(await layout(),on,'wallpaper cannot move or replace existing content');
 assert.equal(await p.locator('body').evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(16, 19, 24)');
 await p.screenshot({path:path.join(out,'before-desktop.png'),fullPage:true});
 await p.reload();assert.equal(await toggle.getAttribute('aria-pressed'),'false','off preference persists');
 await toggle.click();await p.waitForFunction(()=>document.querySelector('video.wallpaper-video')?.currentTime>.2);
 await video.evaluate(v=>v.dataset.identity='preserved');
 const beforeRequests=requests.filter(url=>url.endsWith('.mp4')).length;
 await p.locator('.nav-link[href="/drivers"]').click();await p.waitForURL('**/drivers');
 assert.equal(await video.getAttribute('data-identity'),'preserved');assert.equal(requests.filter(url=>url.endsWith('.mp4')).length,beforeRequests,'navigation must not reload video');
 await video.evaluate(v=>v.currentTime=v.duration-.25);await p.waitForTimeout(1000);assert.ok(await video.evaluate(v=>v.currentTime<2&&!v.paused),'real video loops');
 await p.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});
 assert.equal(await video.evaluate(v=>v.paused),true);
 await p.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:false});document.dispatchEvent(new Event('visibilitychange'));});
 await p.waitForFunction(()=>!document.querySelector('.wallpaper-video').paused);
 const fixed=await p.locator('.site-wallpaper').boundingBox();await p.evaluate(()=>scrollTo(0,600));assert.deepEqual(await p.locator('.site-wallpaper').boundingBox(),fixed);
 const range=await p.request.get(base+'/wallpapers/nachoneko-1440.mp4',{headers:{Range:'bytes=0-1023'}});assert.equal(range.status(),206);
 const perf=await c.newCDPSession(p);await perf.send('Performance.enable');
 const metric=async()=>Object.fromEntries((await perf.send('Performance.getMetrics')).metrics.map(m=>[m.name,m.value]));
 const start=await metric();await p.waitForTimeout(5000);const end=await metric();const quality=await video.evaluate(v=>{const q=v.getVideoPlaybackQuality();return {total:q.totalVideoFrames,dropped:q.droppedVideoFrames};});
 const performance={desktopBytes:fs.statSync(path.join(process.cwd(),'public/wallpapers/nachoneko-1440.mp4')).size,mobileBytes:fs.statSync(path.join(process.cwd(),'public/wallpapers/nachoneko-portrait-720.mp4')).size,seconds:5,rendererTaskSeconds:end.TaskDuration-start.TaskDuration,heapDelta:end.JSHeapUsedSize-start.JSHeapUsedSize,video:quality};
 assert.ok(performance.heapDelta<16*1024*1024,'background cannot accumulate unbounded JS state');await toggle.click();const offStart=await metric();await p.waitForTimeout(5000);const offEnd=await metric();performance.disabledRendererTaskSeconds=offEnd.TaskDuration-offStart.TaskDuration;
 await c.close();
 for(const mode of ['mobile','reduced','saved-off','failure','autoplay-blocked','save-data']){
  const context=await b.newContext({viewport:{width:mode==='mobile'?390:1440,height:844},reducedMotion:mode==='reduced'?'reduce':'no-preference'});
  if(mode==='saved-off')await context.addInitScript(()=>localStorage.setItem('apex:wallpaper','off'));
  if(mode==='save-data')await context.addInitScript(()=>Object.defineProperty(navigator,'connection',{configurable:true,value:Object.assign(new EventTarget(),{saveData:true,effectiveType:'4g'})}));
  if(mode==='autoplay-blocked')await context.addInitScript(()=>HTMLMediaElement.prototype.play=function(){return Promise.reject(new Error('NotAllowedError'));});
  if(mode==='failure')await context.route('**/wallpapers/*.mp4',r=>r.abort());
  const page=await context.newPage(),mediaRequests=[];page.on('request',r=>{if(r.url().endsWith('.mp4'))mediaRequests.push(r.url());});
  await page.goto(base+'/login');await page.getByRole('button',{name:'壁纸背景',exact:true}).waitFor();
  if(mode==='mobile'){assert.match(await page.locator('.auth-frame>.glass-surface').evaluate(e=>getComputedStyle(e).backdropFilter),/blur\(8px\)/,'mobile uses lightweight real glass rather than an opaque fallback');
   await page.waitForFunction(()=>document.querySelector('.wallpaper-video')?.currentTime>.2);
   assert.ok(await page.locator('.wallpaper-video').evaluate(v=>v.currentSrc.endsWith('nachoneko-portrait-720.mp4')));
   assert.ok(!mediaRequests.some(url=>url.includes('-1440.mp4')));assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   await page.screenshot({path:path.join(out,'after-mobile.png'),fullPage:true});
   await page.getByRole('button',{name:'壁纸背景',exact:true}).click();await page.waitForFunction(()=>!document.documentElement.dataset.wallpaper);
   await page.screenshot({path:path.join(out,'before-mobile.png'),fullPage:true});
  }else if(mode==='saved-off'){
   assert.equal(await page.locator('.site-wallpaper').count(),0);assert.equal(mediaRequests.length,0);
  }else{
   await page.locator('.wallpaper-poster').waitFor();await page.waitForFunction(()=>!document.querySelector('.wallpaper-video'));
   assert.equal(await page.locator('.wallpaper-poster').evaluate(e=>e.complete&&e.naturalWidth>0),true);
   if(mode==='reduced'||mode==='save-data')assert.equal(mediaRequests.length,0);
  }
  await context.close();
 }
 for(const width of [390,768,1440]){
  const context=await b.newContext({viewport:{width,height:1000}}),page=await context.newPage();
  await page.goto(base+'/',{timeout:90000});await page.locator('.race-cover').waitFor({timeout:60000});
  await page.waitForFunction(()=>document.documentElement.dataset.wallpaper==='on');
  const cover=page.locator('.race-cover');const material=await cover.evaluate(e=>({bg:getComputedStyle(e).backgroundColor,ink:getComputedStyle(e).color,filter:getComputedStyle(e).backdropFilter}));
  assert.equal(material.bg,'rgba(0, 0, 0, 0)','home hero is colorless transparent');assert.equal(material.ink,'rgb(245, 247, 250)','transparent hero retains readable text');assert.match(material.filter,/blur\(/);assert.match(material.filter,/brightness\(0.42\)/);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await page.screenshot({path:path.join(out,'home-glass-'+width+'.png'),fullPage:true});
  await page.locator('.site-footer').evaluate(e=>e.scrollIntoView({behavior:'instant',block:'end'}));await page.waitForTimeout(250);await page.screenshot({path:path.join(out,'footer-glass-'+width+'.png')});
  await context.close();
 }
 const ai=await b.newContext();
 await ai.route('**/api/auth/session',r=>r.fulfill({json:{user:{id:'wallpaper-test',email:'wallpaper@example.invalid'},session:null}}));
 await ai.route('**/api/profile',r=>r.fulfill({json:{profile:{id:'wallpaper-test',display_name:'本地背景验收',avatar_url:null,favorite_team_ids:[]}}}));
 await ai.route('**/api/ai/conversations*',r=>r.fulfill({json:{conversations:[]}}));
 const aiPage=await ai.newPage();
 for(const width of [320,390,768,1100,1440]){
  await aiPage.setViewportSize({width,height:844});await aiPage.goto(base+'/ai');
  await aiPage.getByRole('textbox',{name:'向 tikeai 提问',exact:true}).fill('本地点击区域验收，不发送');
  const send=await aiPage.getByRole('button',{name:'发送',exact:true}).boundingBox(),control=await aiPage.getByRole('button',{name:'壁纸背景',exact:true}).boundingBox();
  assert.ok(!(send.x<control.x+control.width&&send.x+send.width>control.x&&send.y<control.y+control.height&&send.y+send.height>control.y),'wallpaper toggle must not overlap AI send/stop target at '+width);
  if(width===768){await aiPage.getByRole('button',{name:'切换导航菜单',exact:true}).click();const menu=await aiPage.getByRole('dialog',{name:'网站导航',exact:true}).boundingBox();assert.ok(menu.height>700,'tablet menu remains viewport-fixed');await aiPage.keyboard.press('Escape');}
 }
 await ai.close();
 fs.writeFileSync(path.join(out,'performance.json'),JSON.stringify(performance,null,2));
 assert.deepEqual(errors,[]);
 console.log('PASS wallpaper: original text/fonts/geometry retained; persisted toggle, single decoder across navigation, real loop, hidden pause/resume, fixed scrolling, range requests, mobile source, reduced motion, data saver, blocked autoplay and failed video fallback');
 console.log(JSON.stringify(performance));
}finally{await b.close();}})().catch(e=>{console.error(e);process.exit(1)});
