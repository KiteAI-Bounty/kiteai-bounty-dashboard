import { randomUUID } from "node:crypto";
import { getDb } from "@/lib/db";
import type { Job } from "@/generated/prisma/client";
import { handleJob } from "./handlers";

// A new token per acquisition fences out workers whose leases expired.
export async function runNextJob(): Promise<boolean> {
  const db = getDb();
  const token = randomUUID();
  await db.$executeRaw`UPDATE "Job" SET "status" = 'FAILED', "lastError" = 'Lease expired after retry limit',
    "lockedBy" = NULL, "lockedUntil" = NULL
    WHERE "status" = 'RUNNING' AND "lockedUntil" < NOW() AND "attempts" >= "maxAttempts"`;
  const jobs = await db.$queryRaw<Job[]>`
    UPDATE "Job" SET "status" = 'RUNNING', "attempts" = "attempts" + 1,
      "lockedBy" = ${token}, "lockedUntil" = NOW() + INTERVAL '60 seconds'
    WHERE "id" = (
      SELECT "id" FROM "Job"
      WHERE (("status" = 'PENDING' AND "runAt" <= NOW())
        OR ("status" = 'RUNNING' AND "lockedUntil" < NOW()))
        AND "attempts" < "maxAttempts"
      ORDER BY "runAt", "createdAt" FOR UPDATE SKIP LOCKED LIMIT 1
    ) RETURNING *`;
  const job = jobs[0];
  if (!job) return false;
  // Only the short system.ping handler is enabled. Add lease renewal before adding long external jobs.
  try {
    await handleJob(job);
    await db.job.updateMany({
      where: { id: job.id, lockedBy: token, status: "RUNNING" },
      data: {
        status: "SUCCEEDED",
        lockedBy: null,
        lockedUntil: null,
        lastError: null,
      },
    });
  } catch (error) {
    await db.job.updateMany({
      where: { id: job.id, lockedBy: token, status: "RUNNING" },
      data: {
        status: job.attempts >= job.maxAttempts ? "FAILED" : "PENDING",
        lockedBy: null,
        lockedUntil: null,
        runAt: new Date(Date.now() + Math.min(60, 2 ** job.attempts) * 1000),
        lastError:
          error instanceof Error ? error.message : "Unknown worker error",
      },
    });
    console.error(
      JSON.stringify({
        event: "job.failed",
        jobId: job.id,
        attempt: job.attempts,
      }),
    );
  }
  return true;
}
