export const OFFICIAL_LIVE_TIMING_URL = 'https://www.formula1.com/en/timing/f1-live';
export function buildLiveRedirect(params: Record<string, string | string[] | undefined>): string {
 const query=new URLSearchParams();
 const season=params.season || params.year;
 if(typeof season==='string' && /^\d{4}$/.test(season) && +season>=1950 && +season<=new Date().getUTCFullYear()+1) query.set('season',season);
 if(typeof params.round==='string' && /^\d{1,2}$/.test(params.round) && +params.round>0 && +params.round<=30)query.set('round',params.round);
 if(typeof params.session==='string') {
  if(/^(fp[123]|qualifying|sprint_qualifying|sprint|race)$/i.test(params.session))query.set('session',params.session.toLowerCase());
  else if(/^[a-zA-Z0-9_-]{1,40}$/.test(params.session))query.set('legacySession',params.session);
 }
 return '/live'+(query.size?'?'+query.toString():'');
}
