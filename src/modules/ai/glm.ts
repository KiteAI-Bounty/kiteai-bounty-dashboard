import { createHash } from "node:crypto";
import { z } from "zod";
import { readEnvironment } from "@/config/env";

export type AiReviewScope = "REPOSITORY" | "COMMIT";

export type ContributionAnalysisInput = {
  scope: AiReviewScope;
  repository: {
    owner: string;
    name: string;
    url: string;
    description: string;
    defaultBranch: string;
    isFork: boolean;
  };
  direction: string;
  participantSummary: string;
  githubLogin: string;
  evidence: Array<{
    sha: string;
    url: string;
    authoredAt: Date;
    committedAt: Date;
    snapshot: unknown;
  }>;
};

const analysisSchema = z.object({
  verdict: z.enum(["PASS_RECOMMENDED", "CHANGES_RECOMMENDED", "HIGH_RISK"]),
  summary: z.string().min(1).max(3000),
  findings: z
    .array(
      z.object({
        check: z.string().min(1).max(200),
        status: z.enum(["PASS", "WARNING", "FAIL"]),
        evidence: z
          .string()
          .max(2000)
          .nullish()
          .transform((v) => v ?? ""),
        reason: z
          .string()
          .max(2000)
          .nullish()
          .transform((v) => v ?? ""),
      }),
    )
    .max(30),
  missingEvidence: z.array(z.string().max(1000)).max(20).default([]),
  activeDays: z.number().int().min(0).max(31),
  prTitle: z.string().max(240).nullable().default(null),
  prBody: z.string().max(12000).nullable().default(null),
});

export type ContributionAnalysis = z.infer<typeof analysisSchema> & {
  model: string;
  inputHash: string;
};

function githubHeaders() {
  const env = readEnvironment(process.env);
  const token = env.GITHUB_READ_TOKEN ?? env.GITHUB_EC_TOKEN;
  return {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2026-03-10",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function githubJson(path: string) {
  const response = await fetch(`https://api.github.com${path}`, {
    headers: githubHeaders(),
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) return null;
  return response.json() as Promise<Record<string, unknown>>;
}

function decodeContent(value: unknown, limit: number) {
  if (typeof value !== "string") return "";
  return Buffer.from(value.replace(/\s/g, ""), "base64")
    .toString("utf8")
    .slice(0, limit);
}

function encodeGithubPath(path: string) {
  return path.split("/").map(encodeURIComponent).join("/");
}

async function collectRepositoryContext(input: ContributionAnalysisInput) {
  if (input.scope !== "REPOSITORY") return null;
  const base = `/repos/${encodeURIComponent(input.repository.owner)}/${encodeURIComponent(input.repository.name)}`;
  const [readme, tree] = await Promise.all([
    githubJson(`${base}/readme`),
    githubJson(
      `${base}/git/trees/${encodeURIComponent(input.repository.defaultBranch)}?recursive=1`,
    ),
  ]);
  const readmeText = decodeContent(readme?.content, 8_000);
  const entries = Array.isArray(tree?.tree) ? tree.tree : [];
  const useful = entries
    .filter((entry): entry is { path: string; type: string } =>
      Boolean(
        entry &&
        typeof entry === "object" &&
        (entry as { type?: unknown }).type === "blob" &&
        typeof (entry as { path?: unknown }).path === "string",
      ),
    )
    .map((entry) => entry.path)
    .filter((path) =>
      /(^|\/)(package\.json|pyproject\.toml|requirements[^/]*\.txt|Cargo\.toml|go\.mod|pom\.xml|build\.gradle|foundry\.toml|hardhat\.config\.[^/]+|docker-compose\.ya?ml)$/i.test(
        path,
      ),
    )
    .slice(0, 5);
  const manifests = await Promise.all(
    useful.map(async (path) => {
      const file = await githubJson(
        `${base}/contents/${encodeGithubPath(path)}`,
      );
      return { path, content: decodeContent(file?.content, 3000) };
    }),
  );
  return {
    readme: readmeText,
    manifests: manifests.filter((item) => item.content),
    fileTree: entries
      .slice(0, 250)
      .map((entry) =>
        entry && typeof entry === "object"
          ? String((entry as { path?: unknown }).path ?? "")
          : "",
      )
      .filter(Boolean),
  };
}

function compactSnapshot(snapshot: unknown) {
  if (!snapshot || typeof snapshot !== "object") return snapshot;
  const value = snapshot as Record<string, unknown>;
  const commit =
    value.commit && typeof value.commit === "object"
      ? (value.commit as Record<string, unknown>)
      : {};
  const files = Array.isArray(value.files) ? value.files : [];
  return {
    author: value.author,
    committer: value.committer,
    stats: value.stats,
    parents: value.parents,
    commit: {
      message: commit.message,
      author: commit.author,
      committer: commit.committer,
    },
    files: files.slice(0, 15).map((file) => {
      const item = file as Record<string, unknown>;
      return {
        filename: item.filename,
        status: item.status,
        additions: item.additions,
        deletions: item.deletions,
        changes: item.changes,
        patch:
          typeof item.patch === "string" ? item.patch.slice(0, 1200) : null,
      };
    }),
  };
}

function parseJsonObject(value: string) {
  const cleaned = value
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("GLM 未返回 JSON 结果");
  return JSON.parse(cleaned.slice(start, end + 1)) as unknown;
}

export function distinctBeijingContributionDays(
  evidence: ContributionAnalysisInput["evidence"],
) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return new Set(evidence.map((item) => formatter.format(item.authoredAt)))
    .size;
}

export async function analyzeContribution(
  input: ContributionAnalysisInput,
): Promise<ContributionAnalysis> {
  const env = readEnvironment(process.env);
  if (!env.GLM_API_KEY) throw new Error("GLM_API_KEY 尚未配置");
  const repositoryContext = await collectRepositoryContext(input);
  const evidence = input.evidence.map((item) => ({
    sha: item.sha,
    url: item.url,
    authoredAt: item.authoredAt.toISOString(),
    committedAt: item.committedAt.toISOString(),
    snapshot: compactSnapshot(item.snapshot),
  }));
  const context = {
    scope: input.scope,
    repository: input.repository,
    direction: input.direction,
    participantSummary: input.participantSummary,
    githubLogin: input.githubLogin,
    evidence,
    repositoryContext,
  };
  const serialized = JSON.stringify(context);
  const inputHash = createHash("sha256").update(serialized).digest("hex");
  const system = `You are a strict pre-reviewer for Electric Capital Open Dev Data and the KiteAI contributor program.
Use only the supplied repository and commit evidence. Never invent files, integrations, tests, deployments, or Electric Capital rules.
Check public repository relevance, original authorship signals, non-bot and non-merge evidence, substantive code changes, KiteAI technical relevance, duplicate/template/fork risk, and reproducibility.
For REPOSITORY scope, write an evidence-based English PR title and PR body explaining what the repository does and why it belongs to KiteAI. For COMMIT scope, prTitle and prBody must be null.
Return one JSON object only with: verdict, summary, findings[{check,status,evidence,reason}], missingEvidence[], activeDays, prTitle, prBody.
verdict is PASS_RECOMMENDED, CHANGES_RECOMMENDED, or HIGH_RISK. status is PASS, WARNING, or FAIL. activeDays is the number of distinct authored calendar dates visible in the submitted evidence.
AI advice cannot guarantee Electric Capital acceptance or developer attribution.`;
  const response = await fetch(
    `${env.GLM_BASE_URL.replace(/\/$/, "")}/chat/completions`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.GLM_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: env.GLM_MODEL,
        temperature: 0.1,
        max_tokens: 2500,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: serialized },
        ],
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(55_000),
    },
  );
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`GLM API ${response.status}: ${detail.slice(0, 500)}`);
  }
  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = payload.choices?.[0]?.message?.content;
  if (!content) throw new Error("GLM 未返回分析内容");
  const parsed = analysisSchema.parse(parseJsonObject(content));
  return {
    ...parsed,
    activeDays: distinctBeijingContributionDays(input.evidence),
    model: env.GLM_MODEL,
    inputHash,
  };
}
