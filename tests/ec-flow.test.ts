import assert from "node:assert/strict";
import { test } from "node:test";

const repositoryUrl =
  "https://github.com/memeScan/bybit-hypeliquid-funding-arbitrage";
process.env.GITHUB_EC_TOKEN = "test-token";
process.env.EC_FORK_OWNER = "Anyi-zheng";
process.env.EC_FORK_REPOSITORY = "open-dev-data";
process.env.EC_UPSTREAM_OWNER = "electric-capital";
process.env.EC_UPSTREAM_REPOSITORY = "open-dev-data";

test("EC flow creates a PR payload for the supplied repository", async () => {
  const originalFetch = globalThis.fetch;
  const calls: string[] = [];
  const pullRequestBody: Record<string, unknown> = {};
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    calls.push(`${init?.method ?? "GET"} ${url}`);
    if (url.endsWith("/repos/electric-capital/open-dev-data"))
      return Response.json({ default_branch: "master" });
    if (url.endsWith("/repos/Anyi-zheng/open-dev-data"))
      return Response.json({ owner: { login: "Anyi-zheng" } });
    if (url.includes("/git/ref/heads/master"))
      return Response.json({ object: { sha: "base-sha" } });
    if (url.endsWith("/git/refs")) return Response.json({ ref: "created" });
    if (url.includes("/contents/migrations/"))
      return Response.json({ commit: { sha: "head-sha" } });
    if (url.endsWith("/pulls")) {
      Object.assign(pullRequestBody, JSON.parse(String(init?.body)));
      return Response.json({
        number: 123,
        html_url: "https://github.com/electric-capital/open-dev-data/pull/123",
      });
    }
    throw new Error(`Unexpected mocked GitHub request: ${url}`);
  };
  try {
    const { createEcPullRequest } =
      await import("../src/modules/ec/github-provider");
    const result = await createEcPullRequest({
      repositoryUrl,
      batchId: "test-batch",
      title: "Add a tested KiteAI repository",
      body: "Evidence-based repository description",
    });
    assert.equal(result.prNumber, 123);
    assert.match(result.prUrl, /open-dev-data\/pull\/123$/);
    assert.ok(calls.some((call) => call.includes("/pulls")));
    assert.equal(pullRequestBody?.title, "Add a tested KiteAI repository");
    assert.equal(
      pullRequestBody?.body,
      "Evidence-based repository description",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("EC sync maps merged and closed PRs to the expected states", async () => {
  const originalFetch = globalThis.fetch;
  let merged = true;
  globalThis.fetch = async () =>
    Response.json({
      state: "closed",
      merged_at: merged ? "2026-09-10T00:00:00Z" : null,
      head: { sha: "head-sha" },
    });
  try {
    const { syncEcPullRequest } =
      await import("../src/modules/ec/github-provider");
    assert.equal((await syncEcPullRequest({ prNumber: 123 })).merged, true);
    merged = false;
    const closed = await syncEcPullRequest({ prNumber: 123 });
    assert.equal(closed.merged, false);
    assert.equal(closed.state, "closed");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("EC repository verification follows the latest taxonomy migration", async () => {
  const originalFetch = globalThis.fetch;
  let includeRemoval = false;
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.endsWith("/repos/electric-capital/open-dev-data"))
      return Response.json({ default_branch: "master" });
    if (url.includes("/search/code"))
      return Response.json({
        items: [
          { path: "migrations/2026-09-01T000000_add_kite_repo" },
          ...(includeRemoval
            ? [{ path: "migrations/2026-09-02T000000_remove_kite_repo" }]
            : []),
        ],
      });
    if (url.includes("2026-09-01T000000_add_kite_repo"))
      return Response.json({
        content: Buffer.from(`repadd KiteAI ${repositoryUrl}\n`).toString(
          "base64",
        ),
      });
    if (url.includes("2026-09-02T000000_remove_kite_repo"))
      return Response.json({
        content: Buffer.from(`repdel KiteAI ${repositoryUrl}\n`).toString(
          "base64",
        ),
      });
    throw new Error(`Unexpected mocked GitHub request: ${url}`);
  };
  try {
    const { verifyEcRepository } =
      await import("../src/modules/ec/github-provider");
    assert.equal(await verifyEcRepository(repositoryUrl), true);
    includeRemoval = true;
    assert.equal(await verifyEcRepository(repositoryUrl), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("EC batch verification reads its known migration directly", async () => {
  const originalFetch = globalThis.fetch;
  const calls: string[] = [];
  globalThis.fetch = async (input) => {
    const url = String(input);
    calls.push(url);
    if (url.endsWith("/repos/electric-capital/open-dev-data"))
      return Response.json({ default_branch: "master" });
    if (url.includes("/contents/migrations/known-entry"))
      return Response.json({
        content: Buffer.from(`repadd KiteAI ${repositoryUrl}\n`).toString(
          "base64",
        ),
      });
    throw new Error(`Unexpected mocked GitHub request: ${url}`);
  };
  try {
    const { verifyEcMigration } =
      await import("../src/modules/ec/github-provider");
    assert.equal(
      await verifyEcMigration(repositoryUrl, "migrations/known-entry"),
      true,
    );
    assert.equal(calls.length, 2);
    assert.equal(
      calls.some((call) => call.includes("/search/code")),
      false,
    );
    assert.equal(
      calls.some((call) => call.includes("/git/trees/")),
      false,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
