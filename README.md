# APEX V3 — Formula 1 Data + Intelligence Platform

APEX V3 (`xiong1915/apex-v3-web`) 是专为 F1 车迷打造的赛事赛程、计时状态与赛事分析平台。

## 🌟 核心特性

- **F1 赛历与全赛程动态追踪**：完整收录 1950–2026 赛季赛程、练习赛、排位赛、冲刺赛及正赛官方赛历与倒计时。
- **世界锦标赛双积分榜**：车手与车队实时积分榜，支持多赛季分页回溯查询，历史积分与正赛结算严格对齐。
- **APEX LIVE TIMING 实时赛事中心**：`/live` 提供真实赛程、北京时间倒计时和已收录成绩；完整实时计时受来源与公开展示许可控制，当前不向访客转发完整计时流。旧 `/replay` 重定向至 `/live`。
- **DeepSeek AI 赛况智库**：融合官方结构化赛事事实快照、指定 URL 原文精准直读与多源检索的高可信度 AI 对话控制台。
- **赛后自动静默数据同步**：由 `/api/cron/sync` 驱动的权威数据源增量更新机制，杜绝脏缓存与虚假历史。

## 🛠️ 技术栈

- **框架**：Next.js 16 (App Router + Turbopack)
- **运行时**：React 19 / Node.js 24
- **样式**：Liquid Glass Design System (CSS Variables + 移动端自适应降级)
- **数据源**：Jolpica-F1 (Ergast API 现代化继承者) / OpenF1 遥测 API / F1 官方赛程
- **存储与缓存**：Upstash Redis Free REST + 内存安全降级
- **部署平台**：Vercel Production Edge

## 🚀 本地开发与质量门禁

```bash
# 启动开发服务器
npm run dev

# 类型检查
npm run typecheck

# 单元与集成测试
npm test

# 全量质量门禁 (规范文案检查 + 日期防退化 + 类型检查 + 自动化测试 + 生产构建)
npm run quality
```

V3.3 的来源核验、权限边界、连接机制与免费额度见 [LIVE TIMING 运行说明](docs/live-timing.md)。
