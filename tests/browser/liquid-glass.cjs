// Actual engine tests on an isolated localhost server; never writes production data.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const playwright=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.QA_BASE_URL||'http://127.0.0.1:3100';
if(!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(base))throw Error('Localhost required');
const out=process.env.QA_ARTIFACT_DIR||path.join(require('node:os').tmpdir(),'apex-glass-integration');fs.mkdirSync(out,{recursive:true});
(async()=>{for(const engine of (process.env.GLASS_ENGINES||'chromium,firefox,webkit').split(',')){
 const browser=await playwright[engine].launch(engine==='chromium'?{channel:'chrome'}:{});
 try{
  const context=await browser.newContext({viewport:{width:1440,height:1000}});
  await context.route('**/api/auth/session',r=>r.fulfill({json:{user:null,session:null}}));
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/Content Security Policy|Refused to load/.test(m.text()))errors.push(m.text());});
  const filter=locator=>locator.evaluate(e=>getComputedStyle(e).getPropertyValue('backdrop-filter')||getComputedStyle(e).getPropertyValue('-webkit-backdrop-filter'));
  await page.goto(base+'/login',{timeout:90000});
  await page.waitForFunction(()=>document.documentElement.dataset.wallpaper==='on');
  assert.match(await filter(page.locator('.auth-frame>.glass-surface')),/blur\(12px\)/,engine+' large glass fallback');
  await page.waitForTimeout(2000); // Allow Next.js navigation prefetches to finish before leaving the page.
  await page.goto(base+'/',{timeout:90000});await page.locator('.race-cover').waitFor({timeout:60000});
  if(engine==='chromium')await page.waitForFunction(()=>document.querySelectorAll('[data-glass-mode=refracted]').length>0);
  else{await page.waitForTimeout(500);assert.equal(await page.locator('[data-glass-mode=refracted]').count(),0,engine+' avoids unsupported URL backdrop filters');}
  assert.match(await filter(page.locator('.race-cover')),/blur\(8px\)/,'hero uses light glass when wallpaper is enabled');
  assert.ok(await page.locator('[data-glass-mode=refracted]').count()<=2,'shared two-lens budget');
  assert.ok(await page.locator('.liquid-glass svg filter').count()<=2,'at most two filter maps');
  await page.screenshot({path:path.join(out,engine+'-desktop.png')});
  assert.equal(await page.locator('.session-rail>div').first().evaluate(e=>getComputedStyle(e).backdropFilter),'none','schedule content does not blur');
  const rect=await page.locator('.race-cover').boundingBox();
  await page.getByRole('button',{name:'壁纸背景',exact:true}).click();
  await page.waitForFunction(()=>!document.documentElement.dataset.wallpaper);
  assert.match(await filter(page.locator('.site-header')),/blur\(/,'navigation retains glass without wallpaper');
  assert.deepEqual(await page.locator('.race-cover').boundingBox(),rect,'no geometry changes when switching glass');
  assert.equal(await page.locator('.race-cover').evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(244, 243, 239)');
  await page.getByRole('button',{name:'壁纸背景',exact:true}).click();
  await page.setViewportSize({width:390,height:844});await page.goto(base+'/login');
  await page.waitForFunction(()=>document.documentElement.dataset.wallpaper==='on');
  assert.match(await filter(page.locator('.auth-frame>.glass-surface')),/blur\(6px\)/);
  assert.equal(await page.locator('[data-glass-mode=refracted]').count(),0);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await page.screenshot({path:path.join(out,engine+'-mobile.png')});
  await page.getByRole('button',{name:'切换导航菜单',exact:true}).click();
  assert.ok((await page.getByRole('dialog',{name:'网站导航',exact:true}).boundingBox()).height>700);
  await page.keyboard.press('Escape');
  await page.emulateMedia({reducedMotion:'reduce'});await page.setViewportSize({width:1440,height:1000});await page.goto(base+'/');await page.locator('.race-cover').waitFor({timeout:60000});
  await page.waitForFunction(()=>document.documentElement.dataset.wallpaper==='on'&&!document.querySelector('.wallpaper-video'));
  assert.equal(await page.locator('[data-glass-mode=refracted]').count(),0,'reduced motion avoids optional refraction');
  assert.match(await filter(page.locator('.race-cover')),/blur\(8px\)/,'reduced motion keeps readable glass');
  assert.deepEqual(errors,[]);console.log('PASS '+engine+': desktop/mobile glass, source cleanup, unchanged geometry, menu and reduced motion');
  await context.close();
 }finally{await browser.close();}
}})().catch(e=>{console.error(e);process.exit(1)});
