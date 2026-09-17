# KiteAI 开源 Bounty 计划 · 开发者参与者手册 (Lu.ma 指南)

欢迎参加 **KiteAI 开源开发者激励计划（KiteAI Open Source Bounty Program）**！

本计划旨在鼓励全球开发者围绕 KiteAI 技术生态构建具有实用价值的开源项目。我们将为持续交付有效原创代码的开发者提供 USDC 激励支持，并协助符合条件的开源仓库完成全球权威开发者榜单 **Electric Capital (Open Dev Data)** 官方收录！

---

## 🎁 激励机制与权益

首期活动以 **4 周为一个奖励周期**（每月设置 50–60 个参与席位）：

| 完成情况 | 奖励标准 | 状态说明 |
|---|---|---|
| 完成第 1–2 周 | — | 基础参与记录 |
| **完成至第 3 周** | **25 USDC** | 解锁初阶奖励 |
| **完成至第 4 周** | **累计 40 USDC** | 解锁全额奖励 |

> 💡 **额外生态权益**：
> 1. **Electric Capital 官方生态收录**：审核通过的项目仓库将统一由官方团队向上游 `electric-capital/open-dev-data` 发起收录 PR，永久载入开源生态资产。
> 2. **KiteAI 核心生态支持**：优质项目将优先获得 KiteAI 官方生态基金对接、算力/技术扶持及下一期进阶激励席位。

---

## 📅 活动时间与统计周期（北京时间 UTC+8）

活动每周以 7 天为一个独立周期（严格遵循周一至周日 `[周一 00:00, 周日 24:00)` 闭开区间规则），请在当周截止前完成代码提交：

- **Week 1**：9 月 14 日 00:00 – 9 月 20 日 24:00（周一至周日）
- **Week 2**：9 月 21 日 00:00 – 9 月 27 日 24:00（周一至周日）
- **Week 3**：9 月 28 日 00:00 – 10 月 4 日 24:00（周一至周日）
- **Week 4**：10 月 5 日 00:00 – 10 月 11 日 24:00（周一至周日）
- **奖励核算与结算窗口**：10 月 12 日起统一复核并开放后续领取。

---

## 🛠 六大开发技术方向（Tracks）

开发者可围绕以下任一技术方向进行自主项目开发或工具扩展，官方提供了参考模板与验收标准：

### 1. x402 付费服务 (`x402-service`)
- **方向说明**：将 HTTP API 包装为可被 Agent 发现、调用的 x402 协议服务。
- **技术栈**：TypeScript / Express、Go / Gin 等官方模板支持的技术栈。
- **验收重点**：未付费返回标准 402；按 `verify → upstream → settle` 顺序结算；每个端点具备可验证的 2xx 示例；服务清单通过 JSON Schema 校验，并提交本人真实付费调用记录。
- **参考仓库**：[gokite-ai/kite-x402-services](https://github.com/gokite-ai/kite-x402-services)

### 2. x402 Wrapper 多语言模板 (`x402-wrapper`)
- **方向说明**：为其他语言补齐可运行、可测试的 x402 包装器模板。
- **技术栈**：Python/FastAPI、Rust/Axum、Java/Spring Boot、Hono、Cloudflare Workers、Deno、PHP/Laravel 等。
- **验收重点**：接口与行为与官方一致，使用相同环境变量与 `/v1/*` 前缀，包含未付费 402 与代理测试用例，发布至对应语言包管理器。
- **参考仓库**：[gokite-ai/kite-x402-services](https://github.com/gokite-ai/kite-x402-services)

### 3. x402 服务准入评估系统 (`x402-evaluation`)
- **方向说明**：自动化评估服务真实性、计费稳定性与准入指标并输出合规证据。
- **技术栈**：Node.js / TypeScript、定时任务采集器、结构化分析报告存储。
- **验收重点**：评估至少 200 个候选端点，输出审计报告、原始 402 响应、付费审计记录及告警机制。
- **参考仓库**：[gokite-ai/kite-x402-services](https://github.com/gokite-ai/kite-x402-services)

### 4. Passport Skills Eval Runner (`passport-skills-eval`)
- **方向说明**：将 Passport Agent 行为测试用例打包为可自动化执行、评分的 CI Runner。
- **技术栈**：沿用官方仓库现有规范，接入 GitHub Actions。
- **验收重点**：完整执行全部用例并给出逐条断言，稳定复现已知失败用例并输出运行报告。
- **参考仓库**：[gokite-ai/passport-skills](https://github.com/gokite-ai/passport-skills)

### 5. Passport DeFi 授权风控层 (`passport-defi-authorization`)
- **方向说明**：构建交易意图解码与链上授权策略拦截校验工具。
- **技术栈**：TypeScript，支持 Uniswap、Moonwell、Morpho、Aerodrome、Avantis 等协议适配。
- **验收重点**：正确解析交易 calldata 意图；覆盖至少 8 条拒绝策略路径；执行前输出敞口变化与风险预检报告。
- **参考仓库**：[gokite-ai/passport-skills](https://github.com/gokite-ai/passport-skills)

### 6. 垂类 Seller Agent (`seller-agent`)
- **方向说明**：构建垂直领域（数据、算力、内容生成、翻译等）可自主报价、履约与结算的卖方 Agent。
- **技术栈**：基于 A2A（Agent-to-Agent）协议规范。
- **验收重点**：跑通“上架 → 发现 → 报价 → 履约 → 结算”完整闭环，附带交易哈希及任务成本明细。
- **参考仓库**：[gokite-ai/a2a-coordination-extension](https://github.com/gokite-ai/a2a-coordination-extension)

---

## 📝 参与流程指南（4 步搞定）

### 第 1 步：确认白名单资格
- 本活动采用白名单邀请制（首期 50–60 席位）。
- 提交报名前请确保已向主办方登记用于接收奖励与签名的 **EVM 钱包地址**。

### 第 2 步：登录活动看板并连接钱包
1. 访问活动官方看板系统。
2. 使用 **OKX 钱包**（或 MetaMask）连接，系统将提示切换至 **KiteAI 网络**：
   - 网络名称：`KiteAI Testnet` / `KiteAI Mainnet`
   - Chain ID：`2368` (测试网) / `2366` (主网)
   - RPC URL：`https://rpc-testnet.gokite.ai/` 或 `https://rpc.gokite.ai/`
   - 区块浏览器：`https://testnet.kitescan.ai/` 或 `https://kitescan.ai/`
3. 签名一条一次性随机码（EIP-191 认证，完全离线签名，**无需消耗 Gas**）完成安全登录。

### 第 3 步：绑定唯一 GitHub 账号
- 登录后点击 **“绑定 GitHub”** 进行 OAuth 授权。
- ⚠️ **重要约束**：**一个钱包只能绑定一个 GitHub 账号，一个 GitHub 账号也只能绑定一个钱包**。后续所有提交的代码 Commit 必须出自该绑定账号。

### 第 4 步：每周提交代码贡献
1. 进入看板中的 **“周度提交”** 区域。
2. 填写你本周贡献的 GitHub 公开开源仓库 URL。
3. 系统将自动拉取你在当周周期内产生的有效 Commit，勾选确认本周的核心贡献。
4. 提交后系统会自动调用 **GLM AI 预审模型** 进行原创度与合规预检（约需数十秒），在看板上实时展示分析进度和建议。
5. 等待 Admin 人工审核；如被退回要求“需补充修改”，可在当周截止前更新代码并重新提交。

---

## ⚖️ 代码审核与有效性规则（防作弊标准）

为保障生态质量与 Electric Capital 的收录要求，所有提交将经过 **系统确定性校验 + AI 预审 + 管理员人工审核**。

### ✅ 判定为有效贡献的条件：
1. **公开与原创**：仓库必须公开、未归档、且非无意义 Fork。
2. **作者一致**：Commit 的 Author 必须与绑定的 GitHub 账号严格一致。
3. **周期吻合**：Commit 的生成时间必须落在当周统计周期之内。
4. **实质代码**：包含与 KiteAI 技术方向直接相关的业务代码、逻辑实现或测试用例。

### ❌ 绝对无效的提交（一经发现作废当周资格）：
- 仅修改 README、文档排版、调整空格、代码格式化（Lint / Prettier）。
- 直接复制第三方开源项目且无实质逻辑改动。
- 继承 Fork 仓库原有历史的 Commit 或单纯 Sync 上游分支。
- 机器人（Bot、`[bot]`）生成的自动化提交。
- 仅执行 PR 合并而无原创代码的 Merge Commit。
- 重复提交往周已审核过的相同 Commit SHA。

---

## ❓ 常见问题（FAQ）

**Q1：我做了一个新项目，每周都需要向 Electric Capital 提 PR 吗？**  
不需要。同一个项目仓库只需由官方平台向 Electric Capital 登记一次即可。后续周次你只需在该仓库中持续开发提交新的有效 Commit，平台会自动识别并审核当周代码。

**Q2：奖励什么时候发放？如何领取？**  
奖励分为“已解锁”与“可领取”：
- 开发者完成第 3 或第 4 周要求后即解锁奖励资格；
- 最终开放领取需满足外部审核条件（关联的仓库被 Electric Capital 正式确认收录）；
- 发放将通过 KiteAI 链直接向绑定的白名单钱包地址转账。

**Q3：我和队友合作开发同一个项目，可以一起报吗？**  
可以。同一仓库支持多位开发者共同参与，但**每位开发者必须各自绑定自己的钱包和 GitHub 账号**，并提交属于自己签名的原创 Commit。

**Q4：AI 预审提示“建议修改”或“高风险”怎么办？**  
AI 预审会列出具体的风险项（如时间不符、缺乏 KiteAI 依赖或引用、说明文档不明确等）。你可以根据 AI 反馈在当周截止前提交修复 Commit，并再次在看板提交。最终结果由人工管理员复核判定。

---

## 🔗 官方资源与链接

- 🌐 **活动官方看板**：`[请替换为你的看板线上链接]`
- 📖 **KiteAI 官方开发文档**：https://docs.gokite.ai/
- 💻 **官方代码仓库与模板**：https://github.com/gokite-ai
- 💬 **开发者社区 / Telegram 群组**：`[请替换为官方社群链接]`
- 📊 **Electric Capital 榜单参考**：https://www.developerreport.com/
