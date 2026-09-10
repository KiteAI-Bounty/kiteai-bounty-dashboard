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
      data: { key: `${prefix}-ping`, type: "system.ping", payload: {} },
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
    console.log(
      "PASS: wallet/GitHub/invite/weekly uniqueness; concurrent claim; unsupported job; expired lease.",
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
