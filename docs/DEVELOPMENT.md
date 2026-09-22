# 本地开发与部署指南

更新日期：2026-09-15。当前版本已经实现白名单登录、GitHub 绑定、周度贡献、GLM 预检查、Admin 审核、首次仓库 EC 登记与 PR 状态同步。奖励领取和主网支付保持关闭。

## 1. 技术栈

| 层 | 实现 |
|---|---|
| Web | React 19、Next.js 16 App Router、TypeScript |
| API | Next.js Route Handlers |
| 数据 | PostgreSQL、Prisma 7、`@prisma/adapter-pg` |
| 后台任务 | PostgreSQL Job、90 秒租约、`SKIP LOCKED`、命令行 Worker／Vercel Cron |
| AI | GLM OpenAI 兼容 Chat Completions 接口，结构化 JSON 结果 |
| 外部服务 | GitHub OAuth、GitHub REST API、Electric Capital Open Dev Data PR |
| 检查 | ESLint、Prettier、TypeScript、Node test runner、GitHub Actions |

Node.js 要求 22.12 以上且低于 25，建议使用 `.nvmrc` 指定的版本。

## 2. 本地启动

仅预览页面时可使用 demo 模式：

```bash
cp .env.example .env
npm ci
npm run dev
```

访问 `http://127.0.0.1:3000`。已有 `.env` 时不要覆盖。demo 数据仅用于界面预览，不会授予真实登录、审核或外部写入权限。

完整功能使用 PostgreSQL：

```bash
docker compose up -d postgres
npm run db:deploy
npm run db:seed
npm run dev
```

本地核心配置示例：

```dotenv
APP_ENV=development
DATA_MODE=database
KITE_NETWORK=testnet
EC_PROVIDER_MODE=mock
CLAIMS_ENABLED=false
DATABASE_URL=postgresql://kite:kite_local_only@127.0.0.1:5434/kite_bounty?schema=public
APP_ORIGIN=http://127.0.0.1:3000

GITHUB_OAUTH_CLIENT_ID=开发 OAuth App Client ID
GITHUB_OAUTH_CLIENT_SECRET=开发 OAuth App Client Secret

GLM_API_KEY=智谱 API Key
GLM_BASE_URL=https://open.bigmodel.cn/api/paas/v4
GLM_MODEL=glm-4-flash

GITHUB_READ_TOKEN=可选的 GitHub 只读 Token
GITHUB_EC_TOKEN=EC 运营 GitHub Token
EC_FORK_OWNER=Anyi-zheng
EC_FORK_REPOSITORY=open-dev-data
EC_UPSTREAM_OWNER=electric-capital
EC_UPSTREAM_REPOSITORY=open-dev-data

CRON_SECRET=至少16位随机字符串
ADMIN_WALLET_ALLOWLIST=初始管理员钱包，可留空并使用数据库中的现有管理员
```

`GITHUB_READ_TOKEN` 未配置时会复用 `GITHUB_EC_TOKEN`。密钥只放在 `.env` 或 Vercel 环境变量，不提交到 Git。

GitHub OAuth App 的 Homepage URL 必须与 `APP_ORIGIN` 完全一致，Authorization callback URL 为：

```text
APP_ORIGIN/api/auth/github/callback
```

## 3. 当前业务流程

1. 白名单钱包签名登录并绑定唯一 GitHub 身份。
2. 参与者提交当前周一个公开仓库中的一条或多条 Commit 链接。
3. API 校验作者、Bot、Merge Commit、代码变更、统计周、仓库状态和 SHA 重复使用。
4. 系统创建 `ai.analyze_submission`；参与者页面轮询并展示 GLM 建议。
5. 首次仓库使用 `REPOSITORY` 范围，读取 README、文件树、依赖清单和 Commit，并生成 EC PR 草稿；已登记或正在登记的仓库使用 `COMMIT` 范围，只检查本周代码。
6. Admin 查看代码证据和 AI 结果，决定通过或退回。GLM 有风险提示时 Admin 仍保留最终决定权。
7. 审核通过后，已登记仓库直接产生该周完成记录；未登记仓库才创建 EC migration 和 PR。
8. `ec.sync_batch` 轮询 PR。只有 PR 已合并并且 EC 上游数据仍包含该仓库的 KiteAI 归属，系统才创建 `VERIFIED` 登记并回填已通过的周度贡献。

EC PR 被创建不等于参与者已经计入 Electric Capital；最终归属和开发者统计由 EC 的上游数据与统计规则决定。完整规则见 [EC 活跃开发者计入规则](EC_ACTIVE_DEVELOPER_RULES.md)。

## 4. Worker 与 Vercel Cron

本地可以运行单次或常驻 Worker：

```bash
npm run worker:check
npm run worker:once
npm run worker
```

已注册任务类型：

| 类型 | 用途 |
|---|---|
| `system.ping` | 队列健康测试 |
| `ai.analyze_submission` | GLM 仓库或 Commit 预检查 |
| `ec.register_submission` | 查重并登记首次仓库，或完成已登记仓库的周记录 |
| `ec.sync_batch` | 同步 EC PR 并验证上游归属 |
| `payment.send` | 仅保留开发支付适配器；生产领取未开放 |

Vercel 部署使用 `vercel.json` 每分钟请求 `/api/cron/worker`。该路由要求：

```http
Authorization: Bearer <CRON_SECRET>
```

一次请求只领取一个任务，任务租约为 120 秒，避免慢速 GitHub 或 AI 调用拖垮同一次 Serverless 执行。Vercel 中必须配置同一个 `CRON_SECRET`；没有该变量时路由固定返回 401。管理员页面会显示到期、运行中、失败和最老等待时间，并提供一次处理一个任务的手动兜底入口。

## 5. 页面和接口

| 页面 | 当前能力 |
|---|---|
| `/` | 公开活动和参与进度 |
| `/directions` | 六类官方贡献方向和验收要求 |
| `/dashboard` | 当前参与者身份、绑定和周进度 |
| `/submissions/current` | 本周 Commit 提交、当前状态和 AI 结果 |
| `/admin` | 白名单、管理员、审核列表、AI 预检查和重跑 |
| `/admin/ec-batches` | EC 登记批次、PR 链接和状态 |
| `/rewards` | 奖励状态预览；领取仍关闭 |

关键 API：

| 接口 | 能力 |
|---|---|
| `GET/POST /api/submissions` | 当前周状态／提交或退回后重提 |
| `GET/POST /api/admin/submissions` | Admin 审核队列／通过或退回 |
| `POST /api/admin/submissions/:id/analyze` | 重新执行最新版本 AI 检查 |
| `GET /api/admin/ec-batches` | EC 批次和 PR 状态 |
| `GET /api/cron/worker` | 受密钥保护的后台任务入口 |
| `GET /api/health/ready` | 数据库就绪检查 |

## 6. 数据库迁移

首次连接数据库或拉取新迁移后运行：

```bash
npm run db:deploy
npm run db:seed
```

`202609150001_ai_pre_review` 为 `SubmissionRevision` 增加 AI 状态、结论和 PR 草稿字段，并为贡献 SHA 增加查询索引。生产环境部署前必须对目标 `DATABASE_URL` 执行 `npm run db:deploy`；Prisma 不会因为 Vercel 已连接数据库就自动创建新表或列。

## 7. 本地检查

完整静态和构建检查：

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

数据库集成测试只允许数据库名以 `_test` 结尾：

```bash
export DATABASE_URL='postgresql://kite:kite_local_only@127.0.0.1:5434/kite_bounty_test?schema=public'
npm run db:deploy
npm run db:seed
npm run test:db
```

测试覆盖数据库唯一约束、并发任务领取、过期租约、未知任务失败，以及 AI Worker 结果持久化。EC 单元测试覆盖 AI PR 草稿传入、PR 状态同步和 migration 添加／移除判断。

无需写数据库即可对公开 Commit 运行一次真实 GLM 检查：

```bash
npm run ai:check -- https://github.com/owner/repository/commit/full-sha
```

该命令会调用 GitHub 与 GLM，输出结构化建议，不会创建 EC PR，也不会修改贡献记录。

## 8. Vercel 上线配置

Vercel 至少需要：

- `APP_ENV=production`
- `DATA_MODE=database`
- `KITE_NETWORK=mainnet`
- `EC_PROVIDER_MODE=live`
- `CLAIMS_ENABLED=false`
- `DATABASE_URL`
- `APP_ORIGIN=https://实际域名`
- GitHub OAuth 两项配置
- EC fork、上游和 Token 配置
- `GLM_API_KEY`
- `CRON_SECRET`

设置完成后对生产数据库执行迁移，再重新部署。当前代码会拒绝 production 使用 demo、测试网或 mock EC。奖励支付没有完成安全验收，必须保持 `CLAIMS_ENABLED=false`。

真实 EC 合并由外部维护者控制。本地测试已经验证内部状态机和受控合并场景；现有真实 PR 被 EC 合并或关闭后，还需要核对一次线上 Cron、GitHub Token 权限、上游搜索和最终 `WeeklyCompletion` 回填。
