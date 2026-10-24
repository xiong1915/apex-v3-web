import test from 'node:test';
import assert from 'node:assert/strict';
import {postSessionWindow} from '../lib/f1/post-session';
test('refresh window is bounded to six hours after scoring sessions',()=>{
 const calendar=[{round:2,sessions:[{type:'race',startTimeUTC:'2026-10-25T20:00:00Z',durationMinutes:120}]}] as any;
 assert.equal(postSessionWindow(calendar,Date.parse('2026-10-25T21:00:00Z')),null);
 assert.equal(postSessionWindow(calendar,Date.parse('2026-10-25T22:01:00Z'))?.round,2);
 assert.equal(postSessionWindow(calendar,Date.parse('2026-10-26T04:01:00Z')),null);
});
