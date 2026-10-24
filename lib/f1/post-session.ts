import type { F1Meeting } from './types';
import { RaceStateService } from './race-state';
export function postSessionWindow(calendar:F1Meeting[],now=Date.now()) {
  return calendar.flatMap(meeting=>(meeting.sessions||[])
    .filter(session=>session.type==='race'||session.type==='sprint')
    .map(session=>({round:meeting.round,type:session.type,end:RaceStateService.getSessionEndMs(session)})))
    .filter(event=>event.end<=now&&now-event.end<6*3600000)
    .sort((a,b)=>b.end-a.end)[0] || null;
}
