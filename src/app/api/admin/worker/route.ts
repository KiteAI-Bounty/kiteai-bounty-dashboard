import { apiError, ok } from "@/lib/api";
import { getDb } from "@/lib/db";
import { assertSameOrigin } from "@/modules/auth/http";
import { requireAdmin } from "@/modules/auth/service";
import { runNextJob } from "@/workers/queue";
import { getWorkerQueueStatus } from "@/workers/status";

export const runtime = "nodejs";
export const maxDuration = 90;

export async function GET() {
  try {
    await requireAdmin();
    return ok(await getWorkerQueueStatus());
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const admin = await requireAdmin();
    const before = await getWorkerQueueStatus();
    const processed = await runNextJob();
    const after = await getWorkerQueueStatus();
    await getDb().auditLog.create({
      data: {
        actorId: admin.userId,
        action: "worker.run_once",
        entityType: "Job",
        entityId: "queue",
        before,
        after: { ...after, processed },
      },
    });
    return ok({ processed, status: after });
  } catch (error) {
    return apiError(error);
  }
}
