import {test} from 'node:test';
import assert from 'node:assert/strict';
import {selectFavoriteTeams, sessionEvidence} from '../lib/profile/paddock';

test('favorites join canonical IDs without inventing missing points', () => {
  const result = selectFavoriteTeams(['ferrari','missing'], [{teamId:'ferrari',points:27,rank:3,name:'Ferrari'}] as any, [{teamId:'ferrari',driverId:'a'}] as any, [{constructorId:'ferrari',driverId:'a',position:4}] as any);
  assert.equal(result[0].standing?.points,27);
  assert.equal(result[0].recent[0].position,4);
  assert.equal(result[1].standing,undefined);
  assert.equal(result[1].drivers.length,0);
});
test('elapsed session timing is not confirmed results', () => {
  const session:any={type:'race',startTimeUTC:'2026-01-01T00:00:00Z',durationMinutes:120};
  assert.equal(sessionEvidence(session,0,Date.parse('2026-01-01T03:00:00Z')),'预计已结束 · 赛果待同步');
  assert.equal(sessionEvidence(session,3,Date.parse('2026-01-01T03:00:00Z')),'成绩已收录');
  assert.equal(sessionEvidence({...session,type:'practice'},0,Date.parse('2026-01-01T03:00:00Z')),'预计已结束 · 本页不提供练习成绩');
  assert.equal(sessionEvidence({...session,startTimeUTC:'invalid'},0,Date.now()),'时间待公布');
});
