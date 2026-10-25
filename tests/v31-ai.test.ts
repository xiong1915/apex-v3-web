import test from 'node:test';
import assert from 'node:assert/strict';
import { AIOrchestrator } from '../lib/ai/orchestrator';
import { defaultF1Service } from '../providers/f1/service';
import { DeepSeekProvider } from '../providers/ai/deepseek';
import { ConversationService, MemoryConversationStore } from '../lib/ai/conversations';

const overview = {
 currentMeeting: null, nextSession: {}, previousRace: null,
 driverStandings: [
  {rank:1,name:'测试领先车手',team:'车队甲',points:200,gap:0,wins:5},
  {rank:2,name:'测试·追赶车手',team:'车队乙',points:180,gap:20,wins:3}
 ], constructorStandings: [], standingsCutoffDesc:'测试第十站后'
};
test('championship probability and mixed standings strategy route to deep analysis', () => {
 const ai = new AIOrchestrator();
 assert.equal(ai.classifyIntent('F1 谁能夺冠？请分析争冠概率'), 'F1_ANALYSIS');
 assert.equal(ai.classifyIntent('诺里斯目前多少分，为什么他的进站策略影响争冠？'), 'F1_ANALYSIS');
 assert.equal(ai.classifyIntent('车手积分榜前三是谁？'), 'F1_FACTUAL');
 assert.equal(ai.classifyIntent('F1 最快圈现在还有加分吗？'), 'F1_ANALYSIS');
});
test('individual driver card and prose use the requested driver even without a current meeting', () => {
 const ai = new AIOrchestrator();
 const query = '追赶车手现在多少分？排名第几？';
 const fact = ai.getCanonicalFactBlock('F1_FACTUAL', query, overview);
 const card = ai.getFactCard('F1_FACTUAL', query, overview);
 assert.match(fact!.factText, /测试·追赶车手/);
 assert.match(fact!.factText, /180/);
 assert.doesNotMatch(fact!.factText, /测试领先车手/);
 assert.equal(card!.fields.find(f => f.label === '赛季积分')!.value, '180 分');
});
test('analysis prompt uses scoring rules and explicit unavailable fields when snapshot is incomplete', async () => {
 const originalOverview = defaultF1Service.getOverview, originalCalendar = defaultF1Service.getCalendar, originalFetch = globalThis.fetch;
 globalThis.fetch = async () => { throw new Error('Network forbidden in offline tests'); };
 defaultF1Service.getOverview = async () => ({...overview,driverStandings:[]} as any);
 defaultF1Service.getCalendar = async () => [];
 try {
  const prompt = await new AIOrchestrator().buildPrompt('F1_ANALYSIS','F1 争冠概率分析');
  assert.match(prompt.systemPrompt, /33/);
  assert.match(prompt.systemPrompt, /最快圈不再额外加分/);
  assert.match(prompt.systemPrompt, /不得编造精确夺冠百分比/);
  assert.match(prompt.systemPrompt, /暂无可核实的榜首数据/);
  assert.doesNotMatch(prompt.systemPrompt, /安东内利 325/);
 } finally {defaultF1Service.getOverview=originalOverview;defaultF1Service.getCalendar=originalCalendar;globalThis.fetch=originalFetch;}
});
test('fact fast path retrieves once, emits sources and reports timings and fast mode', async () => {
 const originalOverview = defaultF1Service.getOverview;
 const originalCalendar = defaultF1Service.getCalendar;
 const originalFetch = globalThis.fetch;
 globalThis.fetch = async () => { throw new Error('Network forbidden in offline tests'); };
 let calls = 0;
 defaultF1Service.getOverview = async () => { calls++; return overview as any; };
 defaultF1Service.getCalendar = async () => { throw new Error('standings must not retrieve calendar'); };
 try {
  const ai = new AIOrchestrator();
  const events = [];
  for await (const event of ai.streamAnswer([{role:'user',content:'车手积分榜前三是谁？'}])) events.push(event);
  assert.equal(calls, 1);
  assert.ok(events.some(e => e.type === 'sources' && e.sources?.length));
  assert.ok(events.some(e => e.type === 'meta' && e.mode === 'fast'));
  assert.ok(events.some(e => e.type === 'timing' && e.stage === 'first_text'));
  assert.ok(events.some(e => e.type === 'timing' && e.stage === 'total'));
  assert.match(events.filter(e => e.type === 'delta').map(e => e.content).join(''), /测试领先车手/);
  assert.equal(events.at(-1)?.type, 'done');
  const answer = await ai.answer([{role:'user',content:'车手积分榜前三是谁？'}]);
  assert.equal(answer.mode,'fast');
  assert.equal(answer.reply, events.filter(e => e.type === 'delta').map(e => e.content).join(''));
  assert.deepEqual(answer.sources,events.find(e=>e.type==='sources')?.sources);
 } finally { globalThis.fetch = originalFetch; defaultF1Service.getOverview = originalOverview; defaultF1Service.getCalendar = originalCalendar; }
});
test('generated conversation titles are unique per account under concurrent creation', async () => {
 const service = new ConversationService(new MemoryConversationStore());
 const turns = [{id:'one',role:'user' as const,content:'相同问题'}];
 const records = await Promise.all([service.create('a', turns), service.create('a', turns)]);
 assert.equal(new Set(records.map(c => c.title)).size, 2);
 assert.equal((await service.create('b', turns)).title, '相同问题');
});
test('retrying a draft creation with the same id preserves a single record and refuses conflicting content', async () => {
 const service = new ConversationService(new MemoryConversationStore());
 const turns = [{id:'one',role:'user' as const,content:'保留这段对话'}];
 const id = '30000000-0000-4000-8000-000000000001';
 const first = await service.create('a', turns, id);
 const retry = await service.create('a', turns, id);
 assert.equal(first.id, retry.id);
 assert.equal((await service.list('a')).length, 1);
 await assert.rejects(service.create('a', [{...turns[0],content:'不可覆盖'}], id), (e: any) => e.status === 409);
 assert.equal((await service.read('a', id)).messages[0].content, '保留这段对话');
});
test('DeepSeek rejects nonstream truncated output and a DONE marker without completion evidence', async () => {
 const originalFetch = globalThis.fetch;
 const provider = new DeepSeekProvider({apiKey:'unit-test-key'});
 try {
  globalThis.fetch = async () => Response.json({choices:[{message:{content:'部分内容'},finish_reason:'length'}]});
  await assert.rejects(provider.generate({messages:[{role:'user',content:'test'}]}), /完整|截断/);
  globalThis.fetch = async () => new Response('data: {"choices":[{"delta":{"content":"部分"}}]}\n\ndata: [DONE]\n\n');
  const events = [];
  for await (const event of provider.stream({messages:[{role:'user',content:'test'}]})) events.push(event);
  assert.ok(events.some(e => e.type === 'error'));
  assert.ok(!events.some(e => e.type === 'done'));
 } finally { globalThis.fetch = originalFetch; }
});
test('DeepSeek nonstream completion requires nonempty text and reads completed Responses output', async () => {
 const originalFetch = globalThis.fetch;
 const provider = new DeepSeekProvider({apiKey:'unit-test-key',apiStyle:'responses'});
 try {
  globalThis.fetch = async () => Response.json({status:'completed',output:[]});
  await assert.rejects(provider.generate({messages:[{role:'user',content:'test'}]}), /有效文本/);
  globalThis.fetch = async () => Response.json({status:'completed',output:[{type:'message',content:[{type:'output_text',text:'完整回答'}]}]});
  assert.equal((await provider.generate({messages:[{role:'user',content:'test'}]})).content,'完整回答');
 } finally {globalThis.fetch=originalFetch;}
});


test('named race query does not substitute an unrelated previous winner', async () => {
 const ai = new AIOrchestrator();
 const snapshot = {...overview,previousRace:{round:10,nameZh:'测试旧站',name:'Old GP',winner:{name:'错误冠军',team:'T'}}};
 assert.equal(ai.getCanonicalFactBlock('F1_FACTUAL','新加坡站冠军是谁？',snapshot,[]),null);
 assert.equal(ai.getFactCard('F1_FACTUAL','新加坡站冠军是谁？',snapshot,[]),null);
});
test('DeepSeek rejects completed empty and whitespace streams', async () => {
 const originalFetch = globalThis.fetch;
 try {
  for (const content of ['', '   ']) {
   globalThis.fetch = async () => new Response('data: '+JSON.stringify({choices:[{delta:{content},finish_reason:'stop'}]})+'\n\ndata: [DONE]\n\n');
   const events = [];
   for await (const event of new DeepSeekProvider({apiKey:'unit-test-key'}).stream({messages:[{role:'user',content:'test'}]})) events.push(event);
   assert.ok(events.some(e=>e.type==='error')); assert.ok(!events.some(e=>e.type==='done'));
  }
 } finally { globalThis.fetch=originalFetch; }
});
test('stale history owner is refused before reading or writing any account store', async () => {
 const {handleConversationRequest} = await import('../lib/ai/conversation-handler');
 const {NextRequest} = await import('next/server');
 let stores=0;
 const dependencies={getUser:async()=>({id:'account-b'}) as any,getService:()=>{stores++;return new ConversationService(new MemoryConversationStore());}};
 for(const method of ['GET','POST','PUT','DELETE']) {
  const req=new NextRequest('http://localhost/api/ai/conversations',{method,headers:{'x-apex-history-owner':'account-a'},...(method==='GET'?{}:{body:'{}'})});
  const result=await handleConversationRequest(req,method,dependencies);
  assert.equal(result.status,409); assert.equal(result.headers.get('cache-control'),'private, no-store');
 }
 assert.equal(stores,0);
});
