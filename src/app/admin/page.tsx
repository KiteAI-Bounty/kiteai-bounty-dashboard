import Link from "next/link";
import { ArrowUpRight, GitPullRequest, ShieldCheck } from "lucide-react";
import {
  DemoNote,
  LockedPage,
  PageTitle,
  ProcessGuide,
  Stat,
  StatusBadge,
} from "@/components/ui";
import { readEnvironment } from "@/config/env";
import { getCampaignWorkspace } from "@/modules/campaigns/service";
import { getCurrentUser } from "@/modules/auth/service";
import { getDb } from "@/lib/db";
import { ParticipantImport } from "@/components/participant-import";
import { AdminReviewQueue } from "@/components/admin-review-queue";
import { AdminWallets } from "@/components/admin-wallets";

export default async function Admin() {
  if (readEnvironment(process.env).DATA_MODE !== "demo") {
    const user = await getCurrentUser();
    if (!user || user.role !== "ADMIN")
      return <LockedPage title="需要管理员身份" />;
    const participants = await getDb().participantInvite.findMany({
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    const reviewSubmissions = await getDb().submission.findMany({
      orderBy: { submittedAt: "asc" },
      take: 200,
      include: {
        user: { include: { github: true } },
        week: true,
        repository: true,
        revisions: {
          orderBy: { version: "desc" },
          take: 1,
          include: { evidence: true },
        },
      },
    });
    const repositoryIds = [...new Set(reviewSubmissions.map((item) => item.repositoryId))];
    const ecBatches = await getDb().ecBatch.findMany({
      where: { items: { some: { repositoryId: { in: repositoryIds } } } },
      orderBy: { createdAt: "desc" },
      include: { items: true },
    });
    return (
      <>
        <PageTitle
          eyebrow="ADMIN CONSOLE"
          title="管理后台已验证"
          description={`管理员钱包 ${user.wallet.slice(0, 8)}…${user.wallet.slice(-4)}。审核通过后将进入 EC 登记队列。`}
          action={
            <Link className="button" href="/admin/ec-batches">
              <GitPullRequest size={16} />
              EC 批次中心
            </Link>
          }
        />
        <section className="stats-grid">
          <Stat
            label="白名单人数"
            value={participants.length.toString().padStart(2, "0")}
            note="当前最多展示 200 人"
            accent
          />
          <Stat
            label="已激活"
            value={participants
              .filter((item) => item.status === "ACTIVE")
              .length.toString()
              .padStart(2, "0")}
            note="已完成钱包签名绑定"
          />
          <Stat
            label="待激活"
            value={participants
              .filter((item) => item.status === "PENDING")
              .length.toString()
              .padStart(2, "0")}
            note="等待白名单钱包首次登录"
          />
          <Stat
            label="已禁用"
            value={participants
              .filter((item) => item.status === "DISABLED")
              .length.toString()
              .padStart(2, "0")}
            note="不能获取登录挑战"
          />
        </section>
        <ProcessGuide audience="admin" />
        <div className="admin-management-grid">
          <ParticipantImport />
          <AdminWallets />
        </div>
        <AdminReviewQueue
          items={reviewSubmissions.flatMap((item) => {
            const revision = item.revisions[0];
            const ecBatch = ecBatches.find((batch) =>
              batch.items.some((batchItem) => batchItem.repositoryId === item.repositoryId),
            );
            return revision
              ? [
                  {
                    id: item.id,
                    status: item.status,
                    ecStatus: ecBatch?.status ?? null,
                    ecPrUrl: ecBatch?.prUrl ?? null,
                    ecFailure: ecBatch?.validationLog ?? ecBatch?.items.find((batchItem) => batchItem.repositoryId === item.repositoryId)?.failure ?? null,
                    version: item.version,
                    user: {
                      wallet: item.user.wallet,
                      github: item.user.github
                        ? { login: item.user.github.login }
                        : null,
                    },
                    week: {
                      number: item.week.number,
                      startsAt: item.week.startsAt.toISOString(),
                      endsAt: item.week.endsAt.toISOString(),
                    },
                    repository: {
                      owner: item.repository.owner,
                      name: item.repository.name,
                      url: item.repository.url,
                    },
                    revision: {
                      id: revision.id,
                      version: revision.version,
                      summary: revision.summary,
                      evidence: revision.evidence.map((evidence) => ({
                        sha: evidence.sha,
                        url: evidence.url,
                      })),
                    },
                  },
                ]
              : [];
          })}
        />
        {participants.length > 0 && (
          <section className="panel">
            <div className="panel-title">
              <div>
                <h2>已导入名单</h2>
                <p>联系方式仅在管理员页面显示。</p>
              </div>
            </div>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>参与者</th>
                    <th>联系方式</th>
                    <th>GitHub</th>
                    <th>钱包</th>
                    <th>状态</th>
                  </tr>
                </thead>
                <tbody>
                  {participants.map((item) => (
                    <tr key={item.id}>
                      <td>{item.displayName}</td>
                      <td>{item.contact}</td>
                      <td>{item.githubLogin ? `@${item.githubLogin}` : "—"}</td>
                      <td className="mono">
                        {item.wallet.slice(0, 7)}…{item.wallet.slice(-4)}
                      </td>
                      <td>
                        <span
                          className={`badge ${
                            item.status === "ACTIVE"
                              ? "green"
                              : item.status === "DISABLED"
                                ? "red"
                                : "muted"
                          }`}
                        >
                          <span className="badge-dot" />
                          {item.status === "ACTIVE"
                            ? "已激活"
                            : item.status === "DISABLED"
                              ? "已禁用"
                              : "待激活"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </>
    );
  }
  const { rows } = await getCampaignWorkspace();
  const reviewing = rows.filter((r) => r.weeks[2].status === "reviewing");
  return (
    <>
      <PageTitle
        eyebrow="ADMIN CONSOLE"
        title="让每一份贡献都有回响。"
        description="审核原创代码、跟踪 EC 登记，管理开发者参与进度。"
        action={
          <Link className="button" href="/admin/ec-batches">
            <GitPullRequest size={16} />
            EC 批次中心 <ArrowUpRight size={15} />
          </Link>
        }
      />
      <DemoNote />
      <ProcessGuide audience="admin" />
      <section className="stats-grid">
        <Stat
          label="本周完成贡献"
          value="01"
          note="演示 W3 · 已审核且登记条件满足"
          accent
        />
        <Stat
          label="本周待审核"
          value={`0${reviewing.length}`}
          note="按唯一开发者计算"
        />
        <Stat
          label="等待 EC 的开发者"
          value="02"
          note="演示首期 · 等待仓库归属确认"
        />
        <Stat
          label="奖励发放"
          value="未开放"
          note="等待资格计算及支付模块接入"
        />
      </section>
      <section className="panel">
        <div className="panel-title">
          <div>
            <h2>贡献审核队列</h2>
            <p>第 3 周 · 09/28 — 10/04 · 只读演示</p>
          </div>
          <ShieldCheck size={22} />
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>开发者</th>
                <th>项目方向</th>
                <th>提交状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {reviewing.map((r, i) => (
                <tr key={r.wallet}>
                  <td>
                    <strong>example-builder-{i + 1}</strong>
                    <small className="mono">
                      {r.wallet.slice(0, 6)}…{r.wallet.slice(-4)}
                    </small>
                  </td>
                  <td>
                    {["Agent Passport 集成", "链上开发工具", "Agent 应用"][i]}
                  </td>
                  <td>
                    <StatusBadge status="reviewing" />
                  </td>
                  <td>
                    <button className="button small" disabled>
                      审核功能待接入
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
