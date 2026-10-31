import test from 'node:test';
import assert from 'node:assert/strict';
import {releaseHistory} from '../lib/release-history';

test('release history retains initial version and recent merged features with unique ordered references',()=>{
 assert.equal(new Set(releaseHistory.map(entry=>entry.sha)).size,releaseHistory.length);
 for(const [index,entry] of releaseHistory.entries()){
  assert.match(entry.sha,/^[a-f\d]{40}$/);
  assert.ok(Number.isFinite(Date.parse(entry.date)));
  assert.ok(entry.summary.trim().length>0);
  if(index)assert.ok(Date.parse(releaseHistory[index-1].date)>=Date.parse(entry.date),'newest updates appear first');
 }
 assert.equal(releaseHistory.at(-1)?.sha,'118047267877c53dc9093ec31b74613ae0704f53');
 const bySha=new Map(releaseHistory.map(entry=>[entry.sha.slice(0,7),entry]));
 for(const sha of ['e851fa7','4020ef1','d64c875','d09cc02','8cc1389','1cc4561','2ee72ab','000a232','2e40f8d'])assert.ok(bySha.has(sha),`previously missing update ${sha} is recorded`);
 assert.match(bySha.get('e851fa7')!.summary,/前十名折叠/);
 assert.match(bySha.get('4020ef1')!.summary,/手机管理后台/);
});
