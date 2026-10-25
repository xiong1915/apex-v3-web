import {OFFICIAL_LIVE_TIMING_URL} from './links';
/** Public redistribution is denied until a reviewed data grant is implemented.
 * No environment variable, request header, URL, stored snapshot or auth token can enable it.
 */
export const LIVE_PUBLIC_POLICY = Object.freeze({
 timingPublic: false,
 source: 'Canonical F1 · Jolpica',
 officialUrl: OFFICIAL_LIVE_TIMING_URL,
 reason: '完整实时计时尚未取得本站公开展示授权。这里提供真实赛程与已收录成绩；实时圈速请前往 F1 官方计时。'
});
export const PUBLIC_LIVE_CHANNELS = Object.freeze([
 'TimingData', 'TimingStats', 'TimingAppData', 'DriverList', 'SessionInfo',
 'SessionData', 'TrackStatus', 'RaceControlMessages', 'LapCount', 'WeatherData'
].map(name => {
 const incremental=['TimingData','TimingAppData','RaceControlMessages','LapCount','WeatherData'].includes(name);
 const messages=['TimingStats','DriverList','SessionData'].includes(name);
 return Object.freeze({name,status:incremental?'incremental-observed':messages?'messages-observed':'snapshot-only',note:`美国站2026-10-25观测：${incremental?'收到业务增量':messages?'收到后续消息，业务投影无变化':'仅收到初始快照'}；尚未取得公开再分发授权`});
}));