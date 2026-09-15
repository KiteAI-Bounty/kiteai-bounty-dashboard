import { z } from "zod";
import { ApiError, apiError, ok } from "@/lib/api";
import { getDb } from "@/lib/db";
import { requireAdmin } from "@/modules/auth/service";
import { reviewInput } from "@/modules/reviews/contracts";

const input = reviewInput.extend({ submissionId: z.string().min(1) });

export async function GET() {
  try {
    await requireAdmin();
    const items = await getDb().submission.findMany({
      where: { status: { in: ["SUBMITTED", "CHANGES_REQUESTED"] } },
      orderBy: { submittedAt: "asc" },
      include: {
        user: { include: { github: true } },
        week: true,
        repository: true,
        revisions: {
          orderBy: { version: "desc" },
          take: 1,
          include: { evidence: true },
        },
      },
    });
    return ok(items);
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin();
    const body = input.parse(await request.json());
    const result = await getDb().$transaction(async (tx) => {
      const submission = await tx.submission.findUnique({
        where: { id: body.submissionId },
        include: { revisions: { where: { id: body.revisionId } } },
      });
      const revision = submission?.revisions[0];
      if (!submission || !revision || revision.version !== body.version)
        throw new ApiError(
          "REVISION_CONFLICT",
          "提交版本已更新，请刷新后重试。",
          409,
        );
      if (
        submission.status !== "SUBMITTED" &&
        submission.status !== "CHANGES_REQUESTED"
      )
        throw new ApiError(
          "SUBMISSION_NOT_REVIEWABLE",
          "该提交当前不可审核。",
          409,
        );
      if (
        body.decision === "APPROVED" &&
        process.env.GLM_API_KEY &&
        revision.aiStatus !== "SUCCEEDED"
      )
        throw new ApiError(
          "AI_REVIEW_PENDING",
          "GLM 预检查尚未完成，请等待分析或点击重新分析。",
          409,
        );
      const updated = await tx.submission.update({
        where: { id: submission.id },
        data: { status: body.decision },
        select: { id: true, status: true, version: true },
      });
      await tx.submissionReview.create({
        data: {
          revisionId: revision.id,
          reviewerId: admin.userId,
          decision: body.decision,
          note: body.note,
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: admin.userId,
          action: `submission.review.${body.decision.toLowerCase()}`,
          entityType: "Submission",
          entityId: submission.id,
          after: {
            revisionId: revision.id,
            version: body.version,
            note: body.note,
          },
        },
      });
      if (body.decision === "APPROVED") {
        await tx.job.upsert({
          where: {
            key: `ec.register.submission.${submission.id}.v${body.version}`,
          },
          update: {
            status: "PENDING",
            attempts: 0,
            lastError: null,
            runAt: new Date(),
            lockedBy: null,
            lockedUntil: null,
          },
          create: {
            type: "ec.register_submission",
            key: `ec.register.submission.${submission.id}.v${body.version}`,
            payload: {
              submissionId: submission.id,
              revisionId: revision.id,
              version: body.version,
            },
          },
        });
      }
      return updated;
    });
    return ok(result);
  } catch (error) {
    return apiError(error);
  }
}
