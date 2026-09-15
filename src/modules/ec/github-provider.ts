import { createHash } from "node:crypto";
import { readEnvironment } from "@/config/env";

type GithubResponse = Record<string, unknown>;

function config() {
  const env = readEnvironment(process.env);
  if (!env.GITHUB_EC_TOKEN || !env.EC_FORK_OWNER)
    throw new Error(
      "EC GitHub integration requires GITHUB_EC_TOKEN and EC_FORK_OWNER",
    );
  return env;
}

async function github(path: string, init?: RequestInit) {
  const token = config().GITHUB_EC_TOKEN!;
  const response = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2026-03-10",
      "Content-Type": "application/json",
      ...init?.headers,
    },
    cache: "no-store",
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`GitHub API ${response.status}: ${body.slice(0, 500)}`);
  }
  return response.status === 204
    ? null
    : ((await response.json()) as GithubResponse);
}

export async function createEcPullRequest(input: {
  repositoryUrl: string;
  batchId: string;
  title?: string;
  body?: string;
}) {
  const env = config();
  const upstream = await github(
    `/repos/${env.EC_UPSTREAM_OWNER}/${env.EC_UPSTREAM_REPOSITORY}`,
  );
  const fork = await github(
    `/repos/${env.EC_FORK_OWNER}/${env.EC_FORK_REPOSITORY}`,
  );
  if (!upstream || !fork)
    throw new Error("GitHub repository metadata is unavailable");
  const base = String(upstream.default_branch ?? "master");
  const forkOwner = String(
    (fork.owner as { login?: string })?.login ?? env.EC_FORK_OWNER,
  );
  const ref = await github(
    `/repos/${env.EC_UPSTREAM_OWNER}/${env.EC_UPSTREAM_REPOSITORY}/git/ref/heads/${base}`,
  );
  if (!ref) throw new Error("GitHub base branch is unavailable");
  const baseSha = String((ref.object as { sha: string }).sha);
  const branch = `ec/kiteai/${input.batchId}`;
  try {
    await github(`/repos/${forkOwner}/${env.EC_FORK_REPOSITORY}/git/refs`, {
      method: "POST",
      body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: baseSha }),
    });
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes("422"))
      throw error;
  }
  const path = `migrations/${new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "")}_kiteai_${input.batchId}`;
  const content = `-- Added through KiteAI Bounty Dashboard\nrepadd KiteAI ${input.repositoryUrl}\n`;
  const file = await github(
    `/repos/${forkOwner}/${env.EC_FORK_REPOSITORY}/contents/${path}`,
    {
      method: "PUT",
      body: JSON.stringify({
        message: `Add KiteAI repository ${input.repositoryUrl}`,
        content: Buffer.from(content).toString("base64"),
        branch,
      }),
    },
  );
  if (!file) throw new Error("GitHub file write returned no response");
  let pr: GithubResponse | null;
  try {
    pr = await github(
      `/repos/${env.EC_UPSTREAM_OWNER}/${env.EC_UPSTREAM_REPOSITORY}/pulls`,
      {
        method: "POST",
        body: JSON.stringify({
          title: input.title ?? `Add KiteAI repository: ${input.repositoryUrl}`,
          head: `${forkOwner}:${branch}`,
          base,
          body:
            input.body ??
            `Submitted by KiteAI Bounty Dashboard.\n\nRepository: ${input.repositoryUrl}`,
        }),
      },
    );
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes("GitHub API 403"))
      throw error;
    return {
      branch,
      path,
      baseSha,
      headSha: String((file?.commit as { sha?: string })?.sha ?? ""),
      contentHash: createHash("sha256").update(content).digest("hex"),
      prNumber: null,
      prUrl: `https://github.com/${env.EC_UPSTREAM_OWNER}/${env.EC_UPSTREAM_REPOSITORY}/compare/${base}...${forkOwner}:${branch}?expand=1`,
      manual: true,
    };
  }
  if (!pr) throw new Error("GitHub PR creation returned no response");
  return {
    branch,
    path,
    baseSha,
    headSha: String((file?.commit as { sha?: string })?.sha ?? ""),
    contentHash: createHash("sha256").update(content).digest("hex"),
    prNumber: Number(pr?.number),
    prUrl: String(pr?.html_url),
    manual: false,
  };
}

export async function syncEcPullRequest(input: {
  prNumber: number;
  owner?: string;
  repository?: string;
}) {
  const env = config();
  const owner = input.owner ?? env.EC_UPSTREAM_OWNER;
  const repository = input.repository ?? env.EC_UPSTREAM_REPOSITORY;
  const pr = await github(
    `/repos/${owner}/${repository}/pulls/${input.prNumber}`,
  );
  if (!pr) throw new Error("GitHub PR status is unavailable");
  return {
    state: String(pr.state) === "open" ? "open" : "closed",
    merged: Boolean(pr.merged_at),
    mergedAt: pr.merged_at ? String(pr.merged_at) : null,
    headSha: String((pr.head as { sha?: string })?.sha ?? ""),
  } as const;
}

/**
 * Verifies that the merged upstream tree contains the Open Dev Data DSL entry
 * generated for a repository. This is deliberately checked after merge so a
 * closed or rewritten PR cannot unlock a completion by itself.
 */
export async function verifyEcRepository(repositoryUrl: string) {
  const env = config();
  const upstream = await github(
    `/repos/${env.EC_UPSTREAM_OWNER}/${env.EC_UPSTREAM_REPOSITORY}`,
  );
  const branch = String(upstream?.default_branch ?? "master");
  const expected = repositoryUrl.replace(/\.git$/, "").replace(/\/$/, "");
  const escaped = expected.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const line = new RegExp(`^repadd\\s+KiteAI\\s+${escaped}(?:\\s|$)`, "mi");
  const removal = new RegExp(
    `^(?:repdel|repremove|repdrop)\\s+KiteAI\\s+${escaped}(?:\\s|$)`,
    "mi",
  );
  // Code search covers older migrations without fetching thousands of blobs.
  // A recent-tree fallback below handles GitHub search indexing delay.
  try {
    const query = `"${expected}" repo:${env.EC_UPSTREAM_OWNER}/${env.EC_UPSTREAM_REPOSITORY} path:migrations`;
    const search = await github(
      `/search/code?q=${encodeURIComponent(query)}&per_page=100`,
      { headers: { Accept: "application/vnd.github+json" } },
    );
    const matches = Array.isArray(search?.items) ? search.items : [];
    const history: Array<{ path: string; action: "add" | "remove" }> = [];
    for (const match of matches.slice(0, 50)) {
      if (!match || typeof match !== "object") continue;
      const path = String((match as { path?: unknown }).path ?? "");
      if (!path.startsWith("migrations/")) continue;
      const file = await github(
        `/repos/${env.EC_UPSTREAM_OWNER}/${env.EC_UPSTREAM_REPOSITORY}/contents/${path
          .split("/")
          .map(encodeURIComponent)
          .join("/")}?ref=${encodeURIComponent(branch)}`,
      );
      if (!file || typeof file.content !== "string") continue;
      const content = Buffer.from(
        String(file.content).replace(/\s/g, ""),
        "base64",
      ).toString("utf8");
      if (line.test(content)) history.push({ path, action: "add" });
      if (removal.test(content)) history.push({ path, action: "remove" });
    }
    history.sort((a, b) => a.path.localeCompare(b.path));
    if (history.length) return history.at(-1)?.action === "add";
  } catch {
    // Fall through to the bounded recent migration scan.
  }
  const tree = await github(
    `/repos/${env.EC_UPSTREAM_OWNER}/${env.EC_UPSTREAM_REPOSITORY}/git/trees/${encodeURIComponent(branch)}?recursive=1`,
  );
  const entries = Array.isArray(tree?.tree) ? tree.tree : [];
  const migrationEntries = entries.filter(
    (entry): entry is { path: string; type: string; sha: string } =>
      Boolean(
        entry &&
        typeof entry === "object" &&
        String((entry as { path?: unknown }).path ?? "").startsWith(
          "migrations/",
        ) &&
        (entry as { type?: unknown }).type === "blob" &&
        typeof (entry as { sha?: unknown }).sha === "string",
      ),
  );
  // Keep verification bounded even while the upstream repository grows.
  for (const entry of migrationEntries.slice(-300).reverse()) {
    const blob = await github(
      `/repos/${env.EC_UPSTREAM_OWNER}/${env.EC_UPSTREAM_REPOSITORY}/git/blobs/${entry.sha}`,
    );
    if (!blob || typeof blob.content !== "string") continue;
    const content = Buffer.from(
      String(blob.content).replace(/\s/g, ""),
      "base64",
    ).toString("utf8");
    if (removal.test(content)) return false;
    if (line.test(content)) return true;
  }
  return false;
}
