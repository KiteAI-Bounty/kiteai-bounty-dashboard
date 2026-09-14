import { GitPullRequest, CircleDashed } from "lucide-react";
import { DemoNote, LockedPage, PageTitle } from "@/components/ui";
import { readEnvironment } from "@/config/env";
import { getCurrentUser } from "@/modules/auth/service";
import { getDb } from "@/lib/db";
import { EcBatchList } from "@/components/ec-batch-list";

export default async function Batches() {
  const demo = readEnvironment(process.env).DATA_MODE === "demo";
  if (!demo) {
    const user = await getCurrentUser();
    if (!user || user.role !== "ADMIN")
      return <LockedPage title="需要管理员身份" />;
    const batches = await getDb().ecBatch.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { items: { include: { repository: true } } },
    });
    return (
      <>
        <PageTitle
          eyebrow="ELECTRIC CAPITAL"
          title="EC 登记批次中心"
          description="审核通过的新仓库集中申请登记，最终由 EC 维护者决定合并。"
        />
        <section className="panel">
          <div className="panel-title">
            <div>
              <h2>登记批次</h2>
              <p>后台自动创建 PR 并持续同步状态。</p>
            </div>
            <GitPullRequest size={24} />
          </div>
          {batches.length ? (
            <EcBatchList batches={batches.map((batch) => ({ ...batch, createdAt: batch.createdAt.toISOString() }))} />
          ) : (
            <div className="empty-state">
              <CircleDashed size={34} />
              <h2>尚无登记批次</h2>
              <p>管理员审核通过提交后，批次将在这里显示。</p>
            </div>
          )}
        </section>
      </>
    );
  }
  return (
    <>
      <PageTitle
        eyebrow="ELECTRIC CAPITAL"
        title="EC 登记批次中心"
        description="审核通过的新仓库集中申请登记，最终由 EC 维护者决定合并。"
      />
      {demo && <DemoNote />}
      <section className="panel">
        <div className="panel-title">
          <div>
            <h2>登记工作流</h2>
            <p>接口与异步任务边界已预留，真实 GitHub 操作尚未接入。</p>
          </div>
          <GitPullRequest size={24} />
        </div>
        <div className="pipeline">
          {[
            "生成 migration",
            "格式校验",
            "创建 / 更新 PR",
            "等待 EC 合并",
            "核实并回填",
          ].map((s, i) => (
            <div key={s}>
              <span>0{i + 1}</span>
              <h3>{s}</h3>
            </div>
          ))}
        </div>
      </section>
      <section className="panel empty-state">
        <CircleDashed size={34} />
        <h2>尚无真实登记批次</h2>
        <p>连接运营 GitHub 账号并审核贡献后，批次将在这里显示。</p>
        <button className="button dark" disabled>
          EC 自动化将在后续阶段接入
        </button>
      </section>
    </>
  );
}
