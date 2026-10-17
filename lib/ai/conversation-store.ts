import { Redis } from '@upstash/redis';
import { ConversationService, MemoryConversationStore, HistoryError } from './conversations';
import type { ConversationDocument, ConversationStore } from './conversations';

export class RedisConversationStore implements ConversationStore {
 constructor(private redis: Redis) {}
 read(key: string) { return this.redis.get<ConversationDocument>(key); }
 async compareAndSet(key: string, version: number, next: ConversationDocument) {
  const result = await this.redis.eval(`
   local raw = redis.call('GET', KEYS[1])
   local version = 0
   if raw then version = cjson.decode(raw).version end
   if version ~= tonumber(ARGV[1]) then return 0 end
   redis.call('SET', KEYS[1], ARGV[2])
   return 1`, [key], [version, JSON.stringify(next)]);
  return result === 1;
 }
}
let service: ConversationService | undefined;
export function getConversationService() {
 if (service) return service;
 const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
 const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
 if (url && token && process.env.STORAGE_PROVIDER !== 'memory') service = new ConversationService(new RedisConversationStore(new Redis({ url, token })));
 else if (process.env.NODE_ENV !== 'production') service = new ConversationService(new MemoryConversationStore());
 else throw new HistoryError('云端历史存储暂不可用，当前对话尚未保存', 503);
 return service;
}
