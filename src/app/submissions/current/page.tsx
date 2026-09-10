import { Github, Info } from "lucide-react";
import { PageTitle, DemoNote, LockedPage } from "@/components/ui";
import { SubmissionForm } from "@/components/submission-form";
import { readEnvironment } from "@/config/env";
import { getCurrentUser } from "@/modules/auth/service";
import { getUserProgress } from "@/modules/campaigns/service";
import { currentWeek } from "@/modules/campaigns/domain";
import { redirect } from "next/navigation";

export default async function SubmissionPage() {
  const demo = readEnvironment(process.env).DATA_MODE === "demo";
  if (!demo) {
    const user = await getCurrentUser();
    if (!user) return <LockedPage title="项目与贡献" />;
    if (user.role === "ADMIN") redirect("/admin");
    if (!user.github)
      return (
        <section className="panel empty-state">
          <Github size={32} />
          <h1>先绑定 GitHub</h1>
          <p>每周代码作者必须与当前钱包绑定的 GitHub 数字 ID 一致。</p>
          <a
            className="button dark"
            href="/api/auth/github?returnTo=/submissions/current"
          >
            绑定 GitHub
          </a>
        </section>
      );
    const progress = await getUserProgress(user.userId);
    const week = currentWeek(progress.campaign.weeks, new Date(progress.now));
    const currentSubmission = week
      ? progress.submissions.find((submission) => submission.weekId === week.id)
      : null;
    return <SubmissionPageContent status={currentSubmission?.status ?? null} />;
  }
  return <SubmissionPageContent />;
}

function SubmissionPageContent({ status = null }: { status?: string | null }) {
  const demo = readEnvironment(process.env).DATA_MODE === "demo";
  return (
    <>
      <PageTitle
        eyebrow="WEEKLY CONTRIBUTION"
        title="记录本周的真实进展"
        description="每周一份提交。已登记仓库仍需提供本周新的原创代码。"
      />
      {demo && <DemoNote />}
      <div className="form-layout">
        <section className="panel form-panel">
          <div className="panel-title">
            <div>
              <h2>本周贡献</h2>
              <p>第 1 周 · 09/09 — 09/15（演示）</p>
              <p className="submission-hint">
                请提交本周有效 Commit
                链接（每行一条）。系统将自动识别关联仓库；请简要说明代码变更及其与
                KiteAI 的关联。
              </p>
            </div>
            <Github size={23} />
          </div>
          {demo ? (
            <fieldset disabled>
              <SubmissionForm disabled />
            </fieldset>
          ) : (
            <SubmissionForm initialStatus={status} />
          )}
        </section>
        <aside className="panel guide-panel">
          <Info size={22} />
          <h2>提交前，请确认</h2>
          <ul>
            <li>仓库公开可访问</li>
            <li>代码作者与绑定的 GitHub 身份一致</li>
            <li>贡献发生在本周统计范围内</li>
            <li>包含有意义的原创代码及 KiteAI 集成</li>
          </ul>
          <div className="divider" />
          <p>
            首次登记需等待 EC 维护者合并。重复仓库、重复代码不会增加参与次数。
          </p>
        </aside>
      </div>
    </>
  );
}
