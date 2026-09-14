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
  direction: z.enum(contributionDirections.map((item) => item.value) as [string, ...string[]]).default("x402-service"),
});
type GithubCommitData = {
  author?: { id?: number | string; login?: string; type?: string };
  stats?: { additions?: number; deletions?: number; total?: number };
  parents?: Array<{ sha?: string }>;
  commit?: {
    author?: { date?: string };
    committer?: { date?: string };
  };
};

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
    const commits = body.evidenceUrls.map(parseCommitUrl);
    const unique = new Map(
      commits.map((item) => [`${item.owner}/${item.repo}@${item.sha}`, item]),
    );
    const evidence: Array<{
      commit: ReturnType<typeof parseCommitUrl>;
      data: GithubCommitData;
    }> = [];
    for (const commit of unique.values()) {
      const response = await fetch(
        `https://api.github.com/repos/${commit.owner}/${commit.repo}/commits/${commit.sha}`,
        {
          headers: {
            Accept: "application/vnd.github+json",
            "X-GitHub-Api-Version": "2026-03-10",
          },
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
        throw new ApiError(
          "NO_CODE_CHANGE",
          "Commit 未检测到代码变更。",
          400,
        );
      const committedAt = new Date(
        data.commit?.committer?.date ?? data.commit?.author?.date ?? 0,
      );
      if (
        committedAt < new Date(week.startsAt) ||
        committedAt >= new Date(week.endsAt)
      )
        throw new ApiError(
          "COMMIT_OUT_OF_RANGE",
          "Commit 不属于当前统计周。",
          400,
        );
      evidence.push({ commit, data });
    }
    const first = evidence[0];
    const repoResponse = await fetch(
      `https://api.github.com/repos/${first.commit.owner}/${first.commit.repo}`,
      {
        headers: {
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2026-03-10",
        },
        cache: "no-store",
      },
    );
    if (!repoResponse.ok)
      throw new ApiError(
        "GITHUB_UNAVAILABLE",
        "无法读取 GitHub 仓库，请稍后重试。",
        502,
      );
    const repoData = await repoResponse.json();
    if (repoData.fork)
      throw new ApiError(
        "FORK_REPOSITORY",
        "Fork 仓库中的历史提交不计入贡献，请提交原始公开仓库中的 Commit。",
        400,
      );
    const repository = await getDb().repository.upsert({
      where: { githubRepoId: BigInt(repoData.id) },
      update: {},
      create: {
        githubRepoId: BigInt(repoData.id),
        url: `https://github.com/${first.commit.owner}/${first.commit.repo}`,
        name: first.commit.repo,
        owner: first.commit.owner,
        description: repoData.description ?? "",
        direction: "待管理员审核",
        integration: "待管理员审核",
        defaultBranch: repoData.default_branch ?? "main",
        isFork: Boolean(repoData.fork),
        isOfficial: false,
      },
    });
    const created = await getDb().$transaction(async (tx) => {
      await tx.enrollment.upsert({
        where: { campaignId_userId: { campaignId: campaign.id, userId: user.userId } },
        update: {},
        create: { campaignId: campaign.id, userId: user.userId },
      });
      const existing = await tx.submission.findUnique({
        where: { userId_weekId: { userId: user.userId, weekId: week.id } },
      });
      if (existing)
        throw new ApiError(
          "WEEK_ALREADY_SUBMITTED",
          "本周已经提交过贡献。",
          409,
        );
      return tx.submission.create({
        data: {
          userId: user.userId,
          weekId: week.id,
          repositoryId: repository.id,
          direction: body.direction,
          revisions: {
            create: {
              version: 1,
              summary: body.summary,
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
            },
          },
        },
        select: { id: true, status: true, submittedAt: true },
      });
    });
    return ok(created);
  } catch (error) {
    return apiError(error);
  }
}
