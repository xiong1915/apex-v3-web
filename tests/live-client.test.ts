import {test} from 'node:test';
import assert from 'node:assert/strict';
import {countdownParts, connectionForDisplay, phaseForDisplay, sortLiveDrivers, retryDelay} from '../components/live/model';
import type {LiveDriver} from '../lib/f1/live/types';

test('elapsed schedule only becomes waiting, never live or finished', () => {
 assert.equal(phaseForDisplay('UPCOMING', '2026-01-01T00:00:00Z', Date.parse('2026-01-01T00:01:00Z')), 'WAITING');
 assert.equal(phaseForDisplay('SUSPENDED', '2026-01-01T00:00:00Z', Date.parse('2026-01-02T00:00:00Z')), 'SUSPENDED');
 assert.equal(phaseForDisplay('UPCOMING', '', Date.now()), 'WAITING');
 assert.deepEqual(countdownParts('invalid', Date.now()), null);
 assert.deepEqual(countdownParts('2026-01-02T01:02:03Z', Date.parse('2026-01-01T00:00:00Z')), [1,1,2,3]);
});
test('lost or stale timing retains a distinct visible connection status', () => {
 const now=Date.parse('2026-01-01T00:01:00Z');
 assert.equal(connectionForDisplay('LIVE','2026-01-01T00:00:00Z',now,false),'DELAYED');
 assert.equal(connectionForDisplay('LIVE','2026-01-01T00:00:59Z',now,true),'RECONNECTING');
 assert.equal(connectionForDisplay('FINISHED','2026-01-01T00:00:00Z',now,false),'FINISHED');
 assert.equal(connectionForDisplay('LIVE',null,now,false),'UNAVAILABLE');
});
test('timing sorting is stable, handles missing values and never mutates a snapshot', () => {
 const rows=[{number:'44',position:2,bestLap:null},{number:'1',position:1,bestLap:'1:20.100'},{number:'16',position:3,bestLap:'1:20.100'}] as LiveDriver[];
 assert.deepEqual(sortLiveDrivers(rows,'best').map(row=>row.number),['1','16','44']);
 assert.deepEqual(sortLiveDrivers(rows,'position').map(row=>row.number),['1','44','16']);
 assert.equal(rows[0].number,'44');
 assert.equal(retryDelay(0,()=>0),1500);
 assert.equal(retryDelay(20,()=>1),60000);
});
