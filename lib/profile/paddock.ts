import type {ConstructorStanding, DriverStanding, DetailedRaceResultItem, F1Session} from '@/lib/f1/types';
import {RaceStateService} from '@/lib/f1/race-state';

export function selectFavoriteTeams(ids: string[], teams: ConstructorStanding[], drivers: DriverStanding[], recent: DetailedRaceResultItem[]) {
  return ids.map(id => ({id, standing:teams.find(team=>team.teamId===id), drivers:drivers.filter(driver=>driver.teamId===id), recent:recent.filter(row=>row.constructorId===id)}));
}

export function sessionEvidence(session:F1Session, resultCount:number, now:number) {
  if (resultCount) return '成绩已收录';
  if (!Number.isFinite(Date.parse(session.startTimeUTC))) return '时间待公布';
  if (Date.parse(session.startTimeUTC)>now) return '计划开赛';
  if (RaceStateService.getSessionEndMs(session)>now) return '按赛程预计进行中';
  if (session.type==='practice') return '预计已结束 · 本页不提供练习成绩';
  if (session.type==='sprint_qualifying') return '预计已结束 · 冲刺排位成绩请查看分站页';
  return '预计已结束 · 赛果待同步';
}
