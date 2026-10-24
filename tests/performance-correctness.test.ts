import test from 'node:test';
import assert from 'node:assert/strict';
import { CircuitRegistry } from '../lib/circuits/registry';
import { filterAndRankCandidates } from '../lib/search/filter';
import { defaultAIOrchestrator } from '../lib/ai/orchestrator';
import { defaultF1Service } from '../providers/f1/service';
import { defaultSearchService } from '../lib/search/service';

test('2010 Bahrain cannot display the standard GP asset', () => {
  assert.equal(CircuitRegistry.getCircuit('bahrain','2010'), null);
  assert.equal(CircuitRegistry.getAllCircuits('2010').some(c=>c.circuitId==='bahrain'), false);
  assert.ok(CircuitRegistry.getCircuit('bahrain','2011'));
  assert.ok(CircuitRegistry.getCircuit('bahrain','2020',undefined,'Bahrain Grand Prix'));
  assert.equal(CircuitRegistry.getCircuit('bahrain','2020',undefined,'Sakhir Grand Prix'),null);
});
test('reject unrelated news and commercial qualifying pages', () => {
  const rows = [
    {title:'国际新闻最新消息',snippet:'世界动态',url:'https://www.bbc.com/news/world'},
    {title:'2026 F1 新加坡排位赛门票',snippet:'qualifying tickets buy now',url:'https://www.formula1.com/tickets/singapore'},
  ];
  assert.deepEqual(filterAndRankCandidates(rows as any,{query:'2026新加坡排位赛前三名',season:'2026',meetingName:'新加坡'}), []);
});
test('explicit historical search retains the requested year', () => {
  const q=defaultAIOrchestrator.extractSearchKeyword('2004年法拉利赛车');
  assert.ok(!q.includes('2026'));
  assert.ok(q.includes('2004'));
});
test('last-race facts do not attach an old race note or answer another meeting with a schedule',()=>{
 const overview:any={season:'2026',currentMeeting:{round:18},nextSession:{status:'NEXT'},previousRace:{round:17,name:'Singapore Grand Prix',nameZh:'新加坡大奖赛',winner:{name:'Test',team:'Test'},podium:[]}};
 const calendar:any[]=[{round:16,name:'Bahrain Grand Prix',nameZh:'巴林大奖赛',sessions:[]}];
 const fact=defaultAIOrchestrator.getCanonicalFactBlock('F1_FACTUAL','上一站冠军是谁',overview,calendar);
 assert.ok(fact);assert.ok(!fact.factText.includes('雪邦'));assert.ok(!fact.factText.includes('1:38.220'));
 assert.equal(defaultAIOrchestrator.getCanonicalFactBlock('F1_FACTUAL','巴林大奖赛正赛冠军是谁',overview,calendar),null);
 assert.equal(defaultAIOrchestrator.getFactCard('F1_FACTUAL','巴林大奖赛正赛冠军是谁',overview,calendar),null);
});
test('pure standings facts use one snapshot without web search', async t => {
  let reads=0;
  t.mock.method(defaultF1Service,'getOverview',async()=>{reads++; return {season:'2026',driverStandings:[{rank:1,name:'Test',points:100,team:'Test',wins:1}],constructorStandings:[],standingsCutoffDesc:'测试数据',currentMeeting:{round:18},previousRace:null} as any;});
  t.mock.method(defaultF1Service,'getCalendar',async()=>[]);
  t.mock.method(defaultSearchService,'search',async()=>{throw new Error('search must not run');});
  const events=[];
  for await (const e of defaultAIOrchestrator.streamAnswer([{role:'user',content:'当前车手积分榜前三名'}])) events.push(e);
  assert.equal(reads,1);
  assert.equal(events.at(-1)?.type,'done');
  assert.ok(events.some(e=>e.type==='fact_card'));
});
