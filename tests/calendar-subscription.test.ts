import test from 'node:test';
import assert from 'node:assert/strict';
import { renderCalendar } from '../lib/f1/ical';
import type { F1Meeting } from '../lib/f1/types';
import { NextRequest } from 'next/server';
import { GET } from '../app/api/f1/calendar.ics/route';
import { defaultF1Service } from '../providers/f1/service';

const meeting = {
 season: '2026', round: 18, name: 'United States Grand Prix', nameZh: '美国大奖赛', circuitName: 'COTA, Austin;Texas',
 sessions: [{id:'fp1', name:'练习一', type:'practice', startTimeUTC:'2026-10-23T17:30:00Z', durationMinutes:60},
 {id:'race', name:'正赛', type:'race', startTimeUTC:'2026-10-25T20:00:00Z', durationMinutes:120},
 {id:'unknown', name:'待定', type:'qualifying', startTimeUTC:'', durationMinutes:60}]
} as F1Meeting;
test('ICS uses UTC, CRLF, stable event identities and changed schedule data', () => {
 const calendar=renderCalendar([meeting], '2026', '2026-10-20T00:00:00Z');
 assert.match(calendar,/DTSTART:20261025T200000Z/);
 assert.match(calendar,/DTEND:20261025T220000Z/);
 assert.equal((calendar.match(/BEGIN:VEVENT/g)||[]).length,2);
 assert.ok(!calendar.replaceAll('\r\n','').includes('\n'));
 const moved=structuredClone(meeting);moved.sessions[1].startTimeUTC='2026-10-25T21:00:00Z';
 const updated=renderCalendar([moved], '2026', '2026-10-21T00:00:00Z');
 assert.deepEqual(calendar.match(/UID:.+/g), updated.match(/UID:.+/g));
 assert.match(updated,/DTSTART:20261025T210000Z/);
 assert.match(updated,/LAST-MODIFIED:20261021T000000Z/);
});
test('ICS escapes text and folds Unicode at 75 octets without header injection', () => {
 const race=structuredClone(meeting);race.nameZh='测试比赛'.repeat(40)+'\nBEGIN:VEVENT';
 const calendar=renderCalendar([race], '2026', '2026-10-20T00:00:00Z');
 for(const line of calendar.split('\r\n'))assert.ok(Buffer.byteLength(line)<=75);
 assert.ok(!calendar.includes('\ufffd'));
 assert.equal((calendar.match(/\r\nBEGIN:VEVENT\r\n/g)||[]).length,2);
 assert.match(calendar,/COTA\\, Austin\\;Texas/);
});
test('ICS does not invent times or duplicate identical session IDs', () => {
 const race=structuredClone(meeting);race.sessions.push(race.sessions[0]);
 assert.equal((renderCalendar([race], '2026','2026-10-20T00:00:00Z').match(/BEGIN:VEVENT/g)||[]).length,2);
});
test('subscription HTTP feed serves public data and reports unavailable without empty-success cache', async t => {
 t.mock.method(defaultF1Service, 'getCalendarResult', async () => ({data:[meeting], source:'cache',fetchedAt:'2026-10-20T00:00:00Z',isStale:false}));
 const response=await GET(new NextRequest('https://f1.tike69.cc.cd/api/f1/calendar.ics?season=2026&download=1'));
 assert.equal(response.status,200);
 assert.match(response.headers.get('content-type')!,/text\/calendar/);
 assert.match(response.headers.get('content-disposition')!,/attachment/);
 assert.match(await response.text(),/BEGIN:VCALENDAR/);
 assert.equal((await GET(new NextRequest('https://f1.tike69.cc.cd/api/f1/calendar.ics?season=garbage'))).status,400);
 t.mock.method(defaultF1Service, 'getCalendarResult', async () => ({data:[],source:'unavailable',fetchedAt:'2026-10-20T00:00:00Z'}));
 const failed=await GET(new NextRequest('https://f1.tike69.cc.cd/api/f1/calendar.ics'));
 assert.equal(failed.status,503);
 assert.equal(failed.headers.get('cache-control'),'no-store');
});
