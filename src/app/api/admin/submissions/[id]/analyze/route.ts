import { ApiError, apiError, ok } from "@/lib/api";
import { getDb } from "@/lib/db";
import { requireAdmin } from "@/modules/auth/service";
import { Prisma } from "@/generated/prisma/client";

export async function POST(
  _request: Request,
  context: RouteContext<"/api/admin/submissions/[id]/analyze">,
) {
  try {
    const admin = await requireAdmin();
    const { id } = await context.params;
    const submission = await getDb().submission.findUnique({
      where: { id },
      include: {
        revisions: { orderBy: { version: "desc" }, take: 1 },
      },
    });
    const revision = submission?.revisions[0];
    if (!submission || !revision)
      throw new ApiError("SUBMISSION_NOT_FOUND", "没有找到提交记录。", 404);
    await getDb().$transaction(async (tx) => {
      await tx.submissionRevision.update({
        where: { id: revision.id },
        data: {
          aiStatus: "PENDING",
          aiVerdict: null,
          aiSummary: null,
          aiFindings: Prisma.DbNull,
          aiPrTitle: null,
          aiPrBody: null,
          aiModel: null,
          aiCheckedAt: null,
        },
      });
      await tx.job.upsert({
        where: { key: `ai.analyze.revision.${revision.id}` },
        update: {
          status: "PENDING",
          attempts: 0,
          lastError: null,
          runAt: new Date(),
          lockedBy: null,
          lockedUntil: null,
        },
        create: {
          type: "ai.analyze_submission",
          key: `ai.analyze.revision.${revision.id}`,
          payload: { revisionId: revision.id },
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: admin.userId,
          action: "submission.ai.requeue",
          entityType: "SubmissionRevision",
          entityId: revision.id,
          after: { submissionId: submission.id, version: revision.version },
        },
      });
    });
    return ok({ submissionId: submission.id, aiStatus: "PENDING" });
  } catch (error) {
    return apiError(error);
  }
}
