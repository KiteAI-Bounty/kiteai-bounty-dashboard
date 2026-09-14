import Link from "next/link";
import { ArrowUpRight, CircleCheck, Clock3, LockKeyhole } from "lucide-react";
import type { ReactNode } from "react";
import type { WeekStatus } from "@/modules/campaigns/domain";

const statusMap: Record<WeekStatus, [string, string]> = {
  completed: ["已完成", "green"],
  awaiting_ec: ["等待 EC", "amber"],
  reviewing: ["待审核", "blue"],
  changes_requested: ["需修改", "amber"],
  rejected: ["未通过", "red"],
  not_started: ["未开始", "muted"],
  not_submitted: ["待提交", "neutral"],
  missed: ["未提交", "muted"],
};
export function StatusBadge({ status }: { status: WeekStatus }) {
  const [label, color] = statusMap[status];
  return (
    <span className={`badge ${color}`}>
      {status === "completed" ? (
        <CircleCheck size={12} />
      ) : status === "awaiting_ec" || status === "reviewing" ? (
        <Clock3 size={12} />
      ) : (
        <span className="badge-dot" />
      )}
      {label}
    </span>
  );
}
export function PageTitle({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-title">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="muted-text">{description}</p>
      </div>
      {action}
    </div>
  );
}
export function Stat({
  label,
  value,
  note,
  accent = false,
}: {
  label: string;
  value: ReactNode;
  note: string;
  accent?: boolean;
}) {
  return (
    <article className={`stat ${accent ? "accent" : ""}`}>
      <p>{label}</p>
      <strong>{value}</strong>
      <small>{note}</small>
    </article>
  );
}
export function LockedPage({ title }: { title: string }) {
  return (
    <section className="panel empty-state">
      <LockKeyhole size={32} />
      <h1>{title}</h1>
      <p>此页面需要已加入白名单的钱包签名身份。</p>
      <Link href="/" className="button dark">
        返回公开看板 <ArrowUpRight size={15} />
      </Link>
    </section>
  );
}
export function DemoNote() {
  return (
    <p className="notice">
      当前为只读页面预览，展示虚构参与者及流程状态，不代表真实登录、审核或
      Electric Capital 收录。
    </p>
  );
}

export function ProcessGuide({
  audience,
}: {
  audience: "participant" | "admin";
}) {
  const participant = audience === "participant";
  return (
    <details className="process-guide">
      <summary>
        {participant ? "参与者提交前请注意" : "管理员审核检查清单"}
      </summary>
      {participant ? (
        <ul>
          <li>
            每周提交一次本周原创代码，优先选择与 KiteAI
            官方仓库或生态工具相关的公开 GitHub 仓库。
          </li>
          <li>
            请提供公开 GitHub 仓库，以及能定位到本周 Commit 或 PR 的证据。
          </li>
          <li className="process-example-item">
            <strong>提交示例</strong>
            <a
              href="https://github.com/Anyi-zheng/kiteai-passport-layerzero/commit/f4c36d03893edebed393f58f02cb375cfc0f75ff"
              target="_blank"
              rel="noreferrer"
            >
              https://github.com/Anyi-zheng/kiteai-passport-layerzero/commit/f4c36d0
            </a>
            <span>
              仅作格式示例。完成说明：<em>Added KiteAI SDK integration and covered
              the payment flow with tests.</em>
            </span>
          </li>
          <li>
            可使用 AI 工具辅助开发，但须使用本人 GitHub 身份提交并对代码负责。
          </li>
          <li>
            仓库需要与 KiteAI 有明确关联；例如：KiteAI SDK integration、KiteAI
            contract calls 或 KiteAI developer tooling。
          </li>
          <li>新仓库会进入 Electric Capital 登记 PR，需等待 EC 审核并合并。</li>
          <li>
            奖励按真实完成周累计；EC 尚未合并时不会提前计为完成或开放领取。
          </li>
        </ul>
      ) : (
        <ul>
          <li>确认提交人钱包、GitHub 账号与白名单记录一致。</li>
          <li>
            确认仓库公开可访问，Commit 作者是参与者本人，且属于当前统计周。
          </li>
          <li>
            排除 Bot 账号、`[bot]` 作者、自动生成提交和仅负责合并 Pull Request
            的账号。
          </li>
          <li>排除 Merge Commit 及 Fork 创建前携带的历史 Commit。</li>
          <li>
            检查变更是否为真实原创代码，并与 KiteAI 的集成或生态建设有关。
          </li>
          <li>确认仓库没有重复登记；重复项目应复用已有登记证据。</li>
          <li>通过后点击“确认并提交 EC PR”，不要把它理解为直接合并。</li>
          <li>
            只有 EC PR 实际合并并完成上游复核后，才能回填完成状态和奖励资格。
          </li>
        </ul>
      )}
    </details>
  );
}
