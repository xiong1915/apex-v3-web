import type { AIMessage } from './types';
import type { ChatTurn } from './conversation-types';
/** JSON object key order may change during schema validation; it is not a content change. */
export function chatFingerprint(messages: ChatTurn[]): string {
 const canonical = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([key, v]) => [key, canonical(v)]));
  return value;
 };
 return JSON.stringify(canonical(messages));
}
/** Keep saved history intact; only the model context uses the existing request budget. */
export function buildChatContext(messages: Pick<AIMessage, 'role' | 'content'>[]): AIMessage[] {
 const selected: AIMessage[] = [];
 let budget = 4000;
 for (const message of [...messages].reverse()) {
  if (selected.length >= 20 || budget <= 0) break;
  if (!message.content.trim()) continue;
  const content = message.content.slice(-Math.min(1000, budget));
  selected.unshift({ role: message.role, content });
  budget -= content.length;
 }
 return selected;
}
