import "dotenv/config";
import { analyzeContribution } from "../src/modules/ai/glm";

async function main() {
  const commitUrl = process.argv.find((item) =>
    item.startsWith("https://github.com/"),
  );
  const scope = process.argv.includes("--scope=commit")
    ? "COMMIT"
    : "REPOSITORY";
  if (!commitUrl) {
    throw new Error(
      "Usage: npm run ai:check -- https://github.com/owner/repository/commit/sha [--scope=commit]",
    );
  }
  const parsed = new URL(commitUrl);
  const match = parsed.pathname.match(
    /^\/([^/]+)\/([^/]+)\/commit\/([0-9a-f]{7,64})$/i,
  );
  if (!match) throw new Error("A valid public GitHub Commit URL is required.");
  const [, owner, name, sha] = match;
  const token = process.env.GITHUB_READ_TOKEN ?? process.env.GITHUB_EC_TOKEN;
  const headers = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2026-03-10",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  const [repositoryResponse, commitResponse] = await Promise.all([
    fetch(`https://api.github.com/repos/${owner}/${name}`, { headers }),
    fetch(`https://api.github.com/repos/${owner}/${name}/commits/${sha}`, {
      headers,
    }),
  ]);
  if (!repositoryResponse.ok || !commitResponse.ok)
    throw new Error(
      `GitHub request failed: repository=${repositoryResponse.status}, commit=${commitResponse.status}`,
    );
  const repository = (await repositoryResponse.json()) as {
    html_url: string;
    description: string | null;
    default_branch: string;
    fork: boolean;
  };
  const commit = (await commitResponse.json()) as {
    sha: string;
    html_url: string;
    author?: { login?: string };
    commit: {
      message?: string;
      author?: { date?: string };
      committer?: { date?: string };
    };
  };
  const authoredAt = new Date(
    commit.commit.author?.date ?? commit.commit.committer?.date ?? 0,
  );
  const result = await analyzeContribution({
    scope,
    repository: {
      owner,
      name,
      url: repository.html_url,
      description: repository.description ?? "",
      defaultBranch: repository.default_branch,
      isFork: repository.fork,
    },
    direction: "x402-service",
    participantSummary:
      commit.commit.message ?? "Review the supplied KiteAI contribution.",
    githubLogin: commit.author?.login ?? owner,
    evidence: [
      {
        sha: commit.sha,
        url: commit.html_url,
        authoredAt,
        committedAt: new Date(commit.commit.committer?.date ?? authoredAt),
        snapshot: commit,
      },
    ],
  });
  console.log(
    JSON.stringify(
      {
        scope,
        model: result.model,
        verdict: result.verdict,
        activeDays: result.activeDays,
        summary: result.summary,
        missingEvidence: result.missingEvidence,
        prTitle: result.prTitle,
        findings: result.findings,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
