import { Github, Info } from "lucide-react";
import { PageTitle, DemoNote, LockedPage } from "@/components/ui";
import { SubmissionForm } from "@/components/submission-form";
import { readEnvironment } from "@/config/env";
import { getCurrentUser } from "@/modules/auth/service";
import {
  getCampaignWorkspace,
  getUserProgress,
} from "@/modules/campaigns/service";
import { currentWeek, weekLabel, type Week } from "@/modules/campaigns/domain";
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
    const activeWeek = currentWeek(
      progress.campaign.weeks,
      new Date(progress.now),
    );
    const weekStartById = new Map(
      progress.campaign.weeks.map((item) => [
        item.id,
        Date.parse(item.startsAt),
      ]),
    );
    const correctionSubmission = progress.submissions
      .filter((submission) => submission.status === "CHANGES_REQUESTED")
      .sort(
        (a, b) =>
          (weekStartById.get(b.weekId) ?? 0) -
          (weekStartById.get(a.weekId) ?? 0),
      )[0];
    const week = correctionSubmission
      ? (progress.campaign.weeks.find(
          (item) => item.id === correctionSubmission.weekId,
        ) ?? null)
      : activeWeek;
    const currentSubmission =
      correctionSubmission ??
      (week
        ? progress.submissions.find(
            (submission) => submission.weekId === week.id,
          )
        : null);
    const previousSubmission = week
      ? progress.submissions
          .filter(
            (submission) =>
              (weekStartById.get(submission.weekId) ??
                Number.POSITIVE_INFINITY) < Date.parse(week.startsAt),
          )
          .sort(
            (a, b) =>
              (weekStartById.get(b.weekId) ?? 0) -
              (weekStartById.get(a.weekId) ?? 0),
          )[0]
      : undefined;
    const revision = currentSubmission?.revisions[0];
    const analysis = revision?.aiFindings as
      { activeDays?: number; missingEvidence?: string[] } | null | undefined;
    return (
      <SubmissionPageContent
        week={week ?? null}
        isCorrection={Boolean(correctionSubmission)}
        targetWeekId={week?.id}
        previousProject={
          previousSubmission
            ? {
                name: `${previousSubmission.repository.owner}/${previousSubmission.repository.name}`,
                url: previousSubmission.repository.url,
                direction: previousSubmission.direction,
              }
            : null
        }
        status={currentSubmission?.status ?? null}
        direction={currentSubmission?.direction ?? null}
        correctionNote={revision?.reviews[0]?.note ?? null}
        analysis={
          revision
            ? {
                scope: revision.aiScope,
                status: revision.aiStatus,
                verdict: revision.aiVerdict,
                summary: revision.aiSummary,
                findings: revision.aiFindings,
                model: revision.aiModel,
                activeDays: analysis?.activeDays ?? 0,
                missingEvidence: Array.isArray(analysis?.missingEvidence)
                  ? analysis.missingEvidence
                  : [],
              }
            : null
        }
      />
    );
  }
  const workspace = await getCampaignWorkspace();
  const week = currentWeek(workspace.campaign.weeks, new Date(workspace.now));
  return <SubmissionPageContent week={week ?? null} />;
}

function SubmissionPageContent({
  week,
  previousProject = null,
  isCorrection = false,
  targetWeekId,
  direction = null,
  correctionNote = null,
  status = null,
  analysis = null,
}: {
  week: Week | null;
  previousProject?: {
    name: string;
    url: string;
    direction: string;
  } | null;
  isCorrection?: boolean;
  targetWeekId?: string;
  direction?: string | null;
  correctionNote?: string | null;
  status?: string | null;
  analysis?: {
    scope: string | null;
    status: string;
    verdict: string | null;
    summary: string | null;
    findings: unknown;
    model: string | null;
    activeDays: number;
    missingEvidence: string[];
  } | null;
}) {
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
              <h2>{isCorrection ? "修改历史提交" : "本周贡献"}</h2>
              <p>
                {week
                  ? `第 ${week.number} 周 · ${weekLabel(week)} · 北京时间`
                  : "当前不在可提交的统计周内"}
              </p>
              <p className="submission-hint">
                {isCorrection
                  ? "请重新提交该周有效 Commit"
                  : "请提交本周有效 Commit"}
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
            <SubmissionForm
              previousProject={isCorrection ? null : previousProject}
              targetWeekId={targetWeekId}
              initialDirection={direction}
              correctionNote={correctionNote}
              initialStatus={status}
              initialAnalysis={analysis}
            />
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
