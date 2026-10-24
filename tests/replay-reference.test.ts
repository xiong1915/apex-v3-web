import test from 'node:test';
import assert from 'node:assert/strict';
import { getReplayManifest, getReplayWindow } from '../lib/f1/replay/openf1';
test('reference lap falls back to a driver with valid coordinates; session indexes are reused',async t=>{
  let lapReads=0, positionReads=0;
  t.mock.method(globalThis,'fetch',async (input:RequestInfo | URL)=>{
    const url=new URL(String(input));const endpoint=url.pathname.split('/').at(-1);
    if(endpoint==='sessions')return Response.json([{session_key:987654,session_name:'Race',year:2023,date_start:'2023-03-05T15:00:00Z',date_end:'2023-03-05T17:00:00Z',circuit_short_name:'Test'}]);
    if(endpoint==='drivers')return Response.json([{driver_number:1},{driver_number:2}]);
    if(endpoint==='laps'){lapReads++;return Response.json([{driver_number:2,lap_number:2,lap_duration:90,date_start:'2023-03-05T15:03:00Z'}]);}
    if(endpoint==='position'){positionReads++;return Response.json([]);}
    if(endpoint==='location')return Response.json(Array.from({length:40},(_,i)=>({x:i+1,y:i%10+1})));
    return Response.json([]);
  });
  const manifest=await getReplayManifest(987654);
  assert.ok(manifest.metadata.trackPath.length);
  await getReplayWindow(manifest,0);await getReplayWindow(manifest,60);
  assert.equal(lapReads,1);assert.equal(positionReads,1);
});
