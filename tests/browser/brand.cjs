const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const base=process.env.QA_BASE_URL||'http://127.0.0.1:3300';
if(!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(base))throw Error('Localhost required');
(async()=>{const b=await chromium.launch({channel:'chrome'});try{
 const p=await b.newPage({viewport:{width:390,height:844}});
 await p.route('**/api/auth/session',r=>r.fulfill({json:{user:null,session:null}}));
 for(const route of ['/login','/register','/rev','/live','/ai']){
  await p.goto(base+route);await p.locator('main h1').first().waitFor();
  assert.equal(await p.locator('.nav-brand').innerText(),'tikeai');
  assert.equal(await p.locator('.nav-brand').getAttribute('aria-label'),'tikeai 首页');
  assert.ok(!/\bAPEX\b/.test(await p.locator('main').innerText()),route+': visible copy uses current brand');
  assert.ok(!/\bAPEX\b/.test(await p.title()),route+': metadata uses current brand');
  assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 }
 const manifest=await(await p.request.get(base+'/manifest.json')).json();assert.equal(manifest.name,'tikeai Control');assert.equal(manifest.short_name,'tikeai');
 for(const url of ['/icon.svg','/admin-icon.svg','/admin-icon-192.png','/admin-icon-512.png','/apple-touch-icon.png'])assert.equal((await p.request.get(base+url)).status(),200,url);
 await p.getByRole('button',{name:'切换导航菜单'}).click();assert.equal(await p.getByRole('dialog').getByRole('link',{name:'tikeai',exact:true}).count(),1);
 console.log('PASS tikeai branding: mobile wordmark, accessible name, visible copy, metadata, navigation, manifest and icon assets');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
