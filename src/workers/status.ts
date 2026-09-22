import { getDb } from "@/lib/db";

export type WorkerQueueStatus = {
  pending: number;
  due: number;
  running: number;
  stale: number;
  failed: number;
  oldestDueAt: string | null;
  oldestDueAgeSeconds: number | null;
  healthy: boolean;
};

export async function getWorkerQueueStatus(): Promise<WorkerQueueStatus> {
  const db = getDb();
  const now = new Date();
  const [groups, due, stale, oldestDue] = await Promise.all([
    db.job.groupBy({ by: ["status"], _count: { _all: true } }),
    db.job.count({ where: { status: "PENDING", runAt: { lte: now } } }),
    db.job.count({
      where: { status: "RUNNING", lockedUntil: { lt: now } },
    }),
    db.job.findFirst({
      where: { status: "PENDING", runAt: { lte: now } },
      orderBy: { runAt: "asc" },
      select: { runAt: true },
    }),
  ]);
  const count = (status: "PENDING" | "RUNNING" | "FAILED") =>
    groups.find((group) => group.status === status)?._count._all ?? 0;
  const oldestDueAgeSeconds = oldestDue
    ? Math.max(
        0,
        Math.floor((now.getTime() - oldestDue.runAt.getTime()) / 1000),
      )
    : null;
  const failed = count("FAILED");
  return {
    pending: count("PENDING"),
    due,
    running: count("RUNNING"),
    stale,
    failed,
    oldestDueAt: oldestDue?.runAt.toISOString() ?? null,
    oldestDueAgeSeconds,
    healthy:
      stale === 0 &&
      failed === 0 &&
      (oldestDueAgeSeconds === null || oldestDueAgeSeconds < 300),
  };
}
