export const contributionDirections = [
  {
    value: "x402-service",
    label: "x402 付费服务",
    description: "将 HTTP API 包装为可发现、可调用的 x402 服务。",
    repos: [{ label: "kite-x402-services", url: "https://github.com/gokite-ai/kite-x402-services" }],
    stack: "TypeScript / Express、Go / Gin，或官方模板支持的等价技术栈",
    acceptance: ["未付费请求返回正确的 402", "verify → upstream → settle 顺序正确", "每个端点有可验证的 2xx 示例", "服务清单通过 JSON Schema 校验", "提交本人真实付费调用记录"],
    evidence: "服务地址、清单文件、校验结果、示例请求与响应、交易哈希或调用记录。",
    risks: "上游 API 条款、价格与可用性需要确认；上游失败时不得提前结算。",
  },
  {
    value: "x402-wrapper",
    label: "x402 Wrapper 模板",
    description: "为其他语言补齐可运行、可测试的 Wrapper 模板。",
    repos: [{ label: "kite-x402-services", url: "https://github.com/gokite-ai/kite-x402-services" }],
    stack: "Python/FastAPI、Rust/Axum、Java/Spring Boot、.NET、PHP/Laravel、Elixir/Phoenix、Bun/Hono、Deno 或 Cloudflare Workers",
    acceptance: ["行为与官方模板一致", "使用相同环境变量和 /v1/* 路由前缀", "附可运行示例服务", "测试覆盖未付费 402 与付费代理", "发布到对应语言包管理器"],
    evidence: "模板仓库、运行命令、断言测试、包管理器发布地址。",
    risks: "结算顺序、网络标识和错误语义必须与官方模板保持一致。",
  },
  {
    value: "x402-evaluation",
    label: "x402 服务准入评估",
    description: "评估服务真实性、计费行为与稳定性并输出证据。",
    repos: [{ label: "kite-x402-services", url: "https://github.com/gokite-ai/kite-x402-services" }],
    stack: "Node.js / TypeScript，定时任务、HTTP 采集器与结构化报告存储",
    acceptance: ["至少评估 200 个候选端点", "输出通过 / 待定 / 拒绝及理由证据", "至少 3 个结果经人工复核", "说明误判原因", "对已纳入服务持续巡检并告警"],
    evidence: "评估报告、原始 402 响应、付费调用审计记录、复核结论与告警记录。",
    risks: "评估支出必须可控可审计；准入决策权仍归 KiteAI。",
  },
  {
    value: "passport-skills-eval",
    label: "Passport Skills Eval Runner",
    description: "将 Passport 行为用例变成可执行、可评分的 CI Runner。",
    repos: [{ label: "passport-skills", url: "https://github.com/gokite-ai/passport-skills" }],
    stack: "以官方仓库现有测试格式为准，接入 GitHub Actions",
    acceptance: ["完整执行全部用例并逐条给出断言", "稳定复现已知失败用例", "可接入 GitHub Actions", "补充用例沿用现有格式"],
    evidence: "Runner 源码、完整运行报告、CI 工作流链接、失败用例复现记录。",
    risks: "外部服务和账户状态可能影响测试，应记录环境与可复现条件。",
  },
  {
    value: "passport-defi-authorization",
    label: "Passport DeFi 授权层",
    description: "构建交易意图解码与授权策略校验工具。",
    repos: [{ label: "passport-skills", url: "https://github.com/gokite-ai/passport-skills" }],
    stack: "TypeScript，按协议拆分 Uniswap、Moonwell、Morpho、Aerodrome、Avantis 等适配器",
    acceptance: ["主要操作给出正确意图解析", "附真实交易测试向量", "策略引擎覆盖至少 8 条拒绝路径", "拒绝时给出明确原因", "执行前输出预期结果与敞口变化"],
    evidence: "交易 calldata、解析结果、策略配置、拒绝测试、模拟与风险预检报告。",
    risks: "涉及真实资金；未经额外审计不得作为生产风控组件。",
  },
  {
    value: "seller-agent",
    label: "垂类 Seller Agent",
    description: "打包可发现、报价、履约并结算的卖方 Agent。",
    repos: [{ label: "a2a-coordination-extension", url: "https://github.com/gokite-ai/a2a-coordination-extension" }],
    stack: "待 A2A 协议上线后，按数据、算力、内容生成、翻译、数据抓取等垂类实现",
    acceptance: ["跑通上架 → 发现 → 报价 → 履约 → 结算", "提交含交易哈希的完整执行记录", "附任务成本明细"],
    evidence: "Agent 清单、发现与报价记录、履约输出、结算交易哈希、成本明细。",
    risks: "本方向待 A2A 协议上线后执行；需要控制交易成本和服务质量。",
  },
] as const;

export type ContributionDirection = (typeof contributionDirections)[number]["value"];

export function directionLabel(value: string) {
  return contributionDirections.find((item) => item.value === value)?.label ?? value;
}
