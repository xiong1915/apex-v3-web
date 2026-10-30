# APEX V3 Codex 项目规则

## 架构与保护边界

- 仓库：`xiong1915/apex-v3-web`，默认分支 main。Next.js App Router + React 19 + TypeScript；`app/` 路由和 API、`components/` UI、`lib/` 业务/存储、`providers/` F1 与 AI 接口、`public/circuits/` 赛道资源、`tests/` node:test + tsx。
- F1 数据由 Canonical Data Layer 统一规范，Jolpica/OpenF1/官方赛程 → Cache → LKG → Unavailable。禁止硬编码动态比赛事实或把缓存猜测当真实数据；全站复用 RaceStateService，内部 UTC ISO-8601，展示 Asia/Shanghai。
- `lib/auth/` 使用 Supabase，`lib/admin/` 与 `app/api/admin/` 涉及管理员权限和 MFA。生产环境禁止 mock auth，服务端验证身份与 AAL2；不得将 service role、管理员凭据或令牌放到 NEXT_PUBLIC_*。
- AI 使用现有 DeepSeek/provider 注册，保持事实优先、URL 安全和 AbortSignal 贯通；未经授权不启用收费回退。存储使用 Upstash Redis 或本地内存。
- Vercel `vercel.json` 的 `/api/cron/sync` 每日 01:00 UTC 同步；Cloudflare 根 `wrangler.toml` / `cf_worker.js` 为现有网站代理 feishu-f1-bot（历史名称，无提醒处理器），配置的上游是现有 f1-race-reminder-cloud.vercel.app。禁止改动生产路由或恢复提醒端点作为普通测试。
- 赛道按 season + circuitId + layoutId，保持许可与 SVG 清洗。界面沿用现有设计系统与移动端材质降级。

## Codex 开发与交付工作流

- 普通本地修改、依赖按锁文件安装、针对性测试和审查自主完成；先读 `git status --short`、当前分支和远程地址，保护已有修改。按任务最小改动，不顺手重构。
- Windows 使用 PowerShell 7。Node.js 24、npm 11.17.0；有 package-lock.json 时用 `npm ci --ignore-scripts`，不混用 pnpm 锁文件。无 lint 脚本，不臆造 `npm run lint`。
- 开发前核对 package.json、相关源码及适用的嵌套 AGENTS.md。行为修改先补能复现的测试，完成后运行相关测试与类型检查；跨模块或交付前运行 `npm run quality`，失败必须分类和如实报告，不删除断言或放宽门禁以求通过。
- 安全验证必须在不含 .env*、.vercel、.wrangler、生产缓存或生产凭据的临时检出中执行。只保留 PATH 等运行必需变量，清除继承的 Redis、飞书、AI、Supabase、CRON、Vercel、Cloudflare 等凭据；使用内存存储和测试桩。Next build 会自动读取 .env.local，禁止直接在含生产 .env.local 的目录构建或启动服务验证。不得把生产环境变量拉入 CI 或开发环境。
- `npm run dev` 只在隔离环境使用；按界面修改范围核验桌面/移动端、键盘及错误状态。静态源码断言或构建通过不能代替真实交互验收。
- 实质修改后按 `requesting-code-review` 做代码审查，检查 diff、调用方、回归风险与凭据边界；工具不可用时自行审查并明确未做独立审查。收到意见按 `receiving-code-review` 评估；完成前按 `verification-before-completion` 提供本次证据。仅在用户或适用规则明确授权时委派子代理。
- 复用会话已安装 Skills：React/Next.js 用 `vercel-react-best-practices`；界面设计用 `ui-ux-pro-max`，可访问性审查用 `web-design-guidelines`；行为修改用 `test-driven-development`；根因不明用 `systematic-debugging`；复杂跨模块任务才用 `using-superpowers` / `writing-plans`，需要隔离才用 `using-git-worktrees`。仅加载相关 SKILL.md，不新增依赖或复制全部技能。技能不可用应说明并采用等价检查。
- 提交前检查 `git diff --check` 和完整 diff，给出测试结果、变更范围、建议 commit 信息。git add 只暂存当前任务文件，无需重复确认；git commit 必须有用户明确授权，不能把“建立工作流”视为提交许可。
- 推送、创建远程 PR/评论、合并、触发/重跑远程 Actions、部署、真实提醒、修改 secrets/域名/定时器/线上数据都必须先确认。确认应说明准确仓库、分支、目标、影响和主要风险；一次明确授权覆盖同一范围，不反复确认。
- 经授权后采用功能分支 → 推送 → PR → Quality CI → 审查 → 经授权合并到 main → 现有部署链路。推送或 PR 本身可能触发 Vercel Preview；确认推送时必须说明。预览也不得接入生产写服务或发送真实提醒。
- `.github/workflows/quality.yml` 只运行无密钥检查和构建，不部署、不发消息、不写回 Git。不把质量 CI 通过宣称为 branch protection 已生效；远程必须另行核对 required checks 与部署集成。现有自动部署是否等待 CI 必须核实，不能假定先后顺序。
- 发布前重新核对 git SHA、Vercel 项目/团队、Git 集成仓库/生产分支、Cloudflare worker 与 routes。两个本地仓库的 .vercel/project.json 曾指向同一个 f1-race-reminder-cloud 项目；不能按目录名猜部署目标，不运行 vercel link、不重建/迁移服务。Vercel 关联文件只是本地证据，不能证明线上当前关联。
- 保留现有生产环境、域名、所有环境变量、飞书机制与免费基础设施边界。不得输出密钥或从历史会话/日志提取 token；禁止执行 `scripts/deploy_cf_worker.ps1`（旧脚本从历史日志提取凭据）。经明确部署授权后也只能使用正式登录/安全凭据通道与已核对的目标。
- 最终简洁说明改动、实际执行的检查、明确失败/未验证项。区分本地通过、远程 CI、部署成功、调度执行、供应商接受与用户收到。

## 检查选择与 Review guidelines

- 文案：`npm run check:copy`；日期：`npm run check:dates`；类型：`npm run typecheck`。
- 针对测试：`node ./node_modules/tsx/dist/cli.mjs --test tests/<name>.test.mjs`（或 .ts）；全量：`npm test`；交付门禁：`npm run quality`。
- 身份/权限改动优先检查 auth、admin、security-audit 测试；网关检查 gateway；赛事状态检查 race-state/date-rules；AI 与回放使用对应测试。按实际文件名选择，不运行 scripts 中的线上探测替代单元测试。
- 审查重点：未经鉴权的 admin API、MFA 降级、生产 mock、令牌泄露；历史结果/回放来源混淆；SSRF/流式取消丢失；缓存降级被描述为实时数据。发现必须给出具体触发条件和行号。

## 当前发布前待核实事项

- 网关已固定 upstream origin 后单独设置 pathname/search，并保留 socket-bearing 101 Response。保持 tests/gateway-security.test.mjs 与 tests/live-integration.test.ts；正式域名实际映射 feishu-f1-bot，独立 f1-reminder-worker 禁止改动。
- CI 中赛历、事实卡、赛果字段及引用编排测试使用 tests/fixtures/offline-service.mjs 与固定搜索输入；这是合成数据契约测试，不证明现实赛事数据。保留真实上游/线上交互的独立验收边界。其他回退测试仍可能进行无密钥公共网络读取；完整 quality 未通过时停止交付，不跳过测试或降低断言。
- 远程 required checks、Vercel Git 集成、Codex 自动审查是否启用需另行核实；AGENTS.md 与新增 CI 不会自动启用这些平台设置。
- 2026-10-16 只读检查：GitHub main 未配置经典分支保护，rulesets 列表为空；后续启用质量检查约束需明确授权。

- V3.3：/live 采用 lib/f1/live/policy.ts 的公开许可门控；当前只发布真实赛程、倒计时与已收录成绩。不得通过配置开关或缓存绕过门控，不得将离线状态机测试当真实直播验收。参见 docs/live-timing.md。

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
