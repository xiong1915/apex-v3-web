import test from 'node:test';
import assert from 'node:assert/strict';
import { MemoryAIMonitor, summarizeMonitor, providerConfiguration } from '../lib/admin/ai-monitor';
test('monitor records real outcomes, daily counts and latency without chat/user content', async () => {
 const monitor = new MemoryAIMonitor();
 await Promise.all(Array.from({ length: 20 }, (_, i) => monitor.record({ outcome: i % 2 ? 'success' : 'error', durationMs: 100 + i, at: '2026-10-17T04:00:00Z' })));
 await monitor.record({ outcome: 'cancelled', durationMs: 50, at: '2026-10-17T04:01:00Z' });
 const snapshot = await monitor.read();
 const summary = summarizeMonitor(snapshot, '2026-10-17T05:00:00Z');
 assert.equal(summary.totals.success, 10); assert.equal(summary.totals.error, 10);
 assert.equal(summary.totals.cancelled, 1); assert.equal(summary.successRate, 50);
 assert.equal(summary.days.length, 7); assert.equal(summary.days.at(-1)?.total, 21);
 assert.equal(summary.events.length, 21);
 assert.doesNotMatch(JSON.stringify(summary), /prompt|userId|email|messages|content/);
});
test('provider configuration only exposes safe names and booleans', () => {
 const config = providerConfiguration({ AI_PROVIDER: 'openai-compatible', AI_API_KEY: 'private-key', AI_MODEL: 'model-a' });
 assert.equal(config.isConfigured, true); assert.equal(config.model, 'model-a');
 assert.doesNotMatch(JSON.stringify(config), /private-key/);
 assert.equal(providerConfiguration({ AI_PROVIDER: 'deepseek' }).isConfigured, false);
});
