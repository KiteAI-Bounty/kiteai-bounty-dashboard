import { CalendarClock, Github, Info } from "lucide-react";
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
import Link from "next/link";

export default async function SubmissionPage({
  searchParams,
}: PageProps<"/submissions/current">) {
  const query = await searchParams;
  const requestedWeek = Array.isArray(query.week) ? query.week[0] : query.week;
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
    const firstWeek = progress.campaign.weeks.find((item) => item.number === 1);
    const firstWeekSubmission = firstWeek
      ? progress.submissions.find(
          (submission) => submission.weekId === firstWeek.id,
        )
      : undefined;
    const canBackfillFirstWeek = Boolean(
      firstWeek &&
      !firstWeekSubmission &&
      new Date(progress.now).getTime() >= Date.parse(firstWeek.endsAt),
    );
    const isFirstWeekBackfill = requestedWeek === "1" && canBackfillFirstWeek;
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
    const week = isFirstWeekBackfill
      ? (firstWeek ?? null)
      : correctionSubmission
        ? (progress.campaign.weeks.find(
            (item) => item.id === correctionSubmission.weekId,
          ) ?? null)
        : activeWeek;
    const currentSubmission =
      (isFirstWeekBackfill ? null : correctionSubmission) ??
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
        isCorrection={Boolean(correctionSubmission) && !isFirstWeekBackfill}
        isFirstWeekBackfill={isFirstWeekBackfill}
        canBackfillFirstWeek={canBackfillFirstWeek}
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
  isFirstWeekBackfill = false,
  canBackfillFirstWeek = false,
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
  isFirstWeekBackfill?: boolean;
  canBackfillFirstWeek?: boolean;
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
      {canBackfillFirstWeek && !isFirstWeekBackfill && (
        <section className="catchup-notice" aria-label="第 1 周补交入口">
          <CalendarClock size={22} />
          <div>
            <strong>你还没有提交第 1 周贡献</strong>
            <p>
              现在可以补交第 1 周的原创代码；Commit 必须产生于第 1
              周统计范围内。
            </p>
          </div>
          <Link
            className="button dark compact"
            href="/submissions/current?week=1"
          >
            补交第 1 周
          </Link>
        </section>
      )}
      {isFirstWeekBackfill && (
        <div className="catchup-return">
          <Link className="text-link" href="/submissions/current">
            返回本周提交
          </Link>
        </div>
      )}
      <div className="form-layout">
        <section className="panel form-panel">
          <div className="panel-title">
            <div>
              <h2>
                {isCorrection
                  ? "修改历史提交"
                  : isFirstWeekBackfill
                    ? "补交第 1 周贡献"
                    : "本周贡献"}
              </h2>
              <p>
                {week
                  ? `第 ${week.number} 周 · ${weekLabel(week)} · 北京时间`
                  : "当前不在可提交的统计周内"}
              </p>
              <p className="submission-hint">
                {isCorrection
                  ? "请提交原统计周内的 Commit，或按审核意见修改后产生的新 Commit"
                  : isFirstWeekBackfill
                    ? "请提交第 1 周统计范围内的有效 Commit"
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
              weekNumber={week?.number}
              isBackfill={isFirstWeekBackfill}
            />
          )}
        </section>
        <aside className="panel guide-panel">
          <Info size={22} />
          <h2>提交前，请确认</h2>
          <ul>
            <li>仓库公开可访问</li>
            <li>代码作者与绑定的 GitHub 身份一致</li>
            <li>
              {isCorrection
                ? "原周贡献，或要求修改后产生的修复 Commit"
                : isFirstWeekBackfill
                  ? "贡献发生在第 1 周统计范围内"
                  : "贡献发生在本周统计范围内"}
            </li>
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
