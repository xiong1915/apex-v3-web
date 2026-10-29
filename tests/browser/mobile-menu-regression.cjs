const assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.QA_BASE_URL||'http://127.0.0.1:3100';
if(!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(base))throw Error('Localhost required');
(async()=>{const b=await chromium.launch({channel:'chrome',headless:true});try{
 const c=await b.newContext({viewport:{width:390,height:844}});let fails=true;
 await c.route('**/api/auth/session',r=>r.fulfill({json:{user:{id:'local-user',email:'test@example.invalid'},session:null}}));
 await c.route('**/api/profile',r=>r.fulfill({json:{profile:{id:'local-user',display_name:'本地测试',avatar_url:null,favorite_team_ids:[]}}}));
 await c.route('**/api/auth/logout',r=>fails?r.fulfill({status:503,json:{error:'local failure'}}):r.fulfill({json:{ok:true}}));
 const p=await c.newPage();await p.goto(base+'/login');await p.getByRole('button',{name:'切换导航菜单'}).click();const menu=p.getByRole('dialog',{name:'网站导航'});await menu.getByText('本地测试').waitFor();
 assert.doesNotMatch(await menu.innerText(),/[↗→←↓]/);
 await menu.getByRole('button',{name:'退出登录'}).click();await menu.getByRole('alert').waitFor();assert.match(await menu.getByRole('alert').innerText(),/失败/);assert.equal(await menu.isVisible(),true);
 fails=false;await menu.getByRole('button',{name:'退出登录'}).click();await menu.waitFor({state:'hidden'});
 console.log('PASS mobile menu: clear links, visible logout failure and successful retry');await c.close();
 }finally{await b.close()}})().catch(e=>{console.error(e);process.exit(1)});
