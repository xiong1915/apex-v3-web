import { createHash } from 'node:crypto';
import type { F1Meeting } from './types';
import { RaceStateService } from './race-state';

const utc = (ms: number) => new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
const escapeText = (value: string) => value.replace(/\\/g, '\\\\').replace(/\r\n|\r|\n/g, '\\n').replace(/;/g, '\\;').replace(/,/g, '\\,');
// RFC 5545 counts octets, not UTF-16 code units; preserve Chinese and emoji.
function fold(line: string): string {
 const lines: string[] = []; let part = '', length = 0;
 for (const char of line) {
  const bytes = Buffer.byteLength(char);
  if (length + bytes > 75) { lines.push(part); part = ' '; length = 1; }
  part += char; length += bytes;
 }
 lines.push(part); return lines.join('\r\n');
}
export function renderCalendar(meetings: F1Meeting[], season: string, updatedAt: string): string {
 const modified = Date.parse(updatedAt);
 if (!Number.isFinite(modified)) throw new Error('Calendar update time unavailable');
 const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//APEX//F1 Calendar//ZH', 'CALSCALE:GREGORIAN',
  'METHOD:PUBLISH', `X-WR-CALNAME:APEX F1 ${season}`, 'X-WR-TIMEZONE:Asia/Shanghai', 'REFRESH-INTERVAL;VALUE=DURATION:PT1H', 'X-PUBLISHED-TTL:PT1H'];
 const seen = new Set<string>();
 for (const meeting of meetings) {
  for (const session of meeting.sessions || []) {
   const start = Date.parse(session.startTimeUTC);
   const end = RaceStateService.getSessionEndMs(session);
   if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) continue;
   const identity = `${meeting.season || season}:${meeting.round}:${session.id}`;
   if (seen.has(identity)) continue;
   seen.add(identity);
   const uid = createHash('sha256').update(identity).digest('hex').slice(0, 32);
   const link = `https://f1.tike69.cc.cd/races/${meeting.round}?season=${season}`;
   lines.push('BEGIN:VEVENT', `UID:${uid}@f1.tike69.cc.cd`, `DTSTAMP:${utc(modified)}`, `LAST-MODIFIED:${utc(modified)}`,
    `DTSTART:${utc(start)}`, `DTEND:${utc(end)}`, `SUMMARY:${escapeText(`${meeting.nameZh || meeting.name} · ${session.name}`)}`,
    `LOCATION:${escapeText(meeting.circuitName || meeting.locality || '')}`,
    `DESCRIPTION:${escapeText(`APEX F1 ${season} · 第 ${meeting.round} 站。开赛时间随上游赛历更新；结束时间如未官方公布则按预计时长计算。订阅客户端自行决定刷新频率。${link}`)}`,
    `URL:${link}`, 'TRANSP:TRANSPARENT', 'END:VEVENT');
  }
 }
 lines.push('END:VCALENDAR');
 return lines.map(fold).join('\r\n') + '\r\n';
}
