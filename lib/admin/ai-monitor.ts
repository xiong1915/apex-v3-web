import { Redis } from '@upstash/redis';
export type AIOutcome = 'success' | 'error' | 'timeout' | 'cancelled';
export interface AIMonitorEvent { outcome: AIOutcome; durationMs: number; at: string }
type Counts = Record<AIOutcome, number> & { durationMs: number };
export interface MonitorSnapshot { totals: Counts; days: Record<string, Counts>; events: AIMonitorEvent[]; firstRecordedAt?: string }
const counts = (): Counts => ({ success: 0, error: 0, timeout: 0, cancelled: 0, durationMs: 0 });
const empty = (): MonitorSnapshot => ({ totals: counts(), days: {}, events: [] });
const dayKey = (time: string) => new Date(Date.parse(time) + 8 * 3600000).toISOString().slice(0, 10);
export class MemoryAIMonitor {
 private snapshot = empty();
 async record(event: AIMonitorEvent) {
  const state = this.snapshot, day = dayKey(event.at);
  state.firstRecordedAt ||= event.at;
  state.days[day] ||= counts();
  for (const counter of [state.totals, state.days[day]]) { counter[event.outcome]++; counter.durationMs += event.durationMs; }
  state.events.unshift(event); state.events = state.events.slice(0, 30);
  const cutoff = dayKey(new Date(Date.parse(event.at) - 6 * 86400000).toISOString());
  for (const key of Object.keys(state.days)) if (key < cutoff) delete state.days[key];
 }
 async read() { return structuredClone(this.snapshot); }
}
class RedisAIMonitor {
 constructor(private redis: Redis) {}
 async record(event: AIMonitorEvent) {
  const cutoff = dayKey(new Date(Date.parse(event.at) - 6 * 86400000).toISOString());
  await this.redis.eval(`
   local raw = redis.call('GET', KEYS[1])
   local state = raw and cjson.decode(raw) or cjson.decode(ARGV[1])
   local event = cjson.decode(ARGV[2])
   local day = ARGV[3]
   if not state.firstRecordedAt then state.firstRecordedAt = event.at end
   if not state.days[day] then state.days[day] = {success=0,error=0,timeout=0,cancelled=0,durationMs=0} end
   state.totals[event.outcome] = state.totals[event.outcome] + 1
   state.totals.durationMs = state.totals.durationMs + event.durationMs
   state.days[day][event.outcome] = state.days[day][event.outcome] + 1
   state.days[day].durationMs = state.days[day].durationMs + event.durationMs
   table.insert(state.events, 1, event)
   while #state.events > 30 do table.remove(state.events) end
   for key in pairs(state.days) do if key < ARGV[4] then state.days[key] = nil end end
   redis.call('SET', KEYS[1], cjson.encode(state))
   return 1`, ['apex:ai-monitor:v1'], [JSON.stringify(empty()), JSON.stringify(event), dayKey(event.at), cutoff]);
 }
 async read() { return await this.redis.get<MonitorSnapshot>('apex:ai-monitor:v1') || empty(); }
}
let monitor: MemoryAIMonitor | RedisAIMonitor;
function getMonitor() {
 if (monitor) return monitor;
 const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
 const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
 monitor = url && token && process.env.STORAGE_PROVIDER !== 'memory' ? new RedisAIMonitor(new Redis({ url, token })) : new MemoryAIMonitor();
 return monitor;
}
export function providerConfiguration(env: Record<string, string | undefined> = process.env) {
 const requested = (env.AI_PROVIDER || 'deepseek').toLowerCase();
 const provider = ['deepseek', 'openai-compatible', 'custom'].includes(requested) ? requested : 'deepseek';
 const isConfigured = Boolean(provider === 'deepseek' ? env.DEEPSEEK_API_KEY : provider === 'custom' ? env.CUSTOM_AI_API_KEY || env.AI_API_KEY : env.AI_API_KEY);
 const rawModel = provider === 'deepseek' ? env.DEEPSEEK_MODEL || 'deepseek-chat' : provider === 'custom' ? env.CUSTOM_AI_MODEL || 'custom-model' : env.AI_MODEL || 'gpt-4o-mini';
 // Only display model labels, never endpoint URLs or credential-shaped values.
 const model = /^[a-zA-Z0-9._:/-]{1,100}$/.test(rawModel) && !/https?:|sk-|key|token|secret/i.test(rawModel) ? rawModel : '自定义模型';
 return { provider, isConfigured, model };
}
export function summarizeMonitor(snapshot: MonitorSnapshot, now = new Date().toISOString()) {
 const totals = snapshot.totals;
 const finished = totals.success + totals.error + totals.timeout + totals.cancelled;
 const attempted = finished - totals.cancelled;
 const days = Array.from({ length: 7 }, (_, index) => {
  const day = dayKey(new Date(Date.parse(now) - (6 - index) * 86400000).toISOString());
  const values = snapshot.days[day] || counts();
  return { day, ...values, total: values.success + values.error + values.timeout + values.cancelled };
 });
 return { totals, finished, successRate: attempted ? Math.round(totals.success / attempted * 1000) / 10 : null, averageDurationMs: finished ? Math.round(totals.durationMs / finished) : null, days, events: Array.isArray(snapshot.events) ? snapshot.events : [], firstRecordedAt: snapshot.firstRecordedAt };
}
export async function recordAIOutcome(outcome: AIOutcome, startedAt: number) {
 try { await getMonitor().record({ outcome, durationMs: Math.max(0, Math.min(120000, Date.now() - startedAt)), at: new Date().toISOString() }); }
 catch { /* Observability must never break a conversation or disclose its content. */ }
}
export async function readAIMonitor() {
 try { return { available: true, persistent: getMonitor() instanceof RedisAIMonitor, ...summarizeMonitor(await getMonitor().read()), checkedAt: new Date().toISOString() }; }
 catch { return { available: false, checkedAt: new Date().toISOString() }; }
}
