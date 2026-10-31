import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {RaceDetailTabs} from '../components/race-detail-tabs';

test('race classification retains supplied fastest lap, grid, laps, status and points when folded',()=>{
 const result={position:1,driverId:'local',driverName:'本地车手',driverCode:'TST',driverNumber:'99',constructorId:'ferrari',constructorName:'Ferrari',grid:3,laps:56,status:'Finished',points:25,time:'1:30:00.000',fastestLap:{rank:'1',lap:42,time:'1:20.123'}};
 const html=renderToStaticMarkup(<RaceDetailTabs raceResults={[result]} qualiResults={[]} sprintResults={[]} sessions={[]} circuitId="local" season="2026" meetingName="本地测试" round={1} isHistorical/>);
 assert.match(html,/最快圈 1:20\.123/);
 assert.match(html,/<td class="mono">P3<\/td>/);
 assert.match(html,/<td class="mono">56<\/td>/);
 assert.match(html,/1:30:00\.000/);
 assert.match(html,/--team-color:#E8002D/);
 assert.match(html,/<th scope="col">圈数<\/th>/);
 const without=renderToStaticMarkup(<RaceDetailTabs raceResults={[{...result,fastestLap:undefined}]} qualiResults={[]} sprintResults={[]} sessions={[]} circuitId="local" season="2026" meetingName="本地测试" round={1} isHistorical/>);
 assert.doesNotMatch(without,/classification-fastest/,'missing fastest lap cannot be inferred');
});
