import Link from "next/link";
import { ArrowUpRight, Github, Wallet, CalendarDays } from "lucide-react";
import { DemoNote, LockedPage, PageTitle, StatusBadge } from "@/components/ui";
import {
  getCampaignWorkspace,
  getUserProgress,
} from "@/modules/campaigns/service";
import { readEnvironment } from "@/config/env";
import { currentWeek, weekLabel } from "@/modules/campaigns/domain";
import { getCurrentUser } from "@/modules/auth/service";
import { redirect } from "next/navigation";

export default async function Dashboard() {
  if (readEnvironment(process.env).DATA_MODE !== "demo") {
    const user = await getCurrentUser();
    if (!user) return <LockedPage title="我的看板" />;
    if (user.role === "ADMIN") redirect("/admin");
    const { campaign, weeks, now, submissions } = await getUserProgress(
      user.userId,
    );
    const week = currentWeek(campaign.weeks, new Date(now));
    return (
      <>
        <PageTitle
          eyebrow="MY WORKSPACE"
          title="继续构建，持续向前。"
          description="钱包身份已经验证。绑定 GitHub 后即可进入贡献流程。"
        />
        <div className="workspace-grid">
          <section className="panel current-task">
            <p className="eyebrow">
              THIS WEEK{week ? ` · WEEK ${week.number}` : ""}
            </p>
            <h2>{user.github ? "本周待提交" : "先绑定 GitHub"}</h2>
            <p>
              {user.github
                ? "确认一个 GitHub 仓库，记录本周完成的原创代码。"
                : "GitHub 数字 ID 将与当前钱包唯一绑定。"}
            </p>
            <div className="task-date">
              <CalendarDays size={16} />
              {week ? weekLabel(week) : "当前不在首期统计周内"} · 北京时间
            </div>
            {user.github ? (
              <Link href="/submissions/current" className="button dark">
                查看提交入口 <ArrowUpRight size={15} />
              </Link>
            ) : (
              <a
                href="/api/auth/github?returnTo=/dashboard"
                className="button dark"
              >
                <Github size={15} />
                绑定 GitHub
              </a>
            )}
          </section>
          <section className="panel identity-panel">
            <h2>开发者身份</h2>
            <div>
              <Wallet size={18} />
              <span>
                <small>已验证钱包 · Kite Chain {user.chainId}</small>
                <code>
                  {user.wallet.slice(0, 8)}…{user.wallet.slice(-4)}
                </code>
              </span>
            </div>
            <div>
              <Github size={18} />
              <span>
                <small>GitHub 账号</small>
                {user.github ? `@${user.github.login}` : "尚未绑定"}
              </span>
            </div>
            <p className="muted-text">角色：开发者</p>
          </section>
        </div>
        <section className="panel">
          <div className="panel-title">
            <div>
              <h2>首期贡献轨迹</h2>
              <p>真实数据 · 等待 EC 不影响下一周提交</p>
            </div>
          </div>
          <div className="week-grid">
            {campaign.weeks.map((item, index) => (
              <article
                className={`week-card ${week?.id === item.id ? "current" : ""}`}
                key={item.id}
              >
                <span className="eyebrow">WEEK 0{item.number}</span>
                <h3>第 {item.number} 周</h3>
                <p>{weekLabel(item)}</p>
                <StatusBadge status={weeks[index].status} />
              </article>
            ))}
          </div>
        </section>
        <section className="panel empty-state">
          <Github size={30} />
          <h2>
            {submissions.length
              ? `已有 ${submissions.length} 份提交`
              : "还没有贡献记录"}
          </h2>
          <p>贡献提交功能将在下一阶段接入真实 GitHub 仓库校验。</p>
        </section>
      </>
    );
  }
  const { campaign, rows, now } = await getCampaignWorkspace();
  const week = currentWeek(campaign.weeks, new Date(now));
  return (
    <>
      <PageTitle
        eyebrow="MY WORKSPACE"
        title="继续构建，持续向前。"
        description="在这里查看你的每周贡献、审核结果与奖励进度。"
      />
      <DemoNote />
      <div className="workspace-grid">
        <section className="panel current-task">
          <p className="eyebrow">THIS WEEK · WEEK {week?.number}</p>
          <h2>本周待提交</h2>
          <p>确认一个 GitHub 仓库，记录本周完成的原创代码。</p>
          <div className="task-date">
            <CalendarDays size={16} />
            {week ? weekLabel(week) : "活动尚未开始"} · 北京时间
          </div>
          <Link href="/submissions/current" className="button dark">
            查看提交入口 <ArrowUpRight size={15} />
          </Link>
        </section>
        <section className="panel identity-panel">
          <h2>开发者身份</h2>
          <div>
            <Wallet size={18} />
            <span>
              <small>演示钱包 · 未真实登录</small>
              <code>
                {rows[0].wallet.slice(0, 8)}…{rows[0].wallet.slice(-4)}
              </code>
            </span>
          </div>
          <div>
            <Github size={18} />
            <span>
              <small>GitHub 账号 · 演示</small>example-builder
            </span>
          </div>
          <p className="muted-text">切换到 database 模式后使用真实身份。</p>
        </section>
      </div>
      <section className="panel">
        <div className="panel-title">
          <div>
            <h2>首期贡献轨迹</h2>
            <p>09.09 — 10.06 · 等待 EC 不影响下一周提交</p>
          </div>
          <Link className="text-link" href="/rewards">
            奖励规则 <ArrowUpRight size={14} />
          </Link>
        </div>
        <div className="week-grid">
          {campaign.weeks.map((w, i) => (
            <article
              className={`week-card ${week?.id === w.id ? "current" : ""}`}
              key={w.id}
            >
              <span className="eyebrow">WEEK 0{w.number}</span>
              <h3>第 {w.number} 周</h3>
              <p>{weekLabel(w)}</p>
              <StatusBadge status={rows[0].weeks[i].status} />
            </article>
          ))}
        </div>
      </section>
      <section className="panel history">
        <div className="panel-title">
          <div>
            <h2>最近提交记录</h2>
            <p>以下记录为流程示例，未创建真实 GitHub 或 EC PR。</p>
          </div>
        </div>
        {[2, 1].map((n) => (
          <div className="history-row" key={n}>
            <span className="history-icon">
              <Github size={19} />
            </span>
            <div>
              <h3>example / kite-agent-demo</h3>
              <p>第 {n} 周 · 完善 Agent 交互与集成测试</p>
            </div>
            <StatusBadge status="completed" />
          </div>
        ))}
      </section>
    </>
  );
}
