import assert from "node:assert/strict";
import { test } from "node:test";
import {
  analyzeContribution,
  distinctBeijingContributionDays,
} from "../src/modules/ai/glm";

const evidence = [
  {
    sha: "a".repeat(40),
    url: `https://github.com/example/kite/commit/${"a".repeat(40)}`,
    authoredAt: new Date("2026-09-10T15:59:00Z"),
    committedAt: new Date("2026-09-10T16:01:00Z"),
    snapshot: { stats: { additions: 10, deletions: 2 }, parents: [{}] },
  },
  {
    sha: "b".repeat(40),
    url: `https://github.com/example/kite/commit/${"b".repeat(40)}`,
    authoredAt: new Date("2026-09-10T16:01:00Z"),
    committedAt: new Date("2026-09-10T16:01:00Z"),
    snapshot: { stats: { additions: 8, deletions: 1 }, parents: [{}] },
  },
];

test("active contribution days use the campaign timezone", () => {
  assert.equal(distinctBeijingContributionDays(evidence), 2);
});

test("GLM commit analysis parses structured output and keeps deterministic day count", async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.GLM_API_KEY;
  process.env.GLM_API_KEY = "test-key";
  globalThis.fetch = async (input, init) => {
    assert.match(String(input), /\/chat\/completions$/);
    const body = JSON.parse(String(init?.body));
    assert.equal(body.model, "glm-4-flash");
    return Response.json({
      choices: [
        {
          message: {
            content: JSON.stringify({
              verdict: "PASS_RECOMMENDED",
              summary:
                "The commits contain substantive KiteAI integration work.",
              findings: [
                {
                  check: "authorship",
                  status: "PASS",
                  evidence: "GitHub author matches",
                  reason: "The supplied snapshot identifies the contributor.",
                },
              ],
              missingEvidence: [],
              activeDays: 1,
              prTitle: null,
              prBody: null,
            }),
          },
        },
      ],
    });
  };
  try {
    const result = await analyzeContribution({
      scope: "COMMIT",
      repository: {
        owner: "example",
        name: "kite",
        url: "https://github.com/example/kite",
        description: "KiteAI integration",
        defaultBranch: "main",
        isFork: false,
      },
      direction: "x402-service",
      participantSummary:
        "Implemented the KiteAI payment integration and tests.",
      githubLogin: "contributor",
      evidence,
    });
    assert.equal(result.verdict, "PASS_RECOMMENDED");
    assert.equal(result.activeDays, 2);
    assert.equal(result.model, "glm-4-flash");
    assert.match(result.inputHash, /^[0-9a-f]{64}$/);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.GLM_API_KEY;
    else process.env.GLM_API_KEY = originalKey;
  }
});
