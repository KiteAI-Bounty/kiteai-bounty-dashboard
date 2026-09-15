# KiteAI Bounty 看板实现文档

版本：V0.2 草案 · 更新日期：2026-09-10

产品规则见 [设计文档](DESIGN.md)。本文件是开发方案及已查证的外部接口清单。整体工程框架与 P1 身份链路已落地，当前可运行能力、启动方法及限制见 [开发指南](DEVELOPMENT.md)；审核写入、EC 自动化与支付尚未接入。未创建外部 PR 或执行付款。D1/D2 等待确认规则不得作为已确认事实发布。

## 1. 技术方案与工程结构

工程已采用 TypeScript、Next.js App Router、PostgreSQL、Prisma 与独立 Node Worker；Web 和 Worker 共用业务模块。数据库任务表已支持短任务领取和重试，outbox 当前仅有模型，尚未接通业务事件。EC 校验后续使用固定版本 Python／uv 工具容器，与 Web 进程隔离。

具体依赖版本在初始化时选择相互兼容的稳定版本并提交 lockfile；不在本文固定未经安装验证的版本组合。[Next.js 官方文档](https://nextjs.org/docs/app)

```text
src/app/                       页面及 /api 路由
src/modules/auth/              钱包认证、GitHub 唯一绑定、Admin 权限
src/modules/campaigns/         周期、参与名单、统计窗口
src/modules/submissions/       每周提交、修订、贡献证据
src/modules/reviews/           审核及审计
src/modules/ec/                taxonomy、批次和 PR 状态
src/modules/rewards/           资格、发放审核；后续领取
src/integrations/github/       用户读取和运营写入两个客户端
src/integrations/metrics/      EC / Web3Insight 独立适配器
src/integrations/passport/     后续受限支付适配器
src/workers/                   作业租约、重试和定时同步
prisma/                        schema、迁移和开发种子数据
tests/                         业务、接口、并发和端到端验证
```

### 1.1 AI 预审核模块（规划）

AI 预审核放在 Admin 确认之前，输入参与者提交的仓库 URL、Commit 快照、选择的贡献方向、summary，以及待生成的 EC migration。模块必须先运行确定性规则，再调用模型生成解释；模型结果只作为 Admin 的审核辅助信息。

处理流程按仓库登记状态分流：首次提交尚未归入 KiteAI 的仓库时，GLM 分析仓库内容、KiteAI 关联和 EC 兼容性，并据真实代码生成 PR 描述草稿；仓库已登记后，后续周次只分析新 Commit 的作者、时间、原创性、代码变化和 KiteAI 关联，不生成 migration，也不重复创建 EC PR。完整规则见 [EC 活跃开发者计入规则](EC_ACTIVE_DEVELOPER_RULES.md)。

确定性检查至少包括：

1. GitHub 仓库公开可访问、非 Fork，Commit 作者与绑定 GitHub 身份一致。
2. Commit 日期属于当前统计周，排除 Merge Commit、Bot、`[bot]` 和自动生成提交。
3. 仓库未重复登记，已有 `KiteAI` 生态时只能生成 `repadd KiteAI <repo-url>`。
4. migration 文件名和 `ecoadd`／`repadd`／`ecocon` DSL 通过 Open Dev Data 校验。
5. 提交方向、README、依赖、代码证据与 KiteAI 关联要求一致。

模型分析结果保存为不可变审计快照，字段包括规则版本、模型版本、输入摘要、逐项结论、风险等级、建议和时间。建议结果分为 `PASS_RECOMMENDED`、`CHANGES_RECOMMENDED`、`HIGH_RISK`；任何结果都不能直接改变 Submission 状态。

EC 反馈闭环在 PR 同步任务中实现：记录 PR 的 `OPEN`、`MERGED`、`CLOSED_UNMERGED`、Review 评论和上游 taxonomy 复核结果，作为后续规则评估数据。关闭 PR 不能单独解释为代码不合格，可能是重复或被其他 PR 替代；因此 AI 训练／评估必须结合 PR 描述、评论和最终迁移结果。

## 2. 配置与开发环境

### 2.1 已核实的链配置

| 参数 | 正式主网 | 开发测试网 |
|---|---|---|
| Network | KiteAI Mainnet | KiteAI Testnet |
| Chain ID | `2366` / `0x93e` | `2368` / `0x940` |
| RPC | `https://rpc.gokite.ai/` | `https://rpc-testnet.gokite.ai/` |
| Explorer | `https://kitescan.ai/` | `https://testnet.kitescan.ai/` |
| 原生资产 | KITE | KITE |

来源：[Kite 官方 Network Information](https://docs.gokite.ai/kite-chain/1-getting-started/network-information)。这些是文档核实值，本次未执行 RPC 活性或 USDC 合约验证。

### 2.2 配置项

| 配置 | 初始值／要求 |
|---|---|
| `APP_ENV` | `development / staging / production` |
| `KITE_NETWORK` | 测试环境 `testnet`；正式环境 `mainnet` |
| `DATA_MODE` | 本地页面预览可用 `demo`；真实身份必须使用 `database` |
| `APP_ORIGIN` | 应用的精确 Origin；非开发环境必须为 HTTPS |
| `EC_PROVIDER_MODE` | `mock / sandbox / live`；测试只允许受控 sandbox 上游 |
| `CLAIMS_ENABLED` | MVP 固定 `false` |
| `CAMPAIGN_TIMEZONE` | `Asia/Shanghai` |
| `CAMPAIGN_START_AT` | `2026-09-09T00:00:00+08:00` |
| `EC_ECOSYSTEM_NAME` | `KiteAI` |
| `EC_UPSTREAM_REPOSITORY` | 正式为 `electric-capital/open-dev-data`；启动读取并校验 repository ID |
| `EC_FORK_OWNER` | 团队控制的 GitHub 账号或组织，待提供 |
| `GITHUB_OAUTH_CLIENT_ID/SECRET` | 开发和正式独立 OAuth App |
| `GITHUB_EC_TOKEN_SECRET_REF` | 运营身份凭据引用，只在服务端读取 |
| `ADMIN_WALLET_ALLOWLIST` | 由部署管理员配置，数据库审计角色变更 |
| `DATABASE_URL` | 数据库模式必填，环境隔离，不进入客户端 |
| `WEB3INSIGHT_API_BASE` | `https://api.web3insight.ai/v1` |
| `WEB3INSIGHT_TOKEN_SECRET_REF` | 如需授权，由服务端读取；普通读接口匿名能力需联调 |
| 支付配置 | 第三阶段新增 USDC 地址、精度、中心钱包、Passport 凭据引用与预算限额 |

模拟模式展示明显“开发数据”标识。生产使用新数据库及独立凭据，不迁入测试 nonce、提交、模拟合并或奖励数据。切换主网需同时核对服务端认证链、钱包网络、Explorer、支付资产与外部写入模式，不能只改前端 Chain ID。

## 3. 账号入口与权限方案

| 用途 | 官方入口 | 准备内容 |
|---|---|---|
| 查看 EC 榜单 | [Developer Report](https://www.developerreport.com/) | 公开浏览；首页邮件订阅不是登记账号或 API Key 申请 |
| 查询生态归属 | [Open Dev Data](https://opendevdata.org/) | 查询／导出；登记通过 GitHub PR |
| 创建 GitHub 身份 | [GitHub 注册](https://github.com/signup) | 使用已有团队账号亦可，不要求每次另注册 |
| EC 上游仓库 | [electric-capital/open-dev-data](https://github.com/electric-capital/open-dev-data) | fork 到团队控制的账号／组织 |
| 用户绑定 OAuth App | [GitHub OAuth Apps](https://github.com/settings/developers) | 设置回调 URL，服务端保管 Secret |
| 长期 GitHub App | [GitHub Apps](https://github.com/settings/apps) | 安装到本方 fork；跨组织上游 PR 权限需专门验证 |
| MVP 服务身份 Token | [GitHub Token 设置](https://github.com/settings/tokens) | 受控账号的 public_repo 范围 classic PAT，设置到期与轮换 |
| Web3Insight | [Dashboard](https://dash.web3insight.ai/report)、[API 文档](https://api.web3insight.ai/doc/api) | 登录／服务授权用于可选外部指标；不赋予 EC 合并权 |
| Agent Passport | [官方入口](https://agentpassport.ai/)、[接入说明](https://docs.gokite.ai/kite-agent-passport) | 第三阶段注册付款方账户并设置 Passkey |

EC 没有本项目可直接申请的公开报表 API Key。官方提供 API 用例联系邮箱 `devreport@electriccapital.com`，如需要可由项目方联系；本次不代发邮件。[官方说明](https://www.developerreport.com/about)

用户 GitHub OAuth 仅用于身份读取，与 EC 运营 Token 完全隔离。绑定公开身份不要求参与者授权仓库写入。GitHub fine-grained PAT 对向非成员公共仓库贡献存在限制；不能假定只在本方 fork 安装 App 就能操作上游。MVP 优先验证受控服务账号 classic PAT 的 `public_repo` 路径，再评估长期 App 方案。[Token 限制](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens)、[OAuth scopes](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/scopes-for-oauth-apps)

## 4. 完整外部接口清单

### 4.1 钱包连接与 GitHub 身份

钱包通过 OKX EVM provider 连接：`eth_requestAccounts` 获取地址，`wallet_switchEthereumChain` 切网，网络不存在时使用 `wallet_addEthereumChain`；使用签名挑战完成登录。用户拒绝请求和钱包切换账户均需更新界面及重新认证。[OKX 官方 EVM 接入](https://web3.okx.com/zh-hans/onchainos/dev-docs/wallet/dapp-connect/app-connect-evm-sdk)

当前实现生成 EIP-4361 消息，精确绑定 Origin、钱包、Kite Chain ID、随机码、签发时间和五分钟有效期。nonce 只能原子消费一次；会话只在数据库保存随机 Token 的 SHA-256 摘要，浏览器 Cookie 为 HttpOnly、SameSite=Lax，非开发环境强制 Secure。首版验证 EOA 的标准 ECDSA 签名，合约钱包需在后续加入 ERC-1271 后再开放。

登录采用钱包白名单制。Admin 通过 CSV 导入姓名、联系方式、可选 GitHub 用户名和必填钱包；只有登记钱包可以获取签名挑战。钱包完成有效签名后原子激活成员。普通用户的后续会话也持续检查名单仍为 ACTIVE，历史会话不能绕过准入门禁。

| 调用 | 用途 | 关键检查 |
|---|---|---|
| `GET https://github.com/login/oauth/authorize` | 浏览器发起绑定 | 服务端生成 state，绑定当前钱包会话；采用 PKCE |
| `POST https://github.com/login/oauth/access_token` | 服务端兑换 code | 校验 state、回调、时效；验证 code_verifier |
| `GET https://api.github.com/user` | 确认授权 GitHub 身份 | 保存稳定数字 ID、login、avatar_url，数据库唯一约束 |

参考：[OAuth 授权](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps)、[Users API](https://docs.github.com/en/rest/users/users)。

### 4.2 审核用户仓库和代码

以下均基于 `https://api.github.com`，优先只读公共资源。分页遵循 Link header；保存未取全状态，禁止把部分结果当全部证据。

| 接口 | 必需程度 | 用途 |
|---|---|---|
| `GET /repos/{owner}/{repo}` | 必需 | repository ID、公开状态、fork、默认分支、owner、重命名后的标准地址 |
| `GET /repos/{owner}/{repo}/commits` | 必需 | 按 author、since、until、sha 分页寻找本周候选；服务端再按半开区间过滤 |
| `GET /repos/{owner}/{repo}/commits/{ref}` | 必需 | 固定 SHA、GitHub author.id、作者与提交者时间、files、patch |
| `GET /repos/{owner}/{repo}/pulls/{number}` | PR 证据时必需 | 读取贡献 PR 的 head/base 与状态；PR 作者不替代 Commit 作者 |
| `GET /repos/{owner}/{repo}/pulls/{number}/commits` | PR 证据时必需 | 展开实际原创 Commit，排除他人代码与重复 SHA |
| `GET /repos/{owner}/{repo}/pulls/{number}/files` | PR 证据时必需 | 展示变更；超出平台返回上限时标记证据不完整 |
| `GET /repos/{owner}/{repo}/git/trees/{sha}` | 按需 | 检查有效代码树；处理 `truncated` 后继续读取子树 |
| `GET /repos/{owner}/{repo}/contents/{path}` | 按需 | 读取依赖及集成说明；不能执行用户提供的代码 |

来源：[Repositories](https://docs.github.com/en/rest/repos/repos)、[Commits](https://docs.github.com/en/rest/commits/commits)、[Pull requests](https://docs.github.com/en/rest/pulls/pulls)、[Trees](https://docs.github.com/en/rest/git/trees)、[Contents](https://docs.github.com/en/rest/repos/contents)。MVP 输入以仓库／Commit／PR 为主；如保留 Release 输入，必须解析 tag 和对应 Commit 后走同一审核链。

### 4.3 EC 登记 PR 的 GitHub API

`U` 表示已核实的上游 owner/repo，正式为 `electric-capital/open-dev-data`；`F` 表示本方 fork。PR 号属于 `U`，分支和文件写入 `F`。运行时读取默认分支，本次快照为 `master`。

实现采用一个预先创建并受 GitHub App 管理的团队 Fork，不在每次用户提交时创建 Fork。Admin 审核通过后，Worker 为该批次生成独立分支和稳定 migration，先按内容散列及 `head` 查重，再创建或更新上游 PR。平台只负责创建和监控 PR；Electric Capital 的维护者拥有最终审核与合并权。成功创建 PR 不改变周完成状态，只有同步到 `merged=true` 并重放上游 taxonomy、逐项核实条目后才发布完成事件。

所有外部写操作必须幂等：超时先用批次、分支和 head 查询既有 PR；文件写入携带 blob SHA；并发冲突重新读取基线后生成新 revision；失败只重试 EC 作业，不回滚已通过的内部审核。`closed_unmerged`、鉴权失败、限流、网络错误和查询不确定性分别记录，禁止统一转成“未合并”或“已完成”。

| 阶段 | 接口 | 请求／结果重点 |
|---|---|---|
| 初始化 | `GET /repos/{U}` | repository ID、default_branch；阻止目标被替换 |
| 创建 fork | `POST /repos/{U}/forks` | 首次部署调用；异步创建后轮询 `GET /repos/{F}` |
| 同步 fork | `POST /repos/{F}/merge-upstream` | `branch` 为本方默认分支；冲突进入修复，不盲目强推 |
| 获取基线 | `GET /repos/{U}/git/ref/heads/{branch}` | 记录 base SHA；确保该 SHA 在 fork 可用 |
| 下载 taxonomy | `GET /repos/{U}/tarball/{sha}` | 固定快照供校验；校验目标及下载重定向域 |
| 分支查重 | `GET /repos/{F}/git/ref/heads/{branch}` | 分支名由 batch UUID 决定，存在则复用 |
| 创建分支 | `POST /repos/{F}/git/refs` | `ref=refs/heads/ec/kiteai/{batchId}` 与 base SHA |
| 读取旧文件 | `GET /repos/{F}/contents/{path}?ref={branch}` | 更新时取得 blob SHA，与本方记录对照 |
| 写 migration | `PUT /repos/{F}/contents/{path}` | `message/content(base64)/branch`；更新附旧 blob SHA |
| PR 查重 | `GET /repos/{U}/pulls?state=all&head={forkOwner}:{branch}` | 外部调用超时后先查已创建 PR，不直接再创建 |
| 创建 PR | `POST /repos/{U}/pulls` | `title/head/base/body`；正文附仓库清单与 KiteAI 关联说明 |
| 更新 PR 描述 | `PATCH /repos/{U}/pulls/{number}` | 更新标题／正文；修改 migration 则写相同 head 分支 |
| 读取状态 | `GET /repos/{U}/pulls/{number}` | `state/merged/merged_at/head.sha/base.repo.id/merge_commit_sha` |
| 获取合并结果 | `GET /repos/{U}/pulls/{number}/merge` | `204` 表示已合并；不能把所有非 204 都解释为未合并，需区分鉴权及网络错误 |
| 读取最终文件 | `GET /repos/{U}/pulls/{number}/files` | 逐项对照 migration；随后从上游 taxonomy 验证归属 |
| 读取 CI | `GET /repos/{U}/commits/{headSha}/check-runs` | 只看最新 head；检查结论独立保存 |
| 兼容旧 CI | `GET /repos/{U}/commits/{headSha}/status` | combined status；pending 或无 CI 不是成功 |
| 读取审核 | `GET /repos/{U}/pulls/{number}/reviews` | 处理最新有效审核及 dismissed 状态 |
| 读取讨论 | `GET /repos/{U}/issues/{number}/comments` | 维护者常在普通评论中要求修改 |
| 读取行评论 | `GET /repos/{U}/pulls/{number}/comments` | 同步代码审查意见 |

参考：[Forks](https://docs.github.com/en/rest/repos/forks)、[Branches / sync fork](https://docs.github.com/en/rest/branches/branches)、[Refs](https://docs.github.com/en/rest/git/refs)、[Contents](https://docs.github.com/en/rest/repos/contents)、[PR](https://docs.github.com/en/rest/pulls/pulls)、[Check runs](https://docs.github.com/en/rest/checks/runs)、[Statuses](https://docs.github.com/en/rest/commits/statuses)、[Reviews](https://docs.github.com/en/rest/pulls/reviews)、[普通评论](https://docs.github.com/en/rest/issues/comments)、[行评论](https://docs.github.com/en/rest/pulls/comments)。

`PUT /repos/{U}/pulls/{number}/merge` 确实是 GitHub 合并接口，但需要上游写入权限，不是普通贡献方可用的登记接口。本项目生产流程不调用它。可在完全受控的 sandbox 上游测试合并后的同步逻辑。

长期改为 GitHub App 时才增加 `POST /app/installations/{installation_id}/access_tokens` 及相应凭据轮换；权限需按每个目标仓库验证。[GitHub Apps API](https://docs.github.com/en/rest/apps/apps)

### 4.4 EC 本地工具与数据读取

| 能力 | 命令／接口 | 使用阶段 |
|---|---|---|
| 生成登记 | 在本方代码中生成 migration 文本 | 必需；仅对未登记归属生成 `repadd` |
| 校验 | `uvx open-dev-data validate -r ./migrations` | 必需；生产固定经验证工具版本，运行完整基线加候选文件 |
| 重放归属 | `uvx open-dev-data export -r ./migrations -e KiteAI kiteai.jsonl` | 必需；检索有效归属，保留基线与结果散列 |
| 数据清单 | `GET https://data.opendevdata.org/manifest.json` | 可选数据分析；源码公开的下载入口 |
| 下载数据 | 下载 manifest 引用的资源；或 `uvx open-dev-data download` | 可选，按版本、大小、checksum 管理 |
| 本地分析 | `uvx open-dev-data duckify` | 可选，不能把本地计算标成官方榜单实时值 |

参考：[Open Dev Data CLI](https://github.com/electric-capital/open-dev-data)、[下载实现](https://github.com/electric-capital/open-dev-data/blob/b6ffb61ec952c3b62e02c68b98c0e6d31667b0df/src/open_dev_data/download.py)。数据接口是公开数据文件入口，与 Developer Report 的“没有公开报表 API”并不冲突。

候选 migration 示例（占位仓库，不能原样提交）：

```text
-- KiteAI bounty reviewed repositories
repadd KiteAI https://github.com/example/repository
```

文件名为 `migrations/YYYY-MM-DDThhmmss_kiteai_{batchId}`。生成时间由服务端固定并保存，重试不重新命名。已存在 KiteAI 不重复 `ecoadd`。历史归属时间可能影响外部统计，不能通过随意回填 migration 日期伪造更早关联；是否需要有证据的历史归属修正，另与维护者确认。

### 4.5 Web3Insight 可选查询接口

已读取官网 API 文档引用的 OpenAPI 2.0.0 定义；base 为 `https://api.web3insight.ai/v1`。文档声明 Bearer JWT／服务 Token，并说明多数读取可匿名；具体权限与响应需联调，不假定匿名全部可用。[官方 API 文档](https://api.web3insight.ai/doc/api)、[OpenAPI 定义](https://api.web3insight.ai/openapi.json)

| 接口 | 用途与参数 |
|---|---|
| `GET /ecosystems/top` | 观察生态排行；不在返回列表不能据此断言生态不存在 |
| `GET /actors/total?eco_name=KiteAI&scope=all` | 开发者总量观察值，不能自行改名为月活 |
| `GET /actors/total/date?eco_name=KiteAI&period=month` | 最近八期趋势，period 支持 week/month |
| `GET /actors/top?eco_name=KiteAI` | 开发者排行 |
| `GET /repos/total?eco_name=KiteAI` | 仓库总量 |
| `GET /repos/top?eco_name=KiteAI` | 仓库排行 |
| `GET /repos/active/developer?repo_id={id}` | 仓库活跃开发者；先核实这里的 repo_id 所属 ID 空间 |
| `GET /years/rank/report` | 年度报告观察；不用于判定某周参与完成 |

接口中的 `KiteAI` 是待联调的名称参数，不能假定 Web3Insight 与 EC 的生态键完全相同。其 `/admin/*` 属于 Web3Insight 自身管理权限，本看板 Admin 不拥有这些权限，也不通过这些接口声称更新 EC。

### 4.6 后续 Agent Passport

已公开的能力包含 `kpass wallet balance`、`kpass wallet send --to ... --amount ... --asset USDC`，以及 session create/status/execute。官方把钱包直接转账与受限 session 服务支付区分，奖励转账如何获得强制限额、白名单和可撤销授权需要专项验证。[Passport CLI](https://docs.gokite.ai/kite-agent-passport/cli-reference)

本期只定义 `PaymentProvider` 适配器边界，不编造 Passport REST 路径，不安装支付工具，不发送测试或主网资金。

## 5. 业务实现细节

### 5.1 认证和一次性绑定

nonce 至少 128 位随机熵、短期有效、只保存必要校验信息。签名消息包含域名、URI、地址、链 ID、nonce、签发和过期时间。恢复签名地址后校验部署允许的链、Origin 与时间；事务内消费 nonce，重复请求不可再次登录。

会话 Cookie 使用 HttpOnly、Secure、SameSite，写接口验证 CSRF／Origin。GitHub state 绑定发起时钱包会话并一次性消费；回调时会话或钱包变化则拒绝。唯一索引处理并发绑定竞争。审核、登记和奖励权限均从服务端会话查角色。

### 5.2 周提交及作者检查

服务端根据当前时间确定可提交周，不信任前端传入其他人的 user_id。唯一约束为 `(user_id, week_id)`。持久化每个修订的 SHA 证据、抓取时间、原始 GitHub 作者与日期；作者不匹配或 `author=null` 转人工核实，不能凭用户名或任意提交邮箱自动通过。

作者过滤还需排除 `author.type=Bot`、以 `[bot]` 结尾的登录名、自动生成提交、Merge Commit、仅执行 Pull Request 合并的账号，以及 Fork 创建前继承的历史 Commit。真人使用 Claude 等 AI 工具辅助开发不自动排除；只要 Commit 使用本人 GitHub 身份且通过管理员代码审核，仍按真人作者处理。

Commit 日期是作者可设置的数据，时间窗口过滤不等于已证明发布时间；同时保存首次观察时间及可用 PR／仓库上下文供审核异常回填。候选查询应明确分支范围，不能只扫默认分支后声称已覆盖所有分支。接口超限或 diff 缺失时保留“证据不完整”标记。

审核绑定 `revision_id + version`；用户修订后旧审核不能覆盖新版本。原创 SHA 已用于同一作者其他周时拒绝重复使用；同一 PR 中不同作者的独立 SHA 可分别归属其本人。

### 5.3 审核事务与 EC 作业

1. 锁定提交并验证审核版本，记录决定与审计日志。
2. 同一数据库事务写 outbox。已有登记则排重算任务，否则加入未冻结批次。
3. Worker 领取持久化任务，租约超时可恢复；基于批次和操作版本去重。
4. 拉取上游固定快照并重放，排除已经登记及其他打开批次占用的仓库。
5. 生成稳定 migration，保存内容散列、基线 SHA、工具版本及校验日志。
6. 校验通过后写 fork，创建／复用 PR，保存外部 ID。每个写入阶段先核实是否已完成。
7. 新仓库追加到打开批次时提高 revision，重新生成、校验、写文件并更新 PR 描述。
8. 同步合并后重放 taxonomy，逐条登记证据确认，发送周状态和奖励重算事件。

审核成功但 GitHub 失败时显示两个结果，重试仅重试 EC 作业。空变更不创建 PR。若已有外部 PR 正在登记同一仓库，可绑定该 PR 后监控并验收，不制造重复请求。

### 5.4 同步、限流和恢复

生产不拥有 EC 上游管理权，默认采用每 10 分钟定时读取未终结 PR，按请求额度退避。只在确实获得上游 webhook 权限时加入 webhook 加速；本方 fork 的 push webhook 不能替代上游合并事件。

如使用 webhook，校验原始请求体 HMAC 和 `X-Hub-Signature-256`，按 delivery ID 去重，然后重新读取 GitHub 权威状态。[Webhook 验签](https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries)

同步前校验 repository ID、PR 号与本方记录匹配。外部评论只作为内容展示，不解析为有权修改数据库的指令。网络错误、401/403、限流、404 和 closed-unmerged 分开处理，不能把查询失败写成“未合并”。

| 场景 | 恢复行为 |
|---|---|
| 分支／文件已创建但响应丢失 | GET 对照固定分支和内容散列后续跑 |
| 创建 PR 响应超时 | 按 head 查现有 PR，再决定是否需要重试 |
| 并发写文件 409 | 读取最新 blob SHA，核对本方 revision 后重算，不覆盖外部修订 |
| PR 合并前上游变动 | 刷新基线重新校验；冲突显示具体文件 |
| EC 修改 PR 移除一项 | 仅完成最终被核实的条目，其余继续待登记 |
| Worker 在外部写后崩溃 | 通过外部对象查重恢复，不靠数据库单次执行假设 |
| 合并后资格重算失败 | 独立重算作业可重试，不重建 PR |
| 仓库重命名／被移除 | 依据 repository ID 关联历史；冻结受影响的未付款资格并人工复核 |

API 统一发送 `Accept: application/vnd.github+json` 并固定已验证的 `X-GitHub-Api-Version`；当前查阅文档示例为 `2026-03-10`。读取分页和 rate-limit header，使用 ETag／条件请求降低重复流量，429／限流遵循 Retry-After 并加退避抖动。

### 5.5 奖励和支付边界

按设计文档 D1/D2 提案，纯计算模块根据完成周快照生成 0／25／40，金额使用最小单位整数，不能用浮点处理资金。`eligible` 与 `claimable` 分开；至少满足第五周开始、EC 条件、Admin 发放审核、支付功能启用才开放按钮。

后续支付流程为：认证领取 → 锁定 entitlement → 冻结收款钱包及最大可付差额 → 创建唯一 claim → 独立执行器验证策略 → 广播 → 回执确认 → 入账。已经 paid 的金额不能重算清零。

支付专项必须测试：并发领取只能生成一份付款意图；签名绑定域、链、资产、钱包、金额、claim ID、nonce 和截止时间；余额和预算原子预占；不允许用户输入自定义收款人。广播超时且是否已提交不明时进入 `unknown` 并对账，不直接重发；保存 provider request ID、交易 nonce、hash、替换关系及回执，防止“重试”变重复转账。

Signer／Passport 需证明受限授权覆盖实际转账，权限可撤销、单笔和总额限额生效。主网 USDC 地址及精度通过可信官方资料与链上读数核验，确认数及重组处理单独配置。支付专项验收未过时 `CLAIMS_ENABLED=false`。

## 6. 本系统接口契约

所有以下接口属于本系统，统一 `/api` 前缀；并非 Electric Capital 提供的接口。时间返回 ISO 8601，公开响应采用专用 DTO。写接口支持 `Idempotency-Key`，编辑及审核携带版本；相同幂等键不同 payload 返回冲突。

| 接口 | 权限 | 请求及结果 |
|---|---|---|
| `GET /public/campaigns/current` | 公开 | 活动、时区、周日期、内部目标及数据更新时间 |
| `GET /public/progress?month=YYYY-MM&cursor=...` | 公开 | 钱包与相交周状态；分页，无内部备注 |
| `POST /auth/wallet/nonce` | 钱包白名单／Admin、公开限流 | address、chainId → challengeId、message、expiresAt |
| `POST /auth/wallet/verify` | 公开限流 | challengeId、signature → 会话 Cookie |
| `GET /auth/github`、`GET /auth/github/callback` | 钱包会话 | 发起／完成唯一绑定 |
| `POST /auth/logout`、`GET /me` | 登录 | 退出／读取本人身份 |
| `GET/POST /admin/participants` | Admin | 查看名单／导入含唯一钱包地址的 CSV |
| `POST /projects`、`GET /projects/:id` | 登录及成员校验 | 登记／查看仓库、集成说明 |
| `POST /submissions` | 绑定身份 | repositoryId、weekId、evidence、summary → 唯一周提交 |
| `PUT /submissions/:id` | 本人 | version、evidence、summary → 新修订 |
| `GET /me/submissions` | 本人 | 周提交历史、审核意见、EC 链接 |
| `GET /me/progress`、`GET /me/rewards` | 本人 | 周状态、奖励期金额、资格与禁用原因 |
| `GET /admin/dashboard`、`GET /admin/submissions` | Admin | 统计与审核队列，支持周次、身份、状态筛选 |
| `POST /admin/submissions/:id/approve-and-register` | Admin | revisionId、version、note → 审核结果、EC jobId 或已有登记证据 |
| `POST /admin/submissions/:id/request-changes` | Admin | revisionId、意见、可选修订截止时间 |
| `POST /admin/submissions/:id/reject` | Admin | revisionId、拒绝原因 |
| `POST /admin/ec-batches` | Admin | 创建／复用待处理批次 |
| `GET /admin/ec-batches/:id` | Admin | 条目、PR、CI、日志、同步时间 |
| `POST /admin/ec-batches/:id/generate` | Admin | 创建生成作业，返回 202 + jobId |
| `POST /admin/ec-batches/:id/validate` | Admin | 对固定 revision 执行校验 |
| `POST /admin/ec-batches/:id/create-pr` | Admin | 校验 revision/hash 后发起创建作业 |
| `POST /admin/ec-batches/:id/update-pr` | Admin | 校验新 revision 后更新既有 PR |
| `POST /admin/ec-batches/:id/sync` | Admin | 排队读取上游状态，不能手填 merged |
| `POST /admin/reward-periods/:id/review` | Admin | 对固定名单版本审核发放资格和预算 |
| `GET /rewards/eligibility` | 本人 | enabled、eligible、claimable、blockedReasons、amount |
| `POST /rewards/claim` | 本人 | MVP 返回 `FEATURE_DISABLED`，不创建支付任务 |
| `POST /webhooks/github` | 验签 | 可选加速入口，无 webhook 权限时使用轮询 |

关键错误码：`GITHUB_ALREADY_BOUND`、`WEEK_ALREADY_SUBMITTED`、`WEEK_CLOSED`、`REVISION_CONFLICT`、`AUTHOR_MISMATCH`、`EVIDENCE_INCOMPLETE`、`EC_VALIDATION_FAILED`、`EXTERNAL_RATE_LIMITED`、`FEATURE_DISABLED`。客户端不通过报错文本推断业务状态。

## 7. 开发阶段与验收用例

| 阶段 | 工作 | 完成证据 |
|---|---|---|
| P0 配置与数据层 | 环境隔离、数据库约束、首期周种子、D1/D2 策略开关 | 日期边界及唯一约束验证；生产不能开模拟认证 |
| P1 身份和公开名单（已完成） | OKX 测试网签名、OAuth、参与名单、个人看板 | 签名与防重放 HTTP 流程已验证；GitHub 双向唯一约束已通过数据库约束验证；真实 OAuth 回调待配置 GitHub App 后验收 |
| P2 提交与审核 | 周单、修订、GitHub 证据、Admin 审核、内部统计 | 并发提交一人一单；旧版本审核失败；跨月统计正确 |
| P3 EC 自动化 | 快照、校验、fork／分支、PR、状态同步、回填 | 在自有 sandbox 上游完成创建、修改、关闭、合并和故障恢复 |
| P4 奖励资格 | 连续周规则、第五周门槛、60 人预算、发放审核 | 0／25／40 正确，迟到合并回填，支付始终关闭 |
| P5 正式接入 | 主网认证、生产 OAuth、运营账号、真实有效 EC 登记 | 实际代码审核后提交真实 PR，记录“等待 EC”，不伪造合并验收 |
| P6 支付专项 | Passport、主网 USDC、中心钱包执行及对账 | 受限权限和资金安全测试通过后才启用领取 |

建议 P1–P4 业务测试集中覆盖以下场景：

| 用例 | 预期 |
|---|---|
| 北京时间 9/21 00:00 提交 | 归 W2，不能落入 W1 |
| W3 有 9 月及 10 月的有效 Commit | 周状态只有一项，内部自然月分别按作者去重 |
| 相同 SHA 经不同链接重复提交 | 同一作者只能计一次，不增加周数 |
| W1 登记到 W3 才合并 | 已审核 W1/W2 回填原周，不增加 W3 参与次数 |
| 已登记仓库第二周无新代码 | 不通过审核，不因已登记自动完成 |
| EC closed 但 merged=false | 保持未登记，禁止领取 |
| 10 人同仓库，9 人有有效代码 | 登记仓库仅一项，完成最多 9 人 |
| 60 人四周均完成 | 预计 2,400 USDC，不按 50 人截断 |
| 仅 W2/W3/W4 完成 | 按连续 W1–W3 提案不解锁；规则确认后锁定相应预期 |
| EC 完成但第五周未到 | 不能领取 |
| 第五周已到但 EC 未完成 | 继续等待，合并后重新计算 |
| PR 内删除一个登记项后合并 | 被删项不能跟随其他项变为完成 |
| 任意普通用户调用 Admin 接口 | 403，状态不变 |

完整业务实现后运行类型检查、静态检查、针对以上不变量的测试、构建及浏览器流程验证。端到端测试只使用受控仓库，不向 EC 上游发送测试垃圾 PR。当前已完成的框架和身份检查见 [开发指南](DEVELOPMENT.md)，本节完整业务验收尚未完成。

## 8. 外部依赖与开放事项

| 事项 | 状态 | 影响范围 |
|---|---|---|
| 主网／测试网参数 | 已从官方文档核实 | 初始化前可配置，部署时探测 RPC |
| EC 标准名称 | 已检索到 `KiteAI` | 运行时重放最新归属后使用 |
| 每周完成及奖励期 D1/D2 | 已提出适配方案，待用户确认 | 影响完成计算和周期命名，不阻碍基础模块 |
| 连续周、补充材料及活动结束日 | 文档给出提案，尚未全部明确 | 活动开放前确定并保存规则版本 |
| GitHub fork 账号与 Token | 待项目方准备 | 阻碍正式外部写入，不阻碍 mock／sandbox 开发 |
| Admin 钱包名单、正式域名 | 待项目方提供 | 正式权限和 OAuth 回调配置 |
| EC 实际审核及榜单刷新 | 外部控制，无固定时限承诺 | 系统持续跟踪；交付不能承诺保证上榜 |
| Web3Insight 数据权限和名称映射 | 文档已读，业务接口未实测 | 可选外部观察，不影响提交审核 |
| USDC 与 Passport 支付参数 | 后续专项 | 只阻碍真实领取，不阻碍资格展示 |

开发文档中的接口路径已按官方资料及公开 OpenAPI 整理；授权写入、CLI 校验运行、外部查询响应和支付联调仍需在相应阶段实际验证。
