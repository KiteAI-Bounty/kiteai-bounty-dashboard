import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readEnvironment } from "../src/config/env";
import { getDb } from "../src/lib/db";
import { runNextJob } from "../src/workers/queue";

async function main() {
  const env = readEnvironment(process.env);
  assert.equal(
    env.APP_ENV,
    "development",
    "Database tests are development-only.",
  );
  assert.ok(
    new URL(env.DATABASE_URL!).pathname.endsWith("_test"),
    "Use a dedicated database whose name ends in _test.",
  );
  const db = getDb();
  assert.equal(
    await db.job.count(),
    0,
    "Use a test database with an empty job queue.",
  );
  const prefix = `test-${randomUUID()}`;
  // All domain writes are rolled back, including intentional unique-constraint failures.
  const duplicate = async (work: Parameters<typeof db.$transaction>[0]) => {
    await assert.rejects(
      () => db.$transaction(work),
      (error: unknown) =>
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "P2002",
    );
  };
  // Explicit transactions keep these checks from leaving test users behind.
  await duplicate(async (tx) => {
    await tx.user.create({
      data: { wallet: "0x0000000000000000000000000000000000000011" },
    });
    await tx.user.create({
      data: { wallet: "0x0000000000000000000000000000000000000011" },
    });
  });
  await duplicate(async (tx) => {
    const a = await tx.user.create({
      data: { wallet: "0x0000000000000000000000000000000000000011" },
    });
    const b = await tx.user.create({
      data: { wallet: "0x0000000000000000000000000000000000000012" },
    });
    await tx.githubAccount.create({
      data: { userId: a.id, githubUserId: 1001n, login: "test-a" },
    });
    await tx.githubAccount.create({
      data: { userId: b.id, githubUserId: 1001n, login: "test-b" },
    });
  });
  await duplicate(async (tx) => {
    await tx.participantInvite.create({
      data: {
        displayName: "Invite A",
        contact: `${prefix}-contact`,
        wallet: "0x0000000000000000000000000000000000000021",
      },
    });
    await tx.participantInvite.create({
      data: {
        displayName: "Invite B",
        contact: `${prefix}-contact`,
        wallet: "0x0000000000000000000000000000000000000022",
      },
    });
  });
  await duplicate(async (tx) => {
    await tx.participantInvite.create({
      data: {
        displayName: "Invite A",
        contact: `${prefix}-wallet-a`,
        wallet: "0x0000000000000000000000000000000000000021",
      },
    });
    await tx.participantInvite.create({
      data: {
        displayName: "Invite B",
        contact: `${prefix}-wallet-b`,
        wallet: "0x0000000000000000000000000000000000000021",
      },
    });
  });
  await duplicate(async (tx) => {
    const user = await tx.user.create({
      data: { wallet: "0x0000000000000000000000000000000000000011" },
    });
    const repo = await tx.repository.create({
      data: {
        githubRepoId: 1001n,
        url: "https://github.com/example/framework-test",
        name: "framework-test",
        owner: "example",
        description: "test",
        direction: "test",
        integration: "test",
        defaultBranch: "main",
      },
    });
    const data = {
      userId: user.id,
      weekId: "kiteai-p1-w1",
      repositoryId: repo.id,
    };
    await tx.submission.create({ data });
    await tx.submission.create({ data });
  });
  try {
    const ping = await db.job.create({
      data: {
        key: `${prefix}-ping`,
        type: "system.ping",
        payload: {},
        runAt: new Date(0),
      },
    });
    const claimed = await Promise.all([runNextJob(), runNextJob()]);
    assert.equal(
      claimed.filter(Boolean).length,
      1,
      "Concurrent workers must not claim the same job.",
    );
    const completed = await db.job.findUniqueOrThrow({
      where: { id: ping.id },
    });
    assert.equal(completed.status, "SUCCEEDED");
    assert.equal(completed.attempts, 1);
    const unknown = await db.job.create({
      data: {
        key: `${prefix}-unknown`,
        type: "ec.create-pr",
        payload: {},
        maxAttempts: 1,
        runAt: new Date(0),
      },
    });
    await runNextJob();
    assert.equal(
      (await db.job.findUniqueOrThrow({ where: { id: unknown.id } })).status,
      "FAILED",
    );
    const expired = await db.job.create({
      data: {
        key: `${prefix}-expired`,
        type: "system.ping",
        payload: {},
        status: "RUNNING",
        attempts: 1,
        maxAttempts: 1,
        lockedBy: "old-worker",
        lockedUntil: new Date(0),
      },
    });
    await runNextJob();
    assert.equal(
      (await db.job.findUniqueOrThrow({ where: { id: expired.id } })).status,
      "FAILED",
    );
    const aiUser = await db.user.create({
      data: { wallet: "0x0000000000000000000000000000000000000099" },
    });
    await db.githubAccount.create({
      data: {
        userId: aiUser.id,
        githubUserId: 9099n,
        login: "ai-test-contributor",
      },
    });
    const aiRepository = await db.repository.create({
      data: {
        githubRepoId: 9099n,
        url: "https://github.com/example/ai-worker-test",
        name: "ai-worker-test",
        owner: "example",
        description: "KiteAI integration test repository",
        direction: "x402-service",
        integration: "KiteAI x402",
        defaultBranch: "main",
      },
    });
    const aiSubmission = await db.submission.create({
      data: {
        userId: aiUser.id,
        weekId: "kiteai-p1-w1",
        repositoryId: aiRepository.id,
        direction: "x402-service",
        revisions: {
          create: {
            version: 1,
            summary: "Implemented a tested KiteAI x402 payment integration.",
            aiScope: "COMMIT",
            evidence: {
              create: {
                sha: "9".repeat(40),
                githubAuthorId: 9099n,
                authoredAt: new Date("2026-09-10T00:00:00Z"),
                committedAt: new Date("2026-09-10T00:00:00Z"),
                url: `https://github.com/example/ai-worker-test/commit/${"9".repeat(40)}`,
                snapshot: {
                  stats: { additions: 20, deletions: 2 },
                  parents: [{ sha: "parent" }],
                },
              },
            },
          },
        },
      },
      include: { revisions: true },
    });
    const aiRevision = aiSubmission.revisions[0];
    await db.job.create({
      data: {
        key: `${prefix}-ai`,
        type: "ai.analyze_submission",
        payload: { revisionId: aiRevision.id },
        runAt: new Date(0),
      },
    });
    const originalFetch = globalThis.fetch;
    const originalGlmKey = process.env.GLM_API_KEY;
    process.env.GLM_API_KEY = "database-test-key";
    globalThis.fetch = async () =>
      Response.json({
        choices: [
          {
            message: {
              content: JSON.stringify({
                verdict: "PASS_RECOMMENDED",
                summary: "The commit contains a relevant KiteAI integration.",
                findings: [
                  {
                    check: "KiteAI relevance",
                    status: "PASS",
                    evidence: "Submitted commit snapshot",
                    reason: "The contribution implements KiteAI x402.",
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
    try {
      assert.equal(await runNextJob(), true);
      const analyzed = await db.submissionRevision.findUniqueOrThrow({
        where: { id: aiRevision.id },
      });
      assert.equal(analyzed.aiStatus, "SUCCEEDED");
      assert.equal(analyzed.aiVerdict, "PASS_RECOMMENDED");
    } finally {
      globalThis.fetch = originalFetch;
      if (originalGlmKey === undefined) delete process.env.GLM_API_KEY;
      else process.env.GLM_API_KEY = originalGlmKey;
      await db.job.deleteMany({ where: { key: `${prefix}-ai` } });
      await db.contributionEvidence.deleteMany({
        where: { revisionId: aiRevision.id },
      });
      await db.submissionRevision.delete({ where: { id: aiRevision.id } });
      await db.submission.delete({ where: { id: aiSubmission.id } });
      await db.repository.delete({ where: { id: aiRepository.id } });
      await db.githubAccount.delete({ where: { userId: aiUser.id } });
      await db.user.delete({ where: { id: aiUser.id } });
    }
    console.log(
      "PASS: uniqueness; concurrent claim; unsupported job; expired lease; AI worker persistence.",
    );
  } finally {
    await db.job.deleteMany({ where: { key: { startsWith: prefix } } });
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (process.env.DATABASE_URL) await getDb().$disconnect();
  });
