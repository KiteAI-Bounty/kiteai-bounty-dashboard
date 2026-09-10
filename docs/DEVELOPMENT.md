# 本地开发与工程现状

更新日期：2026-09-10。当前交付包含可运行的工程框架及身份链路，不是完整 MVP。

## 1. 技术栈

| 层 | 已采用 |
|---|---|
| 前端 | React 19.2.8、Next.js 16.3.4 App Router、TypeScript |
| 样式 | 原生 CSS 设计变量与响应式布局、Lucide 图标；不依赖在线字体 |
| 后端 | Next.js Route Handlers；业务代码集中在 `src/modules` |
| 数据 | PostgreSQL、Prisma 7.10.0、`@prisma/adapter-pg` |
| 任务 | 独立 Node.js Worker、数据库租约和 `SKIP LOCKED` |
| 检查 | ESLint、Prettier、TypeScript、Node test runner；GitHub Actions 配置 |

Node.js 要求 22.12+，建议 `.nvmrc` 指定的 22 系列。Prisma 固定在稳定版，不跟随 `latest` 的 8.0 候选版。`deepmerge-ts` 与 `mysql2` 采用修复版本 overrides，升级 Prisma 后应检查是否可移除；当前安装、Prisma 生成、迁移、测试及构建均已验证。

## 2. 无数据库启动页面

```bash
cp .env.example .env
npm ci
npm run dev
```

访问 `http://127.0.0.1:3000`。已有 `.env` 时保留现有配置，不重复复制覆盖。

默认 `APP_ENV=development`、`DATA_MODE=demo`，不连接数据库。页面演示时钟固定在北京时间 2026-09-30，所有钱包和提交记录均为虚构样例。该时钟仅用于演示，数据库模式使用服务端真实时间。

| 路由 | 当前能力 |
|---|---|
| `/` | 活动首页、公开名单、月份及钱包筛选、钱包复制、外部资料链接 |
| `/dashboard` | demo 展示样例；database 展示当前钱包、GitHub 和真实周进度 |
| `/submissions/current` | 登录及 GitHub 绑定状态检查；提交写入仍禁用 |
| `/rewards` | 奖励规则预览，领取始终禁用 |
| `/admin` | demo 只读预览；database 只允许 Admin 查看空审核队列 |
| `/admin/ec-batches` | Admin 可查看 EC 空批次页，不生成真实 PR |

演示页不是登录机制，任何演示状态都不会授予后台权限。数据库模式从 HttpOnly 会话读取真实用户；管理员权限由服务端角色判断。

## 3. PostgreSQL 开发模式

本仓库提供 Docker Compose 配置，数据库仅绑定本机 5434 端口：

```bash
docker compose up -d postgres
npm run db:deploy
npm run db:seed
```

将 `.env` 中 `DATA_MODE` 改为 `database`，保留 `APP_ENV=development`，重启 Web。

基础迁移位于 `prisma/migrations/202609100001_init/`，身份迁移位于 `202609100002_authentication/`。种子脚本只初始化活动、一个草案奖励期与四个统计周，不写示例钱包、不授予 Admin、不伪造已合并记录；重复执行不会改写已有周期配置。活动开始时间为北京时间 2026-09-09 00:00。

也可使用自己的 PostgreSQL，通过 `DATABASE_URL` 指定连接。该环境在独立本地 PostgreSQL 15 实例上实际验证了迁移和 Worker；Compose 提供 PostgreSQL 17 配置，本次未运行 Docker 容器。

公开读取已连接数据库：读取活动、奖励期、周次及最多 100 位参与者。当前首版 API 返回整个奖励期；前端月份筛选选择与月份相交的周，不是完整的服务端分页、跨活动查询或月活统计接口。

数据库约束覆盖钱包唯一、GitHub ID 唯一、单用户唯一 GitHub、每用户每周唯一提交、提交修订版本、批次 PR 与任务幂等键。代码跨周去重、复杂角色变更审计、资格撤回及资金约束需在对应业务服务阶段继续完成，不因已有表就视为已实现。

## 4. 后台 Worker

```bash
npm run worker:check
npm run worker:once
npm run worker
```

`worker:check` 只检查配置与已注册 handler，不声称数据库或外部服务健康。demo 模式 Worker 明确退出，不执行任务；database 模式使用与 Web 相同的连接配置。

当前只有 `system.ping` handler。数据库队列支持原子领取、并发互斥、60 秒租约、重试次数、退避及过期任务处理。外部 EC 和支付任务没有 handler，不会被误标为成功。

加入长任务前必须补充租约续期、外部操作幂等恢复、outbox 投递和死信处理。当前 outbox 只有表结构，生产 EC 自动化尚未实现。Ctrl+C 或 SIGTERM 会在当前短任务结束后停止 Worker。

## 5. API 骨架与权限

| 接口 | 当前响应 |
|---|---|
| `GET /api/health` | 存活检测 |
| `GET /api/health/ready` | demo 不依赖数据库；database 执行数据库连接检测 |
| `GET /api/public/campaigns/current` | 活动及周配置、数据模式、时间 |
| `GET /api/public/progress` | 只读钱包与周状态，专用公开 DTO |
| `POST /api/auth/wallet/nonce` | 校验邀请、Origin 和 Kite 网络，返回五分钟 EIP-4361 挑战 |
| `POST /api/auth/wallet/verify` | 验签并原子消费挑战，创建 HttpOnly 会话 |
| `GET /api/auth/github` | 登录后创建一次性 state 和 PKCE，跳转 GitHub |
| `GET /api/auth/github/callback` | 绑定唯一 GitHub User ID，不保存 OAuth Token |
| `POST /api/auth/logout` | 删除服务端会话及 Cookie |
| `GET /api/me` | 返回钱包、链、角色及 GitHub 绑定状态 |
| `POST /api/submissions` | 401 `AUTH_REQUIRED` |
| `GET /api/admin/dashboard` | 仅 Admin；通过鉴权后返回 501，统计尚未接入 |
| `GET/POST /api/admin/participants` | Admin 查看及批量导入邀请白名单 |
| `POST /api/admin/ec-batches` | 仅 Admin；通过鉴权后返回 501，不创建批次 |
| `GET /api/rewards/eligibility` | 401 `AUTH_REQUIRED` |
| `POST /api/rewards/claim` | 503 `FEATURE_DISABLED`，无资金操作 |

认证使用钱包白名单准入、OKX 注入的 EVM provider、EIP-4361 一次性签名挑战及数据库会话。Admin 页面可以上传 `name,contact,github,wallet` CSV，钱包列必填且全局唯一。GitHub OAuth 使用 state、PKCE 和稳定数字 User ID；同一钱包只能绑定一个 GitHub，一个 GitHub 也不能绑定多个钱包，预填 GitHub 时必须与授权账号匹配。Admin 钱包在首次登录时按 `ADMIN_WALLET_ALLOWLIST` 授予角色。普通用户每次读取会话都必须仍有 ACTIVE 白名单记录，demo Cookie、header 或前端状态均不能授予权限。

Admin 登录后直接进入 `/admin`，不绑定 GitHub，也不显示或进入个人看板、项目贡献和奖励页面。当前 Admin 首页负责参与白名单导入与名单查看；后续审核和 EC 功能从同一管理入口扩展。

数据库模式本地配置示例：

```dotenv
APP_ENV=development
DATA_MODE=database
KITE_NETWORK=testnet
APP_ORIGIN=http://127.0.0.1:3000
GITHUB_OAUTH_CLIENT_ID=你的开发 OAuth App Client ID
GITHUB_OAUTH_CLIENT_SECRET=你的开发 OAuth App Client Secret
ADMIN_WALLET_ALLOWLIST=0x管理员钱包1,0x管理员钱包2
```

在 [GitHub OAuth Apps](https://github.com/settings/developers) 新建开发应用，Homepage URL 填写与 `APP_ORIGIN` 完全相同的值，Authorization callback URL 填写 `APP_ORIGIN/api/auth/github/callback`。正式环境另建应用并使用 HTTPS 域名。白名单模板可从 `/participants-template.csv` 下载。首版只支持普通 EOA 钱包签名，不支持 ERC-1271 合约钱包。

## 6. 检查与数据库集成验证

```bash
npm run check
npm run format:check
npm run db:validate
npm run build
npm run worker:check
```

`npm ci` 的 postinstall 自动生成 Prisma Client，生成目录不提交。`build` 同时再次生成客户端，避免部署缺失生成代码。

数据库集成测试只允许开发环境、数据库名称以 `_test` 结尾且 Job 队列为空：

```bash
export DATABASE_URL='postgresql://kite:kite_local_only@127.0.0.1:5434/kite_bounty_test?schema=public'
npm run db:deploy
npm run db:seed
npm run test:db
```

测试验证钱包／GitHub／周提交唯一约束、两个 Worker 同时抢一条任务、未知 handler 不成功、过期租约达到重试上限后失败。身份 HTTP 验证覆盖 Origin 和网络拒绝、真实 EOA 签名、Admin 会话、nonce 防重放、GitHub state/PKCE、非法回调拒绝及注销。领域数据事务回滚，测试任务按本次唯一前缀清理。只对专用测试库运行；需恢复原数据库时关闭此 shell 或恢复环境变量。

已执行：静态检查、类型检查、基础测试、生产构建；独立 PostgreSQL 两次迁移、种子初始化、数据库集成测试及 Worker 单次运行；六个页面、公开／受保护 API 和钱包身份 HTTP 流程检查。GitHub OAuth 的真实授权码交换需要项目方创建 OAuth App 后验收。当前没有可连接浏览器，因此未完成 OKX 弹窗交互与视觉验收。GitHub Actions 文件已提供，远端 CI 未执行。

## 7. 下一阶段边界

1. 实现 GitHub 仓库证据读取、周提交和修订。
2. 实现 Admin 审核、代码证据快照和完整审计事务。
3. 接通 outbox、EC provider、校验容器、PR 创建与状态回填。
4. 在业务规则最终确认后实现奖励资格；Passport 支付单独验收。

生产环境会拒绝 demo 数据、测试链、mock EC 和开启支付。当前应用尚不具备正式业务上线条件；本地主网配置预留并不代表主网业务已实现。
