const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const path=require('node:path'),os=require('node:os');
const base=process.env.QA_BASE_URL||'http://127.0.0.1:3300';
if(!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(base))throw Error('Localhost required');
async function check(p,table){
 const rows=table.locator('tbody tr'),total=await rows.count();assert.ok(total>10,'long ranking fixture available');
 assert.equal(await table.locator('tbody tr:visible').count(),10,'default shows only ten');
 const list=table.locator('xpath=ancestor::*[contains(concat(" ",normalize-space(@class)," ")," ranking-list ")][1]');
 const toggle=list.locator('.ranking-disclosure button');await toggle.click();assert.equal(await table.locator('tbody tr:visible').count(),total);
 assert.equal(await toggle.getAttribute('aria-expanded'),'true');await toggle.press('Enter');assert.equal(await table.locator('tbody tr:visible').count(),10);
 assert.equal(await toggle.getAttribute('aria-expanded'),'false');
 const colors=await rows.evaluateAll(nodes=>nodes.map(el=>getComputedStyle(el).getPropertyValue('--team-color').trim()));assert.ok(colors.every(Boolean),'every driver has a team accent');
}
(async()=>{const b=await chromium.launch({channel:'chrome'});try{const p=await b.newPage();
 for(const width of [375,390,430,1440]){
  await p.setViewportSize({width,height:900});await p.goto(base+'/standings');await p.getByRole('tab',{name:/车手积分榜/}).click();await p.locator('.driver-standings').waitFor();await check(p,p.locator('.driver-standings'));
  await p.getByRole('tab',{name:/车队积分榜/}).click();await check(p,p.locator('.team-standings'));
  assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 }
 const results=Array.from({length:23},(_,index)=>({position:index+1,number:String(index+1),code:'T'+index,name:'本地排名车手 '+index,team:index%2?'Ferrari':'Mercedes',laps:56,time:index?'+'+index+'.000':'1:30:00.000',points:0,status:'Finished'}));
 const now=new Date().toISOString(),session={id:'local-race',name:'本地正赛',type:'race',startTimeUTC:now,durationMinutes:120};
 await p.route('**/api/f1/live/snapshot*',r=>r.fulfill({json:{version:'3.3.0',serverTime:now,season:'2026',meeting:{round:1,season:'2026',name:'Local test',nameZh:'本地折叠测试',circuitName:'本地赛道',locality:'本地',country:'测试',sessions:[session]},session,nextSession:null,calendarUpdatedAt:now,calendarSource:'local-fixture',isStale:false,availability:{timingPublic:false,reason:'仅本地固定数据',source:'local-fixture',channels:[]},sessions:[{session,phase:'FINISHED',classification:'official',reason:'本地成绩'}],snapshot:null,results,resultStatus:'official',resultSourceUrls:[]}}));
 await p.goto(base+'/live');const archive=p.getByRole('table').filter({has:p.getByRole('columnheader',{name:'时间 / 差距',exact:true})});await archive.locator('tbody th').filter({hasText:'本地排名车手 0'}).waitFor();await check(p,archive);
 await p.goto(base+'/races/18?season=2026');const raceTab=p.getByRole('tab',{name:/正赛成绩/});if(await raceTab.count()){await raceTab.click();const table=p.locator('.classification-table');await table.waitFor();await check(p,table);await p.getByRole('tab',{name:/排位成绩/}).click();if(await table.count())await check(p,table);for(const width of [375,390,430]){await p.setViewportSize({width,height:844});assert.equal(await table.evaluate(el=>getComputedStyle(el).display),'table','mobile classifications retain labelled columns');assert.equal(await table.locator('thead').evaluate(el=>getComputedStyle(el).display),'table-header-group');assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));}}
 await p.locator('.classification-table').scrollIntoViewIfNeeded();assert.equal(await p.locator('.classification-table thead').evaluate(el=>getComputedStyle(el).position),'static');await p.screenshot({path:path.join(os.tmpdir(),'tikeai-mobile-results.png'),animations:'disabled'});
 console.log('PASS ranking fold: standings, constructors, archived results, race/qualifying, expand, keyboard collapse, team colors and four viewports');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
