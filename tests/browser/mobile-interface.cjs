const {chromium}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const base=process.env.QA_BASE_URL||'http://127.0.0.1:3300';
if(!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(base))throw Error('Localhost required');
const out=process.env.QA_ARTIFACT_DIR||path.join(require('node:os').tmpdir(),'apex-mobile-interface');fs.mkdirSync(out,{recursive:true});
(async()=>{const browser=await chromium.launch({channel:'chrome'});try{
 const p=await browser.newPage({isMobile:true,hasTouch:true});
 await p.route('**/api/auth/session',r=>r.fulfill({json:{user:null,session:null}}));
 for(const width of [375,390,430,844]){
  await p.setViewportSize({width,height:width===844?390:844});await p.goto(base+'/login');
  await p.getByRole('button',{name:'切换导航菜单'}).click();await p.getByRole('dialog',{name:'网站导航',exact:true}).waitFor();
  const menu=p.locator('.mobile-menu');
  assert.equal(await menu.evaluate(el=>getComputedStyle(el).backgroundColor),'rgba(0, 0, 0, 0)','navigation is clear glass');
  for(const a of await menu.locator(':scope > a').all()){
   const geometry=await a.evaluate(el=>({height:el.getBoundingClientRect().height,bg:getComputedStyle(el).backgroundColor}));
   assert.ok(geometry.height>=44);assert.equal(geometry.bg,'rgba(0, 0, 0, 0)','menu links do not introduce white cards');
  }
  await p.screenshot({path:path.join(out,'menu-'+width+'.png'),animations:'disabled'});
  await p.keyboard.press('Escape');await menu.waitFor({state:'hidden'});
  for(const route of ['/login','/register','/forgot-password','/races','/races/19?season=2026','/standings','/drivers','/teams','/live','/']){
   await p.goto(base+route,{waitUntil:'domcontentloaded',timeout:90000});
   await p.locator('main h1,main .auth-form-panel h2,main .auth-card h2').first().waitFor({timeout:90000});
   await p.locator('.loading-state,.home-loading').waitFor({state:'detached',timeout:90000});
   assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),route+' '+width+' fits viewport');
   if(width<768){const tiny=await p.locator('input:not([type=checkbox]):not([type=radio]):not([type=hidden]):not([type=range]),textarea,select').evaluateAll(nodes=>nodes.filter(el=>el.getBoundingClientRect().width>0&&parseFloat(getComputedStyle(el).fontSize)<16).map(el=>el.outerHTML.slice(0,160)));assert.deepEqual(tiny,[],route+': inputs avoid mobile focus zoom');}
   if(width===390||route==='/login')await p.screenshot({path:path.join(out,route.replace(/[^a-z0-9]/gi,'-')+'-'+width+'.png'),animations:'disabled'});
  }
 }
 // A signed-in identity is also tested locally; long names must not push account actions off screen.
 await p.unroute('**/api/auth/session');
 await p.route('**/api/auth/session',r=>r.fulfill({json:{user:{id:'local',email:'a.very.long.email.for.mobile.account@example.invalid',isAdmin:true},session:null}}));
 await p.route('**/api/profile',r=>r.fulfill({json:{profile:{id:'local',display_name:'用于检查手机账户区域自动换行的较长昵称',avatar_url:null,favorite_team_ids:[]}}}));
 await p.setViewportSize({width:375,height:667});await p.goto(base+'/login');
 await p.getByRole('button',{name:'切换导航菜单'}).click();await p.locator('.mobile-profile-card').waitFor();
 const account=p.locator('.mobile-account');assert.ok(await account.evaluate(el=>el.scrollWidth<=el.clientWidth+1),'long account identity stays contained');
 await account.getByRole('link',{name:'管理工作台',exact:true}).scrollIntoViewIfNeeded();
 await p.screenshot({path:path.join(out,'signed-in-menu-375.png'),animations:'disabled'});
 console.log('PASS public mobile: clear glass navigation, usable links, long account identity, focus zoom prevention and ten routes at four viewports');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
