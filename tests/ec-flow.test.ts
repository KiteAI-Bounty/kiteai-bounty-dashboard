import assert from "node:assert/strict";
import { test } from "node:test";

const repositoryUrl = "https://github.com/memeScan/bybit-hypeliquid-funding-arbitrage";
process.env.GITHUB_EC_TOKEN = "test-token";
process.env.EC_FORK_OWNER = "Anyi-zheng";
process.env.EC_FORK_REPOSITORY = "open-dev-data";
process.env.EC_UPSTREAM_OWNER = "electric-capital";
process.env.EC_UPSTREAM_REPOSITORY = "open-dev-data";

test("EC flow creates a PR payload for the supplied repository", async () => {
  const originalFetch = globalThis.fetch;
  const calls: string[] = [];
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
    if (url.endsWith("/pulls"))
      return Response.json({ number: 123, html_url: "https://github.com/electric-capital/open-dev-data/pull/123" });
    throw new Error(`Unexpected mocked GitHub request: ${url}`);
  };
  try {
    const { createEcPullRequest } = await import("../src/modules/ec/github-provider");
    const result = await createEcPullRequest({ repositoryUrl, batchId: "test-batch" });
    assert.equal(result.prNumber, 123);
    assert.match(result.prUrl, /open-dev-data\/pull\/123$/);
    assert.ok(calls.some((call) => call.includes("/pulls")));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("EC sync maps merged and closed PRs to the expected states", async () => {
  const originalFetch = globalThis.fetch;
  let merged = true;
  globalThis.fetch = async () => Response.json({ state: "closed", merged_at: merged ? "2026-09-10T00:00:00Z" : null, head: { sha: "head-sha" } });
  try {
    const { syncEcPullRequest } = await import("../src/modules/ec/github-provider");
    assert.equal((await syncEcPullRequest({ prNumber: 123 })).merged, true);
    merged = false;
    const closed = await syncEcPullRequest({ prNumber: 123 });
    assert.equal(closed.merged, false);
    assert.equal(closed.state, "closed");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
