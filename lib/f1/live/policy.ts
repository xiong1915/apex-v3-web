/** Public redistribution is denied until a reviewed data grant is implemented.
 * No environment variable, request header, URL, stored snapshot or auth token can enable it.
 */
export const LIVE_PUBLIC_POLICY = Object.freeze({
 timingPublic: false,
 source: 'Canonical F1 · Jolpica',
 officialUrl: 'https://www.formula1.com/en/f1-live',
 reason: '完整实时计时尚未取得本站公开展示授权。这里提供真实赛程与已收录成绩；实时圈速请前往 F1 官方计时。'
});
export const PUBLIC_LIVE_CHANNELS = Object.freeze([
 'TimingData', 'TimingStats', 'TimingAppData', 'DriverList', 'SessionInfo',
 'SessionData', 'TrackStatus', 'RaceControlMessages', 'LapCount', 'WeatherData'
].map(name => Object.freeze({name, status: name === 'LapCount' ? 'not-observed' : 'snapshot-only', note: name === 'LapCount' ? '开发探测未收到此频道；尚未取得公开再分发授权' : '开发探测收到初始快照，非比赛时段未验证实时增量；尚未取得公开再分发授权'})));
