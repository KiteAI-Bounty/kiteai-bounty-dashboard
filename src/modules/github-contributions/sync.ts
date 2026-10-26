import { readEnvironment } from "@/config/env";
import { getDb } from "@/lib/db";

export const SECOND_MONTH_KEY = "2026-10";

export const ACTIVE_KITE_REPOSITORIES = [
  "BrKDDD/kite-x402-hono",
  "tianzeshi-study/kite-x402-axum",
  "CarryWang/kite-x402-explorer",
  "gokite-ai/kite_counter_dapp",
  "gokite-ai/subnet-evm",
] as const;

const EC_REPOSITORY = "electric-capital/open-dev-data";
const PAGE_SIZE = 100;

type GithubPull = {
  number: number;
  html_url: string;
  title: string;
  body: string | null;
  state: "open" | "closed";
  draft: boolean;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  merged_at: string | null;
  user: {
    id: number;
    login: string;
    type: string;
  } | null;
};

export type GithubContributionSyncSummary = {
  reportMonth: string;
  pullRequests: number;
  activeRepositoryPullRequests: number;
  ecPullRequests: number;
  mergedPullRequests: number;
  openPullRequests: number;
  humanDevelopers: number;
  syncedAt: string;
};

export function beijingMonthRange(monthKey: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(monthKey))
    throw new Error("统计月份格式必须为 YYYY-MM。");
  const [year, month] = monthKey.split("-").map(Number);
  const offset = 8 * 60 * 60 * 1000;
  return {
    start: new Date(Date.UTC(year, month - 1, 1) - offset),
    end: new Date(Date.UTC(year, month, 1) - offset),
  };
}

function isKiteAiEcPullRequest(pull: GithubPull) {
  return /kite\s*ai/i.test(`${pull.title}\n${pull.body ?? ""}`);
}

async function githubPulls(repository: string, monthKey: string) {
  const env = readEnvironment(process.env);
  const token = env.GITHUB_READ_TOKEN ?? env.GITHUB_EC_TOKEN;
  if (!token) throw new Error("同步 GitHub PR 需要配置 GitHub Token。");
  const { start, end } = beijingMonthRange(monthKey);
  const pulls: GithubPull[] = [];

  for (let page = 1; page <= 10; page += 1) {
    const response = await fetch(
      `https://api.github.com/repos/${repository}/pulls?state=all&sort=created&direction=desc&per_page=${PAGE_SIZE}&page=${page}`,
      {
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${token}`,
          "X-GitHub-Api-Version": "2022-11-28",
        },
        cache: "no-store",
        signal: AbortSignal.timeout(20_000),
      },
    );
    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `GitHub API ${response.status} (${repository}): ${body.slice(0, 300)}`,
      );
    }
    const pagePulls = (await response.json()) as GithubPull[];
    pulls.push(
      ...pagePulls.filter((pull) => {
        const createdAt = Date.parse(pull.created_at);
        return createdAt >= start.getTime() && createdAt < end.getTime();
      }),
    );
    if (
      pagePulls.length < PAGE_SIZE ||
      pagePulls.some((pull) => Date.parse(pull.created_at) < start.getTime())
    )
      break;
  }

  return pulls;
}

export async function syncGithubContributions(
  reportMonth = SECOND_MONTH_KEY,
): Promise<GithubContributionSyncSummary> {
  const repositories = [...ACTIVE_KITE_REPOSITORIES, EC_REPOSITORY];
  const results = await Promise.all(
    repositories.map(async (repository) => ({
      repository,
      pulls: await githubPulls(repository, reportMonth),
    })),
  );
  const observedAt = new Date();
  const records = results.flatMap(({ repository, pulls }) => {
    const source = repository === EC_REPOSITORY ? "EC_TAXONOMY" : "ACTIVE_REPO";
    const selected =
      source === "EC_TAXONOMY" ? pulls.filter(isKiteAiEcPullRequest) : pulls;
    const [repoOwner, repoName] = repository.split("/");
    return selected.map((pull) => ({
      reportMonth,
      source,
      repoOwner,
      repoName,
      prNumber: pull.number,
      url: pull.html_url,
      title: pull.title,
      authorLogin: pull.user?.login ?? "ghost",
      authorGithubId: pull.user ? BigInt(pull.user.id) : null,
      authorType: pull.user?.type ?? "Unknown",
      state: pull.merged_at ? "MERGED" : pull.state.toUpperCase(),
      isDraft: pull.draft,
      createdAt: new Date(pull.created_at),
      updatedAt: new Date(pull.updated_at),
      closedAt: pull.closed_at ? new Date(pull.closed_at) : null,
      mergedAt: pull.merged_at ? new Date(pull.merged_at) : null,
      syncedAt: observedAt,
    }));
  });

  const db = getDb();
  for (let index = 0; index < records.length; index += 20) {
    const batch = records.slice(index, index + 20);
    await db.$transaction(
      batch.map((record) =>
        db.githubPullRequest.upsert({
          where: {
            repoOwner_repoName_prNumber: {
              repoOwner: record.repoOwner,
              repoName: record.repoName,
              prNumber: record.prNumber,
            },
          },
          update: record,
          create: record,
        }),
      ),
    );
  }

  const humanDevelopers = new Set(
    records
      .filter((record) => record.authorType.toLowerCase() !== "bot")
      .map((record) => record.authorLogin.toLowerCase()),
  ).size;
  return {
    reportMonth,
    pullRequests: records.length,
    activeRepositoryPullRequests: records.filter(
      (record) => record.source === "ACTIVE_REPO",
    ).length,
    ecPullRequests: records.filter((record) => record.source === "EC_TAXONOMY")
      .length,
    mergedPullRequests: records.filter((record) => record.state === "MERGED")
      .length,
    openPullRequests: records.filter((record) => record.state === "OPEN")
      .length,
    humanDevelopers,
    syncedAt: observedAt.toISOString(),
  };
}
