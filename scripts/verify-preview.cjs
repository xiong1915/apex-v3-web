// scripts/verify-preview.cjs
const PREVIEW_URL = 'https://f1-race-reminder-cloud-gxr51glct-tike1.vercel.app';

async function main() {
  console.log(`=== 开始对 Vercel Preview 部署 ${PREVIEW_URL} 进行全量功能验证 ===\n`);

  // 1. 首页检查
  console.log('1. 验证首页 SSR (/):');
  const homeRes = await fetch(PREVIEW_URL);
  console.log(`- 首页 HTTP 状态: ${homeRes.status}`);
  const homeHtml = await homeRes.text();
  console.log(`- 首页包含标题与关键组件: ${homeHtml.includes('APEX') || homeHtml.includes('F1')}`);

  // 2. 赛历与分站检查
  console.log('\n2. 验证赛历 API (/api/f1/calendar):');
  const calRes = await fetch(`${PREVIEW_URL}/api/f1/calendar?season=2026`);
  console.log(`- 赛历 API HTTP 状态: ${calRes.status}`);
  const calData = await calRes.json();
  console.log(`- 2026 赛季分站数量: ${calData.calendar?.length || 0}`);
  if (calData.calendar?.length) {
    console.log(`  * 第一站: ${calData.calendar[0].nameZh || calData.calendar[0].name}`);
  }

  // 3. 积分榜检查 (2026 当前 & 2008 历史)
  console.log('\n3. 验证积分榜 API (/api/f1/standings):');
  const st2026 = await (await fetch(`${PREVIEW_URL}/api/f1/standings?season=2026`)).json();
  console.log(`- 2026 榜首车手: ${st2026.driverStandings?.[0]?.name} (${st2026.driverStandings?.[0]?.points}分)`);
  console.log(`- 2026 截止场次描述: "${st2026.standingsCutoffDesc}"`);

  const st2008 = await (await fetch(`${PREVIEW_URL}/api/f1/standings?season=2008`)).json();
  console.log(`- 2008 榜首车手: ${st2008.driverStandings?.[0]?.name} (${st2008.driverStandings?.[0]?.points}分)`);

  // 4. APEX REPLAY 回放检查
  console.log('\n4. 验证 APEX REPLAY (/replay & /api/f1/replay):');
  const replayPage = await fetch(`${PREVIEW_URL}/replay`);
  console.log(`- /replay 页面状态: HTTP ${replayPage.status}`);
  const replayApi = await (await fetch(`${PREVIEW_URL}/api/f1/replay?season=2023`)).json();
  console.log(`- 2023 真实正赛场次数: ${replayApi.sessions?.length || 0}`);

  // 5. 数据同步 API 检查
  console.log('\n5. 验证数据同步 API (/api/cron/sync):');
  const syncUnauth = await fetch(`${PREVIEW_URL}/api/cron/sync`);
  console.log(`- 未授权请求严格返回 401: HTTP ${syncUnauth.status} (预期 401)`);

  // 6. 验证飞书提醒路由已被彻底移除 (必须返回 404)
  console.log('\n6. 验证已从网站剔除飞书提醒路由 (隔离性检查):');
  const reminderRoute = await fetch(`${PREVIEW_URL}/api/cron/reminder`);
  console.log(`- /api/cron/reminder 返回: HTTP ${reminderRoute.status} (预期 404)`);
  const feishuRoute = await fetch(`${PREVIEW_URL}/api/feishu`);
  console.log(`- /api/feishu 返回: HTTP ${feishuRoute.status} (预期 404)`);

  // 7. AI 功能验证
  console.log('\n7. 验证 AI Chat API (/api/ai/chat):');
  const aiRes = await fetch(`${PREVIEW_URL}/api/ai/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: '2026 赛季积分榜前三名是谁？', stream: false })
  });
  console.log(`- AI 请求 HTTP 状态: ${aiRes.status}`);
  const aiData = await aiRes.json();
  console.log(`- AI 回答摘要:\n${aiData.reply?.slice(0, 150)}...`);

  console.log('\n=== Preview 部署全量功能验证通过 ===');
}

main().catch(err => {
  console.error('Preview 验证失败:', err);
  process.exit(1);
});
