# Electric Capital 活跃开发者计入规则

版本：V1.0  
核对日期：2026-09-15  
适用范围：KiteAI Bounty Dashboard 的参与者提交、AI 预检查、Admin 审核和 EC 仓库登记

## 1. 核心结论

Electric Capital 的 Open Dev Data PR 登记的是“仓库属于哪个生态”，不是逐条登记开发者的 Commit。

| 场景                                 | 本平台处理                                | 是否创建 EC PR |
| ------------------------------------ | ----------------------------------------- | -------------: |
| 首次提交一个尚未归入 KiteAI 的仓库   | AI 分析仓库，Admin 审核，生成仓库登记内容 |             是 |
| 后续提交同一已登记仓库的新 Commit    | AI 分析本周 Commit，Admin 审核并记录贡献  |             否 |
| 改为提交另一个尚未归入 KiteAI 的仓库 | 按首次仓库流程检查和登记                  |             是 |
| 仓库已经在上游 taxonomy 归入 KiteAI  | 保存上游证据，直接进入每周 Commit 审核    |             否 |
| 相同 Commit 重复提交                 | 判定为重复，不重复统计                    |             否 |

同一仓库只应执行一次有效的 `repadd KiteAI <repository-url>`。仓库登记完成后，后续开发活动由 Electric Capital 的数据处理流程从该公开仓库读取，不需要为每个 Commit 重复创建 Open Dev Data PR。

EC PR 被合并只证明仓库与 KiteAI 的 taxonomy 关联被接受。开发者是否计为活跃、被归入哪种活跃类型，以及 KiteAI 是否展示在 Developer Report，仍由 EC 后续的数据抓取、分类、代码指纹、身份去重和展示规则决定。

## 2. 三个不同的结果

### 2.1 仓库被归入 KiteAI

满足以下任一情况，平台才可把仓库状态标记为“已登记”：

1. 仓库已经存在于当前 Open Dev Data taxonomy，并归入 `KiteAI`；或
2. 本平台创建的登记 PR 已被 Electric Capital 合并，并且合并后的上游 taxonomy 可以重新导出并查询到该仓库与 `KiteAI` 的关联。

仅有以下状态均不等于已登记：内部审核通过、migration 生成成功、CI 通过、PR 已创建、Review Approved、PR 已关闭但未合并。

### 2.2 开发者被计为活跃开发者

根据 Electric Capital 公开的方法说明，至少需要满足以下条件：

| 条件       | 官方公开规则                                         | 本平台审核要求                                   |
| ---------- | ---------------------------------------------------- | ------------------------------------------------ |
| 仓库范围   | 当前重点统计开源仓库                                 | GitHub 仓库必须公开且可访问                      |
| 生态归属   | 仓库活动按照 taxonomy 和分类结果归入生态             | 仓库需要存在可核实的 KiteAI 关联                 |
| 原创作者   | 只把原创代码作者计为开发者                           | Commit 作者须与绑定的 GitHub 身份一致            |
| 新代码     | Fork 中只有新增代码计入开发活动                      | 排除仅同步上游、仅合并上游历史的提交             |
| 非复制代码 | 使用代码指纹识别复制、粘贴和重复代码，并归因给原作者 | AI 标记大段复制、模板照搬和重复 Commit 风险      |
| 非 Bot     | EC 会识别并移除 Bot 提交                             | 排除 GitHub Bot 类型、`[bot]` 账号及自动生成提交 |
| 有效时间   | EC 按 Commit、作者、提交者及关联日期处理活动         | Commit 必须落在本活动当前统计周内                |
| 身份去重   | 同一开发者的多个账号可能被合并为一个开发者实体       | 不允许同一 GitHub 身份绑定多个参与者             |

EC 会分析所有分支和 Tag 中的 Commit，不只分析默认分支。官方还会综合文件、代码行、Commit message、committer、author 和日期进行代码指纹判断。

本平台的审核通过只是活动内部资格判断，不能替代 EC 的统计结果。EC 没有公开一套能够保证计入的最低代码行数、最低 Commit 数量或固定审核时限，因此 AI 和 Admin 都不能承诺某条 Commit 一定会被计入。

### 2.3 KiteAI 展示在 Developer Report

“有开发者活动被计入 KiteAI”和“KiteAI 在网站拥有独立榜单页面”不是同一件事。

EC 当前公开的生态资格条件为满足下列任意一项：

- 网络价值排名前 200；
- 私募市场估值超过 5 亿美元；
- 超过 50 名月活跃开发者。

在符合资格的生态中，网站再按照 Full-time developer 数量选取前 100 个生态展示独立页面和图表，名单按月更新。因此达到 50+ 月活属于展示资格之一，不代表一定进入最终展示名单。

## 3. 时间窗口和活跃类型

- Monthly Developer：使用滚动 28 天窗口计算开发者活动。
- 开发者身份：原创代码作者计为开发者；仅负责合并 Pull Request 的人不因此成为该项目的活跃开发者。
- Full-time、Part-time 和 One-time：由 EC 按持续活跃模式划分。

EC 当前 About 页面同时出现“基于 84 天滚动窗口的持续活跃模式”和“滚动 28 天内有 10 天或以上代码贡献属于 Full-time”的描述。两段公开表述的口径并不完全一致。本平台不得把每周一次提交直接宣传为 Full-time，也不得自行计算并对外宣称 EC Full-time 结果；需要以后续 EC 实际数据和最新方法说明为准。

## 4. 首次提交的 AI 检查

首次提交指参与者提交的仓库尚未在上游 taxonomy 归入 KiteAI。系统先执行确定性检查，再调用 GLM 分析仓库内容。

### 4.1 确定性检查

1. 仓库 URL、仓库所有者和默认分支可以通过 GitHub API 验证。
2. 仓库公开、未归档、可读取代码树和 Commit。
3. 提交的 Commit 存在，并属于该仓库。
4. Commit 作者与参与者绑定的 GitHub User ID 一致。
5. Commit 日期属于当前统计周。
6. 排除 Merge Commit、Bot、Fork 历史提交和已提交过的 Commit SHA。
7. 查询当前 Open Dev Data taxonomy 和未关闭 PR，避免重复 `repadd`。
8. 生成的 migration 文件名和 DSL 必须通过 Open Dev Data 校验。

### 4.2 GLM 仓库分析

GLM 需要读取仓库简介、README、依赖文件、关键源代码、测试、部署说明和参与者提交的 Commit diff，输出：

- 仓库实际解决的问题；
- 使用了哪些 KiteAI SDK、合约、Passport、x402、A2A 或官方仓库能力；
- KiteAI 关联证据所在的文件和代码位置；
- 是否符合参与者选择的贡献方向；
- 是否存在空仓库、模板仓库、Fork、复制代码、自动生成代码或无实质 KiteAI 集成风险；
- 缺少哪些测试、说明或可复现证据；
- 建议通过、建议修改或高风险，并给出逐项理由。

### 4.3 EC PR 内容生成

PR 标题和描述不能使用固定模板替代事实分析。系统应根据仓库真实内容生成草稿，至少包含：

- 仓库名称和 URL；
- 项目用途的简要说明；
- 仓库为什么属于 KiteAI；
- 可核实的技术证据，例如依赖、代码文件、合约调用或官方工具集成；
- 代表性 Commit 链接；
- 已执行的测试或部署验证；
- migration 中新增的 `repadd` 内容。

GLM 只能生成草稿。Admin 必须核对引用的文件、Commit 和结论后，才能确认加入 EC 批次。EC 维护者拥有最终合并权。

## 5. 后续 Commit 的 AI 检查

已登记仓库的后续周次不再创建 EC PR。GLM 只分析本次 Commit 是否符合活动提交条件：

1. Commit 是否属于已登记仓库；
2. 作者是否为当前参与者绑定的 GitHub 身份；
3. Commit 是否在本周统计时间内；
4. 是否包含本周新增的实质代码；
5. 是否为 Merge Commit、Bot 提交、上游同步或 Fork 历史；
6. 是否存在复制代码、仅格式化、仅改文案或自动生成内容风险；
7. 本次代码是否仍与 KiteAI 生态或已选择的贡献方向相关；
8. 是否提供测试、运行结果、部署地址或可复现证据。

AI 检查不通过时，页面应在提交前给出明确提醒和缺失项。参与者可以修改代码或补充证据后重新提交。AI 不直接批准、拒绝或改变奖励资格，最终内部审核由 Admin 完成。

## 6. 平台状态与幂等规则

平台应以标准化后的 `owner/repository` 作为仓库唯一键，并保存以下状态：

```text
UNKNOWN -> AI_CHECKING -> REVIEW_REQUIRED -> EC_QUEUED
        -> PR_OPEN -> MERGED -> VERIFIED
                    -> CHANGES_REQUESTED
                    -> CLOSED_UNMERGED
```

- `VERIFIED`：上游 PR 已合并，并在当前 taxonomy 中确认归属 KiteAI。
- 同一仓库处于 `EC_QUEUED`、`PR_OPEN`、`MERGED` 或 `VERIFIED` 时，不得再创建第二个登记 PR。
- 多名参与者提交同一新仓库时，共享同一个仓库登记记录；每人的周度 Commit 仍单独审核和统计。
- EC 审核跨周或跨月时，保留原 Commit 的提交周次；登记完成后重新计算相关周度资格。
- EC PR 关闭未合并时，保存原因并允许 Admin 修正后更新原 PR 或重新申请，但不得伪造成已登记。

## 7. 不能作为计入保证的情况

以下情况单独出现时，都不能证明参与者已被 EC 计为 KiteAI 活跃开发者：

- 在本平台提交了 Commit；
- 本平台 Admin 审核通过；
- Open Dev Data migration 校验通过；
- EC PR 已创建或 CI 已通过；
- EC PR 已合并，但 Commit 不是原创代码或作者被识别为 Bot；
- 只负责合并他人的 PR；
- 仓库来自 Fork，且提交只是同步上游历史；
- 使用多个 GitHub 账号制造人数；
- Commit message 提到了 KiteAI，但仓库代码没有可核实关联；
- 同一个仓库重复提交 `repadd`；
- 每周提交一次，但未达到 EC 对 Full-time 的实际活跃分类。

## 8. 官方来源与规则边界

- [Electric Capital Developer Report：About & Methodology](https://www.developerreport.com/about)
- [Electric Capital Open Dev Data 仓库](https://github.com/electric-capital/open-dev-data)
- [Open Dev Data taxonomy 更新与 DSL 格式](https://github.com/electric-capital/open-dev-data#how-to-update-the-taxonomy)

本文件收录的是截至核对日期能从官方公开材料确认的规则，并把本平台审核标准单独标明。Electric Capital 使用部分专有工具和持续更新的方法，官方也没有公开全部分类器参数。因此，本文件用于降低错误提交和漏检风险，不能构成“必然被计入”或“必然成为 Full-time developer”的承诺。
