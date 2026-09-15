# KiteAI 开源 Bounty 看板

> 工程框架已搭建。运行方法见 [开发指南](docs/DEVELOPMENT.md)，产品与架构见 [设计文档](docs/DESIGN.md)，接口与阶段规划见 [实现文档](docs/IMPLEMENTATION.md)，EC 计入标准见 [Electric Capital 活跃开发者规则](docs/EC_ACTIVE_DEVELOPER_RULES.md)。下文为原始 V0.1 需求，后续对齐以设计文档中已确认规则为准。

本地启动（Node.js 22.12+）：

```bash
cp .env.example .env
npm ci
npm run dev
```

访问 [本地看板](http://127.0.0.1:3000)。默认是带明确标识的只读演示模式，无需数据库；切换到数据库模式后可使用 OKX 钱包签名登录并绑定 GitHub。贡献写入、EC PR 和支付尚未接入。

产品与开发文档 · V0.1  
项目周期：连续 3 个自然月  
核心目标：每月达到 50+ 名提交有效原创代码的月活跃开发者（MAD）

## 1. 项目背景与目标

KiteAI 开源 Bounty Program 鼓励开发者围绕 KiteAI 提供的技术方向自主创建开源项目，也允许开发者通过向 KiteAI 官方仓库提交代码参与。

本看板需要完成以下工作：

- 开发者通过 OKX 钱包登录，并绑定唯一的 GitHub 账号。
- 开发者登记自己的项目仓库，并按周提交代码贡献记录。
- Admin 审核项目及代码贡献是否有效。
- 系统统计每周完成贡献的开发者人数及每月 MAD 完成情况。
- 审核通过的外部项目仓库，由 Admin 加入 Electric Capital 登记批次。
- 系统自动向 Electric Capital Open Dev Data 创建或更新 PR。
- 用户查看每周进度、奖励解锁情况和 Electric Capital 登记状态。
- 为后续链上激励领取功能预留入口和数据结构。

第一个月的阶段目标为 15 → 35 → 50+ 名有效原创代码作者；第二、第三个月继续保持每月 50+ MAD。

## 2. 产品范围

### 2.1 MVP 范围

第一期实现：

- OKX 钱包登录及 KiteAI 链网络校验。
- 钱包签名认证。
- GitHub 账号唯一绑定。
- 用户端月度及每周进度看板。
- 项目仓库登记和每周代码贡献提交。
- Admin 审核后台及周度数据统计。
- Electric Capital 仓库登记批次。
- 自动创建或更新 Electric Capital PR，并跟踪状态。
- 奖励进度展示和激励领取按钮占位。

第一期暂不实现：

- USDC 自动发放及链上奖励合约。
- 用户自行解除 GitHub 绑定或绑定多个钱包。
- 自动判断代码质量或自动批准贡献。
- 绕过 Electric Capital 维护者直接合并 PR。

### 2.2 基本原则

- 一名用户只能绑定一个 GitHub 账号，一个 GitHub 账号也只能绑定一名用户。
- 钱包地址、GitHub 用户 ID 和贡献作者身份均需去重。
- 每周人数按“审核通过的唯一开发者人数”计算，不按提交链接数量计算。
- 项目内部审核通过不等于已经被 Electric Capital 收录。
- Electric Capital 是否最终收录，以对应 PR 被其维护者合并为准。

## 3. 用户身份与权限

| 功能 | 普通用户 | Admin |
|---|---:|---:|
| OKX 钱包登录 | 是 | 是 |
| 绑定 GitHub | 是 | 可查看 |
| 登记项目仓库 | 是 | 可查看及审核 |
| 提交每周代码贡献 | 是 | 可查看及审核 |
| 查看个人每周进度 | 是 | 可查看全部用户 |
| 查看奖励进度 | 是 | 可查看及管理 |
| 查看本周完成人数 | 否 | 是 |
| 审核代码贡献 | 否 | 是 |
| 加入 Electric Capital 批次 | 否 | 是 |
| 创建或更新 Electric Capital PR | 否 | 是 |
| 查看 Electric Capital 状态 | 仅自己的项目 | 全部项目 |
| 管理激励领取状态 | 否 | 是 |

Admin 身份不能通过前端选择产生，应由后台白名单或角色权限表配置。

## 4. 业务统计与激励规则

### 4.1 有效开发者定义

用户在一个统计周内同时满足以下条件，才算完成该周贡献：

- 已通过钱包签名登录，并绑定唯一 GitHub 账号。
- 提交了有效的 GitHub 仓库、Commit 或 Pull Request 链接。
- 代码提交时间位于对应统计周期内。
- GitHub 作者与绑定账号匹配。
- 贡献包含有意义的原创代码。
- 贡献通过 Admin 或技术审核人审核。

以下内容不计入有效贡献：

- 仅修改 README、空格或格式。
- 复制其他项目但没有实质开发。
- 继承 Fork 仓库原有历史的提交。
- 机器人账号产生的提交。
- 仅负责合并、但没有原创代码的维护者。
- 重复提交相同 Commit 或 PR。
- 与 KiteAI 技术方向没有实质关系的项目。

### 4.2 周度与 MAD 口径

默认一个自然月分为四个统计周，起止时间由 Admin 配置。周度状态包括：未开始、待审核、需修改、已完成和未通过。每名开发者每周无论提交多少条贡献，完成人数只计算一次。

系统分别展示：

1. **内部审核数据**：已经通过项目技术审核的唯一 GitHub 作者数。
2. **Electric Capital 数据**：已经通过 Open Dev Data PR 登记并归入 KiteAI 生态的数据。

内部看板不得把“内部审核通过”直接显示为“Electric Capital 已统计”。

### 4.3 激励规则

每月设置 50–60 个参与席位：

| 完成情况 | 奖励结果 |
|---|---:|
| 只完成第 1–2 周 | 无奖励 |
| 完成至第 3 周 | 25 USDC |
| 完成至第 4 周 | 累计 40 USDC |
| 未通过技术审核 | 不计入 |
| 重复或无效贡献 | 不计入 |

每月 50 个基础奖励席位对应最高预算：`50 × 40 USDC = 2,000 USDC`。未领取或未完成产生的剩余预算可用于候补开发者或优质项目额外奖励。

奖励分为两个状态：

- **奖励已解锁**：用户完成规定周数并通过技术审核。
- **奖励可领取**：同时满足最终发放条件，例如项目已经完成 Electric Capital 登记。

是否必须等 Electric Capital PR 合并后才能领取奖励，需要在领取功能开发前最终确认。

## 5. 用户完整操作流程

### 5.1 钱包登录

1. Admin 导入 50～60 人参与白名单，每个人必须登记唯一的钱包地址。
2. 用户点击“连接 OKX 钱包”。
3. 系统检查白名单并请求切换或添加 KiteAI 链。
4. 后端生成一次性登录随机码。
5. 用户用钱包签署包含域名、地址、Chain ID、随机码和时间的信息。
6. 后端验证签名后激活白名单成员并创建登录会话。
7. 首次登录的用户进入 GitHub 绑定页面。

KiteAI 需要提供网络名称、Chain ID、RPC、区块浏览器和原生代币符号。EVM 接入可参考 [OKX Wallet EVM SDK](https://web3.okx.com/zh-hans/onchainos/dev-docs/wallet/dapp-connect/app-connect-evm-sdk)。

### 5.2 GitHub 绑定

1. 用户点击“绑定 GitHub”，进入 GitHub OAuth 授权。
2. 系统取得 GitHub User ID、用户名和头像。
3. 后端检查该 GitHub User ID 是否已绑定其他用户。
4. 未绑定则完成绑定；已绑定则拒绝，并提示联系 Admin。

身份判断必须使用稳定的 GitHub User ID。用户改名后只更新展示用户名。解绑和换绑由 Admin 审核，防止一个开发者用多个钱包重复参与。

### 5.3 项目登记

用户选择“自建开源项目”或“KiteAI 官方仓库贡献”。自建项目填写：

- GitHub 仓库链接、项目名称和简介。
- 对应的 KiteAI 技术或 Bounty 方向。
- KiteAI 的实际集成方式和预计开发内容。
- 默认分支，以及可选演示地址和补充说明。

系统检查仓库是否公开、是否重复登记、Owner 是否匹配、是否为 Fork，以及是否存在有效代码和默认分支。

多人项目可以登记成员，但每名成员必须单独登录、绑定 GitHub，并提交自己产生的代码贡献。

### 5.4 每周贡献提交

用户选择项目和统计周，提交 Commit、Pull Request 或 Release 链接，并填写本周完成内容及与 KiteAI 的关联说明。提交后状态变为“待审核”。截止前允许补充材料，但系统保留修改历史。

### 5.5 Admin 审核

Admin 查看钱包、GitHub 身份、项目、贡献链接、Commit 作者、提交时间、代码变更、项目方向和历史记录，可以选择：

- 审核通过。
- 要求修改。
- 拒绝。
- 添加内部备注或指定技术审核人。

通过后，用户该周显示“已完成”，周度唯一开发者人数增加一人。新的外部项目仓库进入 Electric Capital 待登记队列；已完成登记的仓库不重复申请。

## 6. Electric Capital 登记流程

### 6.1 业务含义

系统不是把开发者代码合并进 Electric Capital 仓库，而是登记开发者的 GitHub 仓库与 KiteAI 生态的归属关系：

1. Admin 将审核通过的新仓库加入登记批次。
2. 系统在工作仓库中生成 Open Dev Data migration 文件。
3. 系统执行格式校验。
4. 系统向 `electric-capital/open-dev-data` 创建或更新 Pull Request。
5. 等待 Electric Capital CI 和维护者审核。
6. Electric Capital 维护者决定是否合并。
7. 系统同步 PR 状态。

### 6.2 Admin 按钮

单个项目显示“加入本周 EC 批次”。批次页依次提供：

- 生成登记文件。
- 执行格式校验。
- 创建 Electric Capital PR。
- 更新 Electric Capital PR。
- 查看 PR。

产品中不得使用“直接合并到 Electric Capital”作为按钮文案。

### 6.3 批量登记策略

建议每周集中创建一个 PR，而不是每个用户单独创建 PR：周末截止提交，随后完成技术审核和资料补充，再把多个新仓库写入同一批 migration 并发起 PR。

同一仓库只登记一次。登记完成后，后续每周产生的新 Commit 由 Electric Capital 的数据系统从该仓库读取，无需重复执行 `repadd`。

如果 Open Dev Data 中已经存在 KiteAI 生态，新增仓库的记录类似：

```text
repadd KiteAI https://github.com/example/example-repository
```

如果 KiteAI 生态尚不存在，则首个 PR 需要先创建生态记录。具体 migration 命令及格式以 [Electric Capital Open Dev Data](https://github.com/electric-capital/open-dev-data) 的最新规则为准。

### 6.4 自动化与状态

系统使用 OpenBuild 管理的 GitHub App 或服务账号同步仓库、创建批次分支、生成文件、执行 `uvx open-dev-data validate`、提交文件并创建 PR，再通过 GitHub Webhook 或定时任务同步结果。

Electric Capital 状态包括：

- 尚未加入批次。
- 已加入批次。
- 文件生成中。
- 校验失败。
- 等待创建 PR。
- PR 已创建。
- CI 失败。
- Electric Capital 审核中。
- 要求修改。
- 已合并。
- 已关闭未合并。

全部操作需要具备幂等性，避免连续点击产生重复记录、分支或 PR。

## 7. 页面设计

### 7.1 用户端

用户端包括：

- **活动首页**：项目介绍、本月目标、MAD 进度、奖励规则、活动时间和登录按钮。
- **用户看板**：钱包、GitHub、参与项目、本月四周进度、奖励进度、EC 状态和下一步提示。
- **项目与贡献**：项目信息、每周提交、审核意见、修改入口、EC PR 链接。
- **激励领取**：预计奖励、已解锁奖励、可领取奖励和领取条件。

领取功能未开放时，按钮保持禁用并显示“领取功能即将开放”。

### 7.2 Admin 后台

首页核心指标：

- 本周登记、提交、审核通过、待审核、需修改和未通过的唯一开发者人数。
- 本月累计有效作者数，以及距离 15、35、50 人目标的差额。
- EC 待登记、PR 审核中和已合并的仓库数。
- 已解锁和预计发放的奖励金额。

首页最主要的指标为“本周完成贡献人数”，其口径是本周至少一项贡献审核通过的唯一 GitHub 作者数。

后台还包括审核队列、Electric Capital 批次中心和奖励管理页面，并支持按月份、周次、方向、审核状态、审核人、项目类型、EC 状态、GitHub 用户名和钱包地址筛选。

## 8. 核心数据结构

| 数据表 | 主要字段 |
|---|---|
| users | 用户 ID、钱包地址、Chain ID、角色、状态、创建时间 |
| wallet_nonces | 钱包地址、随机码、到期时间、使用状态 |
| github_accounts | 用户 ID、GitHub User ID、用户名、头像、绑定时间 |
| campaigns | 活动名称、月份、起止时间、目标 MAD、状态 |
| campaign_weeks | 活动 ID、周次、开始时间、截止时间 |
| repositories | Owner、名称、URL、默认分支、Fork 状态、项目方向 |
| project_members | 项目 ID、用户 ID、GitHub 身份、成员角色 |
| submissions | 用户、项目、统计周、贡献链接、说明、审核状态 |
| submission_reviews | 提交 ID、审核人、结果、意见、审核时间 |
| ec_batches | 批次编号、分支、Migration 文件、PR 编号、状态 |
| ec_batch_items | 批次 ID、仓库 ID、处理状态、失败原因 |
| reward_entitlements | 用户、月份、完成周数、解锁金额、可领取金额 |
| reward_claims | 用户、金额、领取状态、交易哈希、失败原因 |
| audit_logs | 操作人、操作类型、对象、修改前后数据、时间 |

必须设置 GitHub User ID、GitHub 绑定的用户 ID、规范化仓库 URL等唯一约束，并限制同一用户、统计周及贡献链接的重复记录。

## 9. 接口规划

### 用户认证

- `POST /auth/wallet/nonce`
- `POST /auth/wallet/verify`
- `POST /auth/logout`
- `GET /auth/github`
- `GET /auth/github/callback`
- `GET /me`
- `GET /me/github`

### 项目及提交

- `POST /projects`
- `GET /projects/:id`
- `POST /submissions`
- `PUT /submissions/:id`
- `GET /me/progress`
- `GET /me/rewards`

### Admin

- `GET /admin/dashboard`
- `GET /admin/submissions`
- `POST /admin/submissions/:id/approve`
- `POST /admin/submissions/:id/request-changes`
- `POST /admin/submissions/:id/reject`
- `POST /admin/repositories/:id/ec-queue`

### Electric Capital

- `POST /admin/ec-batches`
- `POST /admin/ec-batches/:id/generate`
- `POST /admin/ec-batches/:id/validate`
- `POST /admin/ec-batches/:id/create-pr`
- `POST /admin/ec-batches/:id/sync`
- `GET /admin/ec-batches/:id`

### 激励领取占位

- `GET /rewards/eligibility`
- `POST /rewards/claim`

领取功能未启用时，接口只返回功能状态，不产生链上交易。

## 10. 安全与风控

- 钱包登录使用具有有效期的一次性随机码，使用后立即失效。
- GitHub OAuth 校验 `state`，建议使用 PKCE；Token 加密保存并采用最小权限。
- 用户身份使用 GitHub User ID 判断，不只依赖用户名。
- GitHub Webhook 必须验证签名。
- Admin 接口执行服务端权限检查。
- 审核、状态修改和 EC 操作全部写入审计日志。
- 创建 PR 等接口需限流并支持幂等。
- 禁止用户通过前端参数操作其他用户、项目或统计周的数据。
- 钱包和 GitHub 换绑必须保留历史记录。

## 11. 关键异常处理

| 异常 | 处理方式 |
|---|---|
| 连接错误网络 | 提示切换到 KiteAI 链 |
| 钱包签名过期 | 重新获取随机码并签名 |
| GitHub 已绑定其他钱包 | 拒绝绑定并联系 Admin |
| GitHub 用户改名 | 按 GitHub User ID 更新展示名 |
| 仓库链接重复 | 提示仓库已经登记 |
| 仓库是 Fork | 转人工审核，默认不直接通过 |
| 作者与绑定账号不同 | 标记异常并禁止自动通过 |
| 相同 Commit 重复提交 | 去重，不重复计算 |
| 重复点击 EC 按钮 | 返回已有批次或 PR |
| Open Dev Data 校验失败 | 保存日志，修复后重试 |
| EC PR 被要求修改 | 进入修改处理队列 |
| EC PR 关闭但未合并 | 不标记为已登记 |
| EC 审核跨月 | 保留原贡献月份和周度完成日期 |

## 12. 开发阶段

### 第一阶段：身份、提交和审核

完成钱包登录、GitHub 绑定、项目登记、周度提交、Admin 审核，以及用户与 Admin 看板。

### 第二阶段：Electric Capital 自动化

完成批次管理、Migration 生成和校验、PR 创建与更新、状态同步及仓库防重复登记。

### 第三阶段：激励领取

确定奖励资格，接入 USDC 发放、合约或托管账户、交易状态、失败重试及财务对账。

## 13. MVP 验收标准

- 用户能使用 OKX 钱包在 KiteAI 链完成签名登录。
- 一个 GitHub 账号不能绑定两个钱包用户。
- 用户可以登记项目并提交每周贡献。
- Admin 可以通过、退回或拒绝提交。
- Admin 可以看到本周审核通过的唯一开发者人数。
- 用户可以看到每一周的提交与审核状态。
- 系统正确计算完成 3 周和 4 周对应的奖励进度。
- 新项目通过后可以加入 EC 批次。
- 系统可以生成并校验 Open Dev Data migration 文件。
- 校验通过后可以创建 Electric Capital PR。
- 看板可以区分内部通过、EC 审核中和 EC 已合并。
- 重复点击不会创建重复记录或 PR。
- Admin 操作均可通过审计日志追溯。

## 14. 开发前待确认事项

- KiteAI 链的 Chain ID、RPC 和区块浏览器。
- Electric Capital 中 KiteAI 的标准生态名称及当前是否已经存在。
- 用于创建 EC PR 的 GitHub App 或服务账号。
- 每月四个统计周的准确起止时间、时区和周末截止时间。
- 有效代码贡献的最低审核标准。
- 一个开发者是否允许同时参与多个项目。
- 奖励是否必须等 EC PR 合并后才能领取。
- 每月奖励席位固定为 50 人还是允许扩展至 60 人。
- 候补和优质项目额外奖励的审批规则。
- Admin 和技术审核人名单。
