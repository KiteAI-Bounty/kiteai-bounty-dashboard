import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { syncEcPullRequest } from "../src/modules/ec/github-provider";

const token = process.env.GITHUB_EC_TOKEN;
const [owner, repository] = (process.env.EC_REAL_TEST_REPOSITORY ?? "Anyi-zheng/kiteai-passport-layerzero").split("/");
if (!token || !owner || !repository) throw new Error("GITHUB_EC_TOKEN and EC_REAL_TEST_REPOSITORY are required");

async function github(path: string, init?: RequestInit) {
  const response = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${token}`, "X-GitHub-Api-Version": "2022-11-28", "Content-Type": "application/json" },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`GitHub API ${response.status}: ${JSON.stringify(body)}`);
  return body as Record<string, unknown>;
}

async function main() {
const repo = await github(`/repos/${owner}/${repository}`);
const base = String(repo.default_branch ?? "main");
const ref = await github(`/repos/${owner}/${repository}/git/ref/heads/${base}`);
const branch = `ec-monitor-test-${Date.now()}`;
const baseSha = String((ref.object as { sha?: string }).sha);
await github(`/repos/${owner}/${repository}/git/refs`, { method: "POST", body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: baseSha }) });
const path = `.ec-monitor-test/${randomUUID()}.md`;
await github(`/repos/${owner}/${repository}/contents/${path}`, { method: "PUT", body: JSON.stringify({ message: "test: verify EC merged status monitor", content: Buffer.from("Temporary integration test file.\n").toString("base64"), branch }) });
const pr = await github(`/repos/${owner}/${repository}/pulls`, { method: "POST", body: JSON.stringify({ title: "test: EC merged status monitor", head: branch, base, body: "Temporary automated integration test. Safe to delete after verification." }) });
const merged = await github(`/repos/${owner}/${repository}/pulls/${pr.number}/merge`, { method: "PUT", body: JSON.stringify({ merge_method: "squash" }) });
assert.equal(merged.merged, true, `PR was not merged: ${JSON.stringify(merged)}`);
const state = await syncEcPullRequest({ owner, repository, prNumber: Number(pr.number) });
assert.equal(state.merged, true);
console.log(JSON.stringify({ repository: `${owner}/${repository}`, prNumber: pr.number, prUrl: pr.html_url, status: "MERGED", monitorDetected: state.merged }, null, 2));
}
main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
