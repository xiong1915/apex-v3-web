const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const base=process.env.QA_BASE_URL||'http://127.0.0.1:3301';
(async()=>{
 const b=await chromium.launch({channel:'chrome'});
 try{
  const p=await b.newPage({viewport:{width:1440,height:1000}});
  const checks=[];
  for(const route of ['/','/races','/standings','/drivers','/teams','/live','/login','/register','/forgot-password','/rev']){
   await p.goto(base+route,{waitUntil:'domcontentloaded',timeout:90000});
   await p.locator('.home-loading').waitFor({state:'detached',timeout:60000});
   await p.waitForTimeout(300);
   const material=await p.evaluate(()=>{
    const surfaces=[...document.querySelectorAll('.glass-surface,.race-cover,.driver-tile,.team-tile,.calendar-tile,.table-panel,.race-detail-info,.page-heading')].filter(el=>el.getBoundingClientRect().height>0);
    return surfaces.map(el=>({className:el.className,bg:getComputedStyle(el).backgroundColor,filter:getComputedStyle(el).backdropFilter,color:getComputedStyle(el).color}));
   });
   for(const item of material){assert.equal(item.bg,'rgba(0, 0, 0, 0)',`${route} ${item.className} must not introduce colored fill`);assert.match(item.filter,/blur\(/,`${route} ${item.className} readable frost`);}
   assert.equal(await p.locator('.site-header').evaluate(el=>getComputedStyle(el).backgroundColor),'rgba(0, 0, 0, 0)');
   assert.equal(await p.locator('.site-footer').evaluate(el=>getComputedStyle(el).backgroundColor),'rgba(0, 0, 0, 0)');
   assert.equal(await p.locator('.home-lab-banner').count(),0);
   checks.push({route,surfaces:material.length});
  }
  await p.goto(base+'/rev');
  for(const [width,height] of [[375,667],[390,844],[430,932],[844,390]]){
   await p.setViewportSize({width,height});await p.getByRole('button',{name:/^DRAG RACE /}).click();await p.getByRole('button',{name:/开始比赛/}).click();await p.waitForTimeout(300);
   const pedal=await p.getByRole('button',{name:/油门，向上滑动/}).boundingBox();assert.ok(pedal.y+pedal.height<=height,`controls fit ${width}x${height}`);
   assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   assert.equal(await p.locator('.wallpaper-toggle').isVisible(),false,'wallpaper control cannot cover throttle');
   assert.equal(await p.getByRole('button',{name:'静音',exact:true}).isVisible(),true,'mobile mute remains reachable');
   await p.getByRole('button',{name:'静音',exact:true}).click();await p.getByRole('button',{name:'取消静音',exact:true}).click();
   const volume=p.getByRole('slider',{name:'主音量'});assert.equal(await volume.isVisible(),true,'mobile volume stays visible');
   await p.keyboard.press('ShiftLeft');await p.waitForTimeout(150);assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'failure result stays within narrow screen');
   await p.getByRole('button',{name:'← 模式大厅',exact:true}).click();
  }
  console.log('PASS shared colorless transparent surfaces and frosted text across routes, 375/390/430 portrait + 844 landscape controls');console.log(JSON.stringify(checks));
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
