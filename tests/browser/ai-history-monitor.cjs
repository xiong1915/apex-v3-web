// Local-only UI acceptance; shares the real history service across browser contexts.
require('tsx/cjs');
const { ConversationService, MemoryConversationStore } = require('../../lib/ai/conversations.ts');
const { MemoryAIMonitor, summarizeMonitor } = require('../../lib/admin/ai-monitor.ts');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const base = process.env.QA_BASE_URL || 'http://127.0.0.1:3100';
if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(base)) throw Error('Localhost required');
const out = process.env.QA_ARTIFACT_DIR || require('node:os').tmpdir();
const service = new ConversationService(new MemoryConversationStore());
let failWrites = false, modelFailure = false, modelContext = [], aiReads = 0;
const errors = [];
const monitor = new MemoryAIMonitor();
async function fixtures(context, owner = 'test-owner') {
 await context.route('**/api/auth/session', r => r.fulfill({ json: { user: { id: owner, email: 'test@example.invalid' }, session: null } }));
 await context.route('**/api/ai/conversations*', async r => {
  const req = r.request(), id = new URL(req.url()).searchParams.get('id');
  const method = req.method(), body = method === 'GET' ? {} : req.postDataJSON();
  if (failWrites && method !== 'GET') return r.fulfill({ status: 503, json: { error: '本地验收：云端保存失败，当前内容尚未保存' } });
  try {
   let json;
   if (method === 'GET') json = id ? { conversation: await service.read(owner, id) } : { conversations: await service.list(owner) };
   if (method === 'POST') json = { conversation: await service.create(owner, body.messages) };
   if (method === 'PUT') json = { conversation: await service.update(owner, id, body) };
   if (method === 'DELETE') { await service.remove(owner, id, body.revision); json = { deleted: true }; }
   return r.fulfill({ status: method === 'POST' ? 201 : 200, json });
  } catch (e) { return r.fulfill({ status: e.status || 400, json: { error: e.message } }); }
 });
 await context.route('**/api/ai/chat', r => {
  if (modelFailure) return r.fulfill({ status: 503, json: { error: 'local model unavailable' } });
  modelContext = r.request().postDataJSON().messages;
  return r.fulfill({ contentType: 'text/event-stream', body: 'data: {"type":"delta","content":"本地验收：轮胎策略需要结合赛道。"}\n\ndata: {"type":"sources","sources":[{"name":"测试来源","url":"https://example.invalid/source"}]}\n\ndata: {"type":"done"}\n\n' });
 });
 await context.route('**/api/admin/**', async r => {
  assert.equal(r.request().method(), 'GET');
  const endpoint = new URL(r.request().url()).pathname;
  if (endpoint.endsWith('/ai')) {
   aiReads++;
   return r.fulfill({ json: { totalRequests: 24, rateLimitHits: 2, estimatedTokens: 12345, provider: 'deepseek', model: 'deepseek-chat', isConfigured: true, historyStorageConfigured: true, limits: { hourly: 600, perMinute: 15, requestTimeoutSeconds: 25 }, monitoring: { available: true, persistent: true, checkedAt: new Date().toISOString(), ...summarizeMonitor(await monitor.read()) } } });
  }
  return r.fulfill({ json: endpoint.endsWith('/status') ? { aal: 'aal2' } : { users: [], total: 0, f1: {}, health: {} } });
 });
}
(async () => {
 for (const outcome of ['success', 'success', 'error', 'timeout', 'cancelled']) await monitor.record({ outcome, durationMs: 1234, at: new Date().toISOString() });
 const browser = await chromium.launch({ headless: true, channel: 'chrome' });
 try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } }); await fixtures(context);
  const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message)); page.on('dialog', d => d.accept());
  const saved = () => page.getByText('已保存到云端 · AI 参考最近的对话上下文').waitFor();
  const ask = async text => { const input = page.getByRole('textbox', { name: '向 APEX AI 提问' }); await input.fill(text); await input.press('Enter'); await page.getByText('本地验收：轮胎策略需要结合赛道。', { exact: true }).waitFor(); await saved(); };
  await page.goto(base + '/ai'); await page.locator('.history-footer button').waitFor({ state: 'visible' });
  await page.waitForFunction(() => !document.querySelector('.history-footer button').disabled);
  await ask('如何理解轮胎策略？');
  assert.equal((await service.list('test-owner')).length, 1);
  await page.reload(); await page.getByRole('button', { name: /如何理解轮胎策略？.*条/ }).click();
  await page.getByText('本地验收：轮胎策略需要结合赛道。', { exact: true }).waitFor();
  await page.getByRole('button', { name: '重命名 如何理解轮胎策略？', exact: true }).click();
  await page.getByRole('textbox', { name: '对话名称' }).fill('我的轮胎策略'); await page.getByRole('button', { name: '保存名称' }).click();
  await page.getByRole('button', { name: /我的轮胎策略.*条/ }).waitFor();
  const device = await browser.newContext({ viewport: { width: 1440, height: 1000 } }); await fixtures(device);
  const other = await device.newPage(); await other.goto(base + '/ai'); await other.getByRole('button', { name: /我的轮胎策略.*条/ }).click(); await other.getByText('本地验收：轮胎策略需要结合赛道。', { exact: true }).waitFor(); await device.close();
  await page.locator('.conversation-sidebar').getByRole('button', { name: /新建对话/ }).click(); await ask('积分榜如何计算？');
  await page.getByRole('button', { name: '删除 我的轮胎策略', exact: true }).click(); await page.getByRole('button', { name: '删除 我的轮胎策略', exact: true }).waitFor({ state: 'detached' });
  assert.equal((await service.list('test-owner')).length, 1);
  await page.screenshot({ path: path.join(out, 'ai-history-1440.png') });
  modelFailure = true;
  await page.getByRole('textbox', { name: '向 APEX AI 提问' }).fill('本地验收：模型失败后的新对话');
  await page.getByRole('textbox', { name: '向 APEX AI 提问' }).press('Enter');
  await page.getByRole('button', { name: '重试', exact: true }).waitFor();
  await page.locator('.conversation-sidebar').getByRole('button', { name: /新建对话/ }).click();
  await page.getByRole('heading', { name: '今天想了解哪场比赛？', exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: '重试', exact: true }).count(), 0, 'new conversation must clear previous model error');
  modelFailure = false;
  const history = Array.from({ length: 70 }, (_, i) => ({ id: 'old-' + i, role: i % 2 ? 'assistant' : 'user', content: 'x'.repeat(1100), status: 'completed' }));
  const long = await service.create('test-owner', history); await page.getByRole('button', { name: '刷新列表', exact: true }).click();
  await page.locator('.history-select').filter({ hasText: long.title }).click(); await ask('这是最新的问题');
  assert.ok(modelContext.length <= 20); assert.ok(modelContext.reduce((sum, item) => sum + item.content.length, 0) <= 4000); assert.equal(modelContext.at(-1).content, '这是最新的问题');
  failWrites = true;
  const input = page.getByRole('textbox', { name: '向 APEX AI 提问' }); await input.fill('云端故障时保留我的输入'); await input.press('Enter');
  await page.getByText('本地验收：云端保存失败，当前内容尚未保存').waitFor();
  await page.screenshot({ path: path.join(out, 'ai-history-save-error.png') });
  await page.locator('.conversation-sidebar').getByRole('button', { name: /新建对话/ }).click();
  assert.ok(await page.getByText('云端故障时保留我的输入', { exact: true }).count());
  failWrites = false; await page.getByRole('button', { name: '重试保存', exact: true }).click(); await saved();
  for (const width of [375, 390, 768, 900, 1024, 1440, 1920]) { await page.setViewportSize({ width, height: 900 }); assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)); }
  await page.setViewportSize({ width: 390, height: 844 }); await page.getByRole('button', { name: '历史对话', exact: true }).click();
  assert.equal(await page.locator('.ai-chat-console').evaluate(e => e.inert), true); await page.screenshot({ path: path.join(out, 'ai-history-390.png') }); await page.keyboard.press('Escape'); assert.equal(await page.locator('.ai-chat-console').evaluate(e => e.inert), false);
  await page.setViewportSize({ width: 1440, height: 1000 }); await page.goto(base + '/admin'); await page.getByRole('button', { name: 'AI 监控与用量', exact: true }).click(); await page.getByRole('heading', { name: '看清每一次请求' }).waitFor();
  const reads = aiReads; await page.getByRole('button', { name: '刷新 AI 数据', exact: true }).click(); await page.waitForFunction(() => !document.querySelector('.monitor-actions button').disabled); assert.ok(aiReads > reads);
  await page.getByRole('checkbox', { name: '只看异常与超时' }).check(); assert.equal(await page.locator('.monitor-events li').count(), 2);
  const download = page.waitForEvent('download'); await page.getByRole('button', { name: '导出监控摘要' }).click(); await (await download).saveAs(path.join(out, 'ai-monitor-local-fixture.json'));
  for (const width of [375, 390, 768, 900, 1024, 1440, 1920]) { await page.setViewportSize({ width, height: 1000 }); assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)); if ([390, 1440].includes(width)) await page.screenshot({ path: path.join(out, `admin-ai-monitor-${width}.png`) }); }
  await page.clock.install();
  await page.getByRole('checkbox', { name: '每 30 秒刷新' }).check();
  const automaticRead = page.waitForResponse(response => response.url().endsWith('/api/admin/ai') && response.status() === 200);
  await page.clock.fastForward(31000); await automaticRead;
  await page.getByRole('checkbox', { name: '每 30 秒刷新' }).uncheck();
  const conflict = await service.create('conflict-owner', [{ id: 'm1', role: 'user', content: '跨设备测试', status: 'completed' }]);
  const conflictingContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } }); await fixtures(conflictingContext, 'conflict-owner');
  const c = await conflictingContext.newPage(); await c.goto(base + '/ai'); await c.getByRole('button', { name: /跨设备测试.*条/ }).click();
  await service.update('conflict-owner', conflict.id, { revision: conflict.revision, title: '另一设备已更新' });
  await c.getByRole('textbox', { name: '向 APEX AI 提问' }).fill('保留本窗口未保存的更改'); await c.getByRole('textbox', { name: '向 APEX AI 提问' }).press('Enter');
  await c.getByText('另一个窗口已更新这段对话，请重新打开后继续').waitFor();
  await c.getByRole('button', { name: '刷新列表', exact: true }).click();
  await c.getByRole('button', { name: /另一设备已更新.*条/ }).waitFor();
  assert.equal(await c.getByText('另一个窗口已更新这段对话，请重新打开后继续').isVisible(), true);
  await c.getByRole('button', { name: '另存为新对话', exact: true }).click(); await c.getByText('已保存到云端 · AI 参考最近的对话上下文').waitFor();
  assert.equal((await service.list('conflict-owner')).length, 2); await conflictingContext.close();
  for (let i = 0; i < 30; i++) await service.create('full-owner', [{ id: 'm' + i, role: 'user', content: `已有历史 ${i}`, status: 'completed' }]);
  const fullContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } }); await fixtures(fullContext, 'full-owner');
  const full = await fullContext.newPage(); full.on('dialog', d => d.accept()); await full.goto(base + '/ai');
  await full.waitForFunction(() => document.querySelector('.history-footer button') && !document.querySelector('.history-footer button').disabled);
  await full.getByRole('textbox', { name: '向 APEX AI 提问' }).fill('容量已满仍保留本次内容'); await full.getByRole('textbox', { name: '向 APEX AI 提问' }).press('Enter');
  await full.getByText('最多保存 30 段对话，请先删除不需要的记录').waitFor();
  await full.getByText('本地验收：轮胎策略需要结合赛道。', { exact: true }).waitFor();
  await full.locator('.history-item-actions button[aria-label^="删除"]').first().click();
  await full.waitForFunction(() => document.querySelectorAll('.history-item').length === 29);
  await full.getByRole('button', { name: '重试保存', exact: true }).click(); await full.getByText('已保存到云端 · AI 参考最近的对话上下文').waitFor();
  assert.equal((await service.list('full-owner')).length, 30); await fullContext.close();
  assert.deepEqual(errors, []);
  console.log('PASS: history CRUD/reload/cross-context/save failure/long context/mobile keyboard; AI monitor filters/refresh/export; seven viewport widths; no browser errors');
 } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
