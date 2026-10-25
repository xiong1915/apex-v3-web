// Synthetic protocol fixtures are intercepted locally; never presented as production live verification.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.QA_BASE_URL||'http://127.0.0.1:3100';
if(!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(base))throw Error('Localhost required');
const output=process.env.QA_ARTIFACT_DIR||path.join(require('node:os').tmpdir(),'apex-live-acceptance');
fs.mkdirSync(output,{recursive:true});
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const context=await browser.newContext({viewport:{width:1440,height:1000}});
  const page=await context.newPage(),errors=[],calls=[];
  await page.clock.install({time:Date.now()});
  page.on('pageerror',error=>errors.push(error.message));
  let allowed=false,phase='UPCOMING',segment=null,flag=null,failed=false,stale=false;
  const starts=new Date(Date.now()+1500).toISOString();
  const sessions=[['fp1','第一次自由练习','practice'],['fp2','第二次自由练习','practice'],['fp3','第三次自由练习','practice'],['sq','冲刺排位赛','sprint_qualifying'],['sprint','冲刺赛','sprint'],['quali','大奖赛排位赛','qualifying'],['race','大奖赛正赛','race']].map(([id,name,type],index)=>({id,name,nameEn:id,type,startTimeUTC:index===6?new Date(Date.now()+86400000).toISOString():starts,durationMinutes:type==='race'?120:60}));
  const driver=(number,position,lastLap,bestLap)=>({number,position,code:number==='44'?'HAM':'VER',name:number==='44'?'本地车手甲':'本地车手乙',team:'协议验收车队',teamColour:'e10600',lastLap,bestLap,sectors:['25.100','29.200',null],completedLaps:12,gapLeader:position===1?'LEADER':'+1.200',gapAhead:position===1?null:'+1.200',compound:'MEDIUM',tyreAge:8,pitCount:1,inPit:false,retired:false,updatedAt:new Date().toISOString(),sectorPersonalBest:[true,false,false],sectorOverallBest:[false,true,false]});
  await context.route('**/*',async route=>{
   const url=new URL(route.request().url());
   if(url.origin!==base)return route.abort();
   if(url.pathname==='/api/auth/session')return route.fulfill({json:{user:null,session:null}});
   if(url.pathname==='/api/f1/live/snapshot'){
    calls.push(Object.fromEntries(url.searchParams));
    if(failed)return route.fulfill({status:503,json:{error:'本地验收连接故障'}});
    const selected=sessions.find(session=>session.id===url.searchParams.get('session'))||sessions[0];
    const timestamp=new Date(Date.now()-(stale?60000:0)).toISOString();
    return route.fulfill({json:{version:'3.3.0',serverTime:new Date().toISOString(),season:'2026',meeting:{round:18,season:'2026',name:'Local Test',nameZh:'本地协议验收大奖赛',country:'测试',locality:'隔离环境',circuitId:'americas',circuitName:'仅本地验收赛道',raceStartUTC:sessions[6].startTimeUTC,isSprintWeekend:true,sessions},session:selected,nextSession:sessions[6],calendarUpdatedAt:timestamp,calendarSource:'local-test-fixture',isStale:false,availability:{timingPublic:allowed,reason:'完整计时数据的公开展示许可尚未核实。',source:'local-test-fixture',officialUrl:'https://www.formula1.com/en/timing/f1-live',channels:[{name:'TimingData',status:'blocked',note:'仅本地合成测试'}]},sessions:sessions.map(session=>({session,phase:session.id===selected.id?phase:'UPCOMING',classification:'unavailable',reason:'本地合成测试'})),snapshot:{schema:1,sessionKey:selected.id,phase,connection:phase==='FINISHED'?'FINISHED':'LIVE',source:'local-test-fixture',sourceTimestamp:timestamp,receivedAt:timestamp,drivers:[driver('44',2,'1:20.222','1:20.100'),driver('1',1,'1:20.111','1:20.050')],flag,messages:flag?[{id:'test-flag',date:timestamp,text:'仅本地测试：红旗暂停'}]:[],weather:{airTemperature:24,trackTemperature:null,rainfall:false},currentLap:12,totalLaps:56,segment,remainingSeconds:720,classification:phase==='FINISHED'?'provisional':'unavailable',reason:phase==='SUSPENDED'?'红旗暂停，等待恢复':null},results:phase==='FINISHED'?[{position:1,number:'1',code:'VER',name:'本地车手乙',team:'协议验收车队',laps:56,time:'1:40:00.000',status:'Finished',points:25}]:[],resultStatus:phase==='FINISHED'?'provisional':'unavailable',resultSourceUrls:[]}});
   }
   return route.continue();
  });
  await page.goto(base+'/live?season=2026&round=18&legacySession=historic-test',{waitUntil:'domcontentloaded'});
  await page.getByRole('heading',{name:'完整实时圈速尚不可公开提供'}).waitFor();
  assert.equal(await page.getByRole('note').innerText(),'旧回放已升级，请选择分站和节次；历史回放编号不代表当前直播。');
  assert.equal(await page.locator('tbody tr').count(),0,'blocked permission never renders a mistakenly supplied timing snapshot');
  for(const width of [320,375,390,768,1440,1920]){
   await page.setViewportSize({width,height:width<768?844:1000});
   await page.waitForTimeout(80);
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`no document overflow at ${width}`);
   await page.screenshot({path:path.join(output,`live-${width}.png`),fullPage:width===1440});
  }
  await page.setViewportSize({width:1440,height:1000});
  await page.waitForTimeout(1700);
  await page.locator('[data-phase="WAITING"]').first().waitFor();
  assert.equal(await page.locator('[data-connection="LIVE"]').count(),0,'schedule expiration cannot enable live data');
  const deniedCalls=calls.length;
  await page.clock.fastForward(30000);
  assert.equal(calls.length,deniedCalls,'unlicensed calendar/results do not poll every 15 seconds');
  const minutePoll=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/f1/live/snapshot');
  await page.clock.fastForward(30000);await minutePoll;
  assert.equal(calls.length,deniedCalls+1,'public calendar/results use a 60-second polling interval');
  allowed=true;
  const refresh=()=>page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));
  await refresh();await page.locator('[data-connection="LIVE"]').waitFor();
  phase='LIVE';
  // No refresh or selection: automatic snapshot polling changes the phase.
  await page.locator('[data-phase="LIVE"]').first().waitFor({timeout:12000});
  assert.equal(await page.locator('tbody tr').count(),2);
  const timingTable=page.getByRole('region',{name:'实时计时表，可横向滚动'});
  for(const width of [320,375,390,768,1440,1920]){
   await page.setViewportSize({width,height:width<768?844:1000});
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`timing table contained at ${width}`);
   await page.screenshot({path:path.join(output,`live-table-${width}-local-fixture.png`)});
  }
  await page.setViewportSize({width:1440,height:1000});
  await page.getByLabel('查看顺序').selectOption('best');
  assert.match(await timingTable.locator('tbody tr').first().innerText(),/VER/);
  await page.getByRole('button',{name:'关注 HAM',exact:true}).click();
  await page.getByLabel('只看关注车手').check();
  assert.equal(await timingTable.locator('tbody tr').count(),1);
  assert.match(await timingTable.locator('tbody tr').innerText(),/HAM/);
  await page.getByLabel('只看关注车手').uncheck();
  await page.getByLabel('筛选车手或车队').fill('不存在的车手');
  assert.equal(await timingTable.locator('tbody tr').count(),0);
  await page.getByLabel('筛选车手或车队').fill('');
  phase='SUSPENDED';flag='RED';await refresh();
  await page.locator('[data-phase="SUSPENDED"]').first().waitFor();
  assert.equal(await timingTable.locator('tbody tr').count(),2,'red flag retains the timing table');
  await page.getByText('仅本地测试：红旗暂停',{exact:true}).waitFor();
  failed=true;await refresh();
  await page.locator('[data-connection="RECONNECTING"]').waitFor();
  assert.equal(await timingTable.locator('tbody tr').count(),2,'network failure preserves the last real snapshot');
  failed=false;phase='LIVE';flag=null;stale=true;
  await page.getByRole('button',{name:'重新连接',exact:true}).click();
  await page.locator('[data-connection="DELAYED"]').waitFor();
  assert.match(await page.locator('[data-connection="DELAYED"]').innerText(),/STALE/);
  stale=false;await refresh();await page.locator('[data-connection="LIVE"]').waitFor();
  // An inactive tab stops polling; foregrounding immediately fetches one new snapshot.
  await page.evaluate(()=>{window.__qaHidden=true;Object.defineProperty(document,'hidden',{configurable:true,get:()=>window.__qaHidden});document.dispatchEvent(new Event('visibilitychange'));});
  await page.waitForTimeout(200);const beforeHidden=calls.length;await page.waitForTimeout(3500);assert.equal(calls.length,beforeHidden);
  await page.evaluate(()=>{window.__qaHidden=false;document.dispatchEvent(new Event('visibilitychange'));});
  await page.waitForFunction(()=>document.querySelector('[data-connection="LIVE"]'));
  await page.waitForTimeout(150);assert.ok(calls.length>beforeHidden,'foreground must synchronize immediately');
  const cdp=await context.newCDPSession(page);await cdp.send('HeapProfiler.collectGarbage');
  const heapBefore=(await cdp.send('Runtime.getHeapUsage')).usedSize;
  for(let index=0;index<80;index++){const loaded=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/f1/live/snapshot');await refresh();await loaded;}
  await cdp.send('HeapProfiler.collectGarbage');const heapAfter=(await cdp.send('Runtime.getHeapUsage')).usedSize;
  assert.ok(heapAfter-heapBefore<8*1024*1024,`80 refreshes retain bounded heap: ${heapAfter-heapBefore}`);
  assert.equal(await timingTable.locator('tbody tr').count(),2,'repeated snapshots replace rows instead of accumulating');
  await cdp.detach();
  for(const [id,name,stages] of [['fp1','第一次自由练习',[]],['fp2','第二次自由练习',[]],['fp3','第三次自由练习',[]],['sq','冲刺排位赛',['SQ1','SQ2','SQ3']],['sprint','冲刺赛',[]],['quali','大奖赛排位赛',['Q1','Q2','Q3']],['race','大奖赛正赛',[]]]){
   const button=page.getByRole('button',{name:new RegExp(name)}).first();const loaded=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/f1/live/snapshot'&&new URL(response.url()).searchParams.get('session')===id);await button.click();await loaded;
   await page.waitForFunction(id=>new URL(location.href).searchParams.get('session')===id,id);
   await page.locator('[data-phase="LIVE"]').first().waitFor();
   for(const stage of stages){segment=stage;await refresh();await page.getByText(stage,{exact:true}).first().waitFor();}
   assert.equal(calls.at(-1).season,'2026');assert.equal(calls.at(-1).round,'18');assert.equal(calls.at(-1).session,id);
  }
  await page.getByRole('button',{name:/大奖赛排位赛/}).first().click();await page.locator('[data-phase="LIVE"]').first().waitFor();
  phase='FINISHED';segment=null;await refresh();await page.locator('[data-phase="FINISHED"]').first().waitFor();
  await page.getByRole('heading',{name:'临时成绩',exact:true}).waitFor();
  await page.screenshot({path:path.join(output,'live-finished-local-fixture.png')});
  await page.getByRole('button',{name:'查看下一节倒计时 ↗',exact:true}).waitFor();
  phase='UPCOMING';const nextLoaded=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/f1/live/snapshot'&&new URL(response.url()).searchParams.get('session')==='race');await page.getByRole('button',{name:'查看下一节倒计时 ↗',exact:true}).click();await nextLoaded;await page.locator('[data-phase="UPCOMING"]').first().waitFor();
  await page.emulateMedia({reducedMotion:'reduce'});
  const transition=await page.getByRole('button',{name:'取消关注 HAM',exact:true}).evaluate(button=>getComputedStyle(button).transitionDuration);assert.equal(transition,'0s');
  assert.deepEqual(errors,[]);
  await context.close();
  console.log(`PASS live timing: permission gate, 6 widths, scheduled WAITING, automatic LIVE, pause/resume, stale/failed/recovery, hidden/foreground, 80 refresh bounded heap delta=${heapAfter-heapBefore}, all session kinds and Q/SQ stages, filtering/favorites, provisional finish, reduced motion; synthetic local fixtures only`);
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
