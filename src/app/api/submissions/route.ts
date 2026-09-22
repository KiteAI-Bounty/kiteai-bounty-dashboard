import { requireUser, requireDatabaseMode } from "@/modules/auth/service";
import { ApiError, apiError, ok } from "@/lib/api";
import { getDb } from "@/lib/db";
import { getCampaignWorkspace } from "@/modules/campaigns/service";
import { currentWeek } from "@/modules/campaigns/domain";
import { z } from "zod";
import { contributionDirections } from "@/modules/directions/catalog";

const input = z.object({
  evidenceUrls: z.array(z.url()).min(1).max(20),
  summary: z.string().trim().min(20).max(4000),
  reusePreviousProject: z.boolean().default(false),
  direction: z
    .enum(
      contributionDirections.map((item) => item.value) as [string, ...string[]],
    )
    .default("x402-service"),
});
type GithubCommitData = {
  sha?: string;
  author?: { id?: number | string; login?: string; type?: string };
  stats?: { additions?: number; deletions?: number; total?: number };
  parents?: Array<{ sha?: string }>;
  commit?: {
    author?: { date?: string };
    committer?: { date?: string };
  };
};

function githubHeaders() {
  const token = process.env.GITHUB_READ_TOKEN ?? process.env.GITHUB_EC_TOKEN;
  return {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2026-03-10",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function parseCommitUrl(value: string) {
  const url = new URL(value);
  const match = url.pathname.match(
    /^\/([^/]+)\/([^/]+)\/commit\/([0-9a-f]{7,64})$/i,
  );
  if (url.protocol !== "https:" || url.hostname !== "github.com" || !match)
    throw new ApiError("EVIDENCE_INVALID", "请提交 GitHub Commit 链接。", 400);
  return {
    owner: match[1],
    repo: match[2].replace(/\.git$/, ""),
    sha: match[3],
  };
}

export async function GET() {
  try {
    requireDatabaseMode();
    const user = await requireUser();
    if (user.role === "ADMIN")
      throw new ApiError(
        "ADMIN_NOT_PARTICIPANT",
        "管理员没有参与者提交。",
        403,
      );
    const { campaign } = await getCampaignWorkspace();
    const week = currentWeek(campaign.weeks, new Date());
    if (!week) return ok(null);
    const submission = await getDb().submission.findUnique({
      where: { userId_weekId: { userId: user.userId, weekId: week.id } },
      include: {
        revisions: {
          orderBy: { version: "desc" },
          take: 1,
        },
      },
    });
    const revision = submission?.revisions[0];
    const analysis = revision?.aiFindings as
      { activeDays?: number; missingEvidence?: string[] } | null | undefined;
    return ok(
      submission && revision
        ? {
            id: submission.id,
            status: submission.status,
            ai: {
              scope: revision.aiScope,
              status: revision.aiStatus,
              verdict: revision.aiVerdict,
              summary: revision.aiSummary,
              findings: revision.aiFindings,
              activeDays: analysis?.activeDays ?? 0,
              missingEvidence: Array.isArray(analysis?.missingEvidence)
                ? analysis.missingEvidence
                : [],
              model: revision.aiModel,
              checkedAt: revision.aiCheckedAt?.toISOString() ?? null,
            },
          }
        : null,
    );
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    requireDatabaseMode();
    const user = await requireUser();
    if (user.role === "ADMIN")
      throw new ApiError(
        "ADMIN_NOT_PARTICIPANT",
        "管理员不参与贡献提交。",
        403,
      );
    if (!user.github)
      throw new ApiError("GITHUB_REQUIRED", "请先绑定 GitHub。", 409);
    const body = input.parse(await request.json());
    const { campaign } = await getCampaignWorkspace();
    const week = currentWeek(campaign.weeks, new Date());
    if (!week)
      throw new ApiError("WEEK_CLOSED", "当前不在可提交的统计周内。", 409);
    const currentSubmission = await getDb().submission.findUnique({
      where: { userId_weekId: { userId: user.userId, weekId: week.id } },
      select: { status: true },
    });
    if (
      currentSubmission &&
      currentSubmission.status !== "CHANGES_REQUESTED"
    )
      throw new ApiError(
        "WEEK_ALREADY_SUBMITTED",
        "本周贡献已经提交，请等待 AI 和管理员审核。只有管理员要求修改后才能重新提交。",
        409,
      );
    const commits = body.evidenceUrls.map(parseCommitUrl);
    const unique = new Map(
      commits.map((item) => [`${item.owner}/${item.repo}@${item.sha}`, item]),
    );
    const repositories = new Set(
      commits.map(
        (item) => `${item.owner.toLowerCase()}/${item.repo.toLowerCase()}`,
      ),
    );
    if (repositories.size !== 1)
      throw new ApiError(
        "MULTIPLE_REPOSITORIES",
        "一次周度提交中的 Commit 必须属于同一个仓库。",
        400,
      );
    const evidence: Array<{
      commit: ReturnType<typeof parseCommitUrl>;
      data: GithubCommitData;
    }> = [];
    for (const commit of unique.values()) {
      const response = await fetch(
        `https://api.github.com/repos/${commit.owner}/${commit.repo}/commits/${commit.sha}`,
        {
          headers: githubHeaders(),
          cache: "no-store",
        },
      );
      if (!response.ok)
        throw new ApiError(
          "GITHUB_UNAVAILABLE",
          "无法读取 GitHub Commit，请稍后重试。",
          502,
        );
      const data = (await response.json()) as GithubCommitData;
      if (String(data.author?.id ?? "") !== user.github.id)
        throw new ApiError(
          "AUTHOR_MISMATCH",
          "Commit 作者与当前绑定的 GitHub 账号不一致。",
          400,
        );
      const login = String(data.author?.login ?? "").toLowerCase();
      if (data.author?.type === "Bot" || login.endsWith("[bot]"))
        throw new ApiError(
          "BOT_COMMIT",
          "机器人账号提交不计入开发者贡献。",
          400,
        );
      if ((data.parents?.length ?? 0) > 1)
        throw new ApiError(
          "MERGE_COMMIT",
          "Merge Commit 不计入开发者贡献，请提交具体原创代码 Commit。",
          400,
        );
      if ((data.stats?.additions ?? 0) + (data.stats?.deletions ?? 0) <= 0)
        throw new ApiError("NO_CODE_CHANGE", "Commit 未检测到代码变更。", 400);
      const authoredAt = new Date(data.commit?.author?.date ?? 0);
      if (
        !Number.isFinite(authoredAt.getTime()) ||
        authoredAt < new Date(week.startsAt) ||
        authoredAt >= new Date(week.endsAt)
      )
        throw new ApiError(
          "COMMIT_OUT_OF_RANGE",
          "Commit 不属于当前统计周。",
          400,
        );
      evidence.push({
        commit: { ...commit, sha: String(data.sha ?? commit.sha) },
        data,
      });
    }
    const first = evidence[0];
    const repoResponse = await fetch(
      `https://api.github.com/repos/${first.commit.owner}/${first.commit.repo}`,
      { headers: githubHeaders(), cache: "no-store" },
    );
    if (!repoResponse.ok)
      throw new ApiError(
        "GITHUB_UNAVAILABLE",
        "无法读取 GitHub 仓库，请稍后重试。",
        502,
      );
    const repoData = (await repoResponse.json()) as {
      id: number | string;
      fork?: boolean;
      private?: boolean;
      archived?: boolean;
      description?: string | null;
      default_branch?: string;
    };
    if (repoData.private)
      throw new ApiError(
        "PRIVATE_REPOSITORY",
        "Electric Capital 当前重点统计公开开源仓库，请提交公开仓库。",
        400,
      );
    if (repoData.archived)
      throw new ApiError(
        "ARCHIVED_REPOSITORY",
        "已归档仓库不能作为本周活跃贡献仓库。",
        400,
      );
    if (repoData.fork)
      throw new ApiError(
        "FORK_REPOSITORY",
        "Fork 仓库中的历史提交不计入贡献。请提交您独立拥有的公开仓库，或向官方仓库提交 PR 并合入主分支后再提交对应 Commit。",
        400,
      );
    const isOwner =
      first.commit.owner.toLowerCase() === user.github.login.toLowerCase();
    const isOfficial =
      first.commit.owner.toLowerCase() === "gokite-ai";
    const defaultBranch = repoData.default_branch ?? "main";

    if (!isOwner || isOfficial) {
      for (const item of evidence) {
        const compareResponse = await fetch(
          `https://api.github.com/repos/${item.commit.owner}/${item.commit.repo}/compare/${item.commit.sha}...${defaultBranch}`,
          { headers: githubHeaders(), cache: "no-store" },
        );
        if (!compareResponse.ok) {
          throw new ApiError(
            "COMMIT_NOT_IN_BRANCH",
            `无法在仓库 ${item.commit.owner}/${item.commit.repo} 中验证 Commit ${item.commit.sha.slice(0, 10)} 的分支状态。`,
            400,
          );
        }
        const compareData = (await compareResponse.json()) as {
          status: string;
          behind_by: number;
          ahead_by: number;
        };
        if (
          compareData.behind_by > 0 ||
          compareData.status === "diverged" ||
          compareData.status === "behind"
        ) {
          throw new ApiError(
            "COMMIT_NOT_MERGED",
            `向组织/官方仓库（${item.commit.owner}/${item.commit.repo}）贡献的代码，必须已合并（Merged）到主分支（${defaultBranch}）方可提交。若 PR 仍在审核中，请等待官方合入；或请在个人账号下创建独立开源项目仓库后提交。`,
            400,
          );
        }
      }
    }

    const repository = await getDb().repository.upsert({
      where: { githubRepoId: BigInt(repoData.id) },
      update: {
        url: `https://github.com/${first.commit.owner}/${first.commit.repo}`,
        name: first.commit.repo,
        owner: first.commit.owner,
        description: repoData.description ?? "",
        defaultBranch,
        isFork: Boolean(repoData.fork),
        isOfficial,
      },
      create: {
        githubRepoId: BigInt(repoData.id),
        url: `https://github.com/${first.commit.owner}/${first.commit.repo}`,
        name: first.commit.repo,
        owner: first.commit.owner,
        description: repoData.description ?? "",
        direction: "待管理员审核",
        integration: "待管理员审核",
        defaultBranch,
        isFork: Boolean(repoData.fork),
        isOfficial,
      },
    });
    const previousWeekIds = campaign.weeks
      .filter((item) => Date.parse(item.startsAt) < Date.parse(week.startsAt))
      .map((item) => item.id);
    const created = await getDb().$transaction(async (tx) => {
      await tx.enrollment.upsert({
        where: {
          campaignId_userId: { campaignId: campaign.id, userId: user.userId },
        },
        update: {},
        create: { campaignId: campaign.id, userId: user.userId },
      });
      const existing = await tx.submission.findUnique({
        where: { userId_weekId: { userId: user.userId, weekId: week.id } },
      });
      if (existing && existing.status !== "CHANGES_REQUESTED")
        throw new ApiError(
          "WEEK_ALREADY_SUBMITTED",
          "本周已经提交过贡献。",
          409,
        );
      const previousSubmission = body.reusePreviousProject
        ? await tx.submission.findFirst({
            where: {
              userId: user.userId,
              weekId: { in: previousWeekIds },
            },
            orderBy: { week: { startsAt: "desc" } },
          })
        : null;
      if (body.reusePreviousProject && !previousSubmission)
        throw new ApiError(
          "PREVIOUS_PROJECT_NOT_FOUND",
          "没有找到可沿用的上周项目，请重新选择项目方向。",
          409,
        );
      if (
        previousSubmission &&
        previousSubmission.repositoryId !== repository.id
      )
        throw new ApiError(
          "PREVIOUS_PROJECT_MISMATCH",
          "当前 Commit 不属于上周项目。如需更换项目，请点击“更换项目或方向”后再提交。",
          409,
        );
      const direction = previousSubmission?.direction ?? body.direction;
      const duplicate = await tx.contributionEvidence.findFirst({
        where: {
          sha: { in: evidence.map((item) => item.commit.sha) },
          ...(existing
            ? { revision: { submissionId: { not: existing.id } } }
            : {}),
        },
        select: { sha: true },
      });
      if (duplicate)
        throw new ApiError(
          "COMMIT_ALREADY_SUBMITTED",
          `Commit ${duplicate.sha.slice(0, 10)}… 已在其他周度提交中使用。`,
          409,
        );
      const [registration, pendingBatch] = await Promise.all([
        tx.ecRegistration.findUnique({
          where: {
            repositoryId_ecosystem: {
              repositoryId: repository.id,
              ecosystem: "KiteAI",
            },
          },
        }),
        tx.ecBatch.findFirst({
          where: {
            items: { some: { repositoryId: repository.id } },
            status: {
              in: [
                "QUEUED",
                "GENERATING",
                "READY",
                "PR_OPEN",
                "CHANGES_REQUESTED",
                "CI_FAILED",
                "MERGED",
              ],
            },
          },
        }),
      ]);
      const aiScope =
        repository.isOfficial ||
        registration?.status === "VERIFIED" ||
        pendingBatch
          ? "COMMIT"
          : "REPOSITORY";
      const version = (existing?.version ?? 0) + 1;
      const revision = {
        version,
        summary: body.summary,
        aiScope,
        aiStatus: "PENDING",
        evidence: {
          create: evidence.map(({ commit, data }) => ({
            sha: commit.sha,
            githubAuthorId: BigInt(user.github!.id),
            authoredAt: new Date(
              data.commit?.author?.date ??
                data.commit?.committer?.date ??
                new Date().toISOString(),
            ),
            committedAt: new Date(
              data.commit?.committer?.date ??
                data.commit?.author?.date ??
                new Date().toISOString(),
            ),
            url: `https://github.com/${commit.owner}/${commit.repo}/commit/${commit.sha}`,
            snapshot: data,
          })),
        },
      };
      const saved = existing
        ? await tx.submission.update({
            where: { id: existing.id },
            data: {
              status: "SUBMITTED",
              version,
              submittedAt: new Date(),
              repositoryId: repository.id,
              direction,
              revisions: { create: revision },
            },
            select: { id: true, status: true, submittedAt: true },
          })
        : await tx.submission.create({
            data: {
              userId: user.userId,
              weekId: week.id,
              repositoryId: repository.id,
              direction,
              revisions: { create: revision },
            },
            select: { id: true, status: true, submittedAt: true },
          });
      const savedRevision = await tx.submissionRevision.findUniqueOrThrow({
        where: {
          submissionId_version: { submissionId: saved.id, version },
        },
        select: { id: true },
      });
      await tx.job.upsert({
        where: { key: `ai.analyze.revision.${savedRevision.id}` },
        update: {
          status: "PENDING",
          attempts: 0,
          lastError: null,
          runAt: new Date(),
          lockedBy: null,
          lockedUntil: null,
        },
        create: {
          type: "ai.analyze_submission",
          key: `ai.analyze.revision.${savedRevision.id}`,
          payload: { revisionId: savedRevision.id },
        },
      });
      return { ...saved, aiScope };
    });
    return ok(created);
  } catch (error) {
    return apiError(error);
  }
}
