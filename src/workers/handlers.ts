import type { Job } from "@/generated/prisma/client";
import { getDb } from "@/lib/db";
import {
  createEcPullRequest,
  syncEcPullRequest,
  verifyEcRepository,
} from "@/modules/ec/github-provider";
import { getPaymentProvider } from "@/modules/rewards/provider";

export async function handleJob(job: Pick<Job, "id" | "type" | "payload">) {
  if (job.type === "ec.register_submission") {
    const payload = job.payload as {
      submissionId?: string;
      revisionId?: string;
      version?: number;
    };
    if (!payload.submissionId || !payload.revisionId || !payload.version)
      throw new Error("EC job payload is incomplete");
    const submission = await getDb().submission.findUnique({
      where: { id: payload.submissionId },
      include: {
        repository: true,
        revisions: {
          where: { id: payload.revisionId },
          include: { evidence: true },
        },
      },
    });
    const revision = submission?.revisions[0];
    if (!submission || !revision || submission.status !== "APPROVED")
      throw new Error("Submission is not approved or revision is missing");
    const existing = await getDb().ecBatch.findFirst({
      where: {
        items: { some: { repositoryId: submission.repositoryId } },
        status: { in: ["PR_OPEN", "MERGED"] },
      },
    });
    if (existing) return;
    const env = process.env.EC_PROVIDER_MODE ?? "mock";
    if (env === "mock") {
      const batch = await getDb().ecBatch.create({
        data: {
          branch: `ec/kiteai/${job.id}`,
          upstreamRepoId: BigInt(0),
          status: "READY",
          validationLog: "Mock EC provider: ready for review.",
          items: { create: { repositoryId: submission.repositoryId } },
        },
      });
      console.log(
        JSON.stringify({ event: "ec.batch.ready", batchId: batch.id }),
      );
      return;
    }
    const branch = `ec/kiteai/${job.id}`;
    const existingBatch = await getDb().ecBatch.findUnique({
      where: { branch },
      include: { items: true },
    });
    const batch = existingBatch
      ? await getDb().ecBatch.update({
          where: { id: existingBatch.id },
          data: { status: "GENERATING", validationLog: null },
        })
      : await getDb().ecBatch.create({
          data: {
            branch,
            upstreamRepoId: BigInt(0),
            status: "GENERATING",
            items: { create: { repositoryId: submission.repositoryId } },
          },
        });
    try {
      const result = await createEcPullRequest({
        repositoryUrl: submission.repository.url,
        batchId: batch.id,
      });
      await getDb().ecBatch.update({
        where: { id: batch.id },
        data: {
          branch: result.branch,
          migrationPath: result.path,
          baseSha: result.baseSha,
          headSha: result.headSha,
          contentHash: result.contentHash,
          prNumber: result.prNumber,
          prUrl: result.prUrl,
          status: result.manual ? "READY" : "PR_OPEN",
          validationLog: result.manual
            ? "已准备 Fork 分支，请打开 PR 链接完成最后确认。"
            : "EC PR 已创建，等待 Electric Capital 审核并合并。",
        },
      });
      if (!result.manual) {
        await getDb().job.create({
          data: {
            type: "ec.sync_batch",
            key: `ec.sync.batch.${batch.id}.${Date.now()}`,
            payload: { batchId: batch.id },
            runAt: new Date(Date.now() + 10 * 60 * 1000),
          },
        });
      }
    } catch (error) {
      await getDb().ecBatch.update({
        where: { id: batch.id },
        data: {
          status: "VALIDATION_FAILED",
          validationLog:
            error instanceof Error ? error.message : "EC submission failed",
        },
      });
      throw error;
    }
    return;
  }
  if (job.type === "ec.sync_batch") {
    const payload = job.payload as { batchId?: string };
    if (!payload.batchId) throw new Error("EC sync payload is incomplete");
    const batch = await getDb().ecBatch.findUnique({
      where: { id: payload.batchId },
      include: { items: true },
    });
    if (!batch || !batch.prNumber) return;
    const state = await syncEcPullRequest({ prNumber: batch.prNumber });
    if (state.merged) {
      const verifiedItems = [] as Array<{ repositoryId: string; verified: boolean }>;
      for (const item of batch.items) {
        const repository = await getDb().repository.findUnique({
          where: { id: item.repositoryId },
          select: { url: true },
        });
        const verified = repository
          ? await verifyEcRepository(repository.url)
          : false;
        verifiedItems.push({ repositoryId: item.repositoryId, verified });
      }
      await getDb().$transaction(async (tx) => {
        const mergedAt = new Date(state.mergedAt!);
        await tx.ecBatch.update({
          where: { id: batch.id },
          data: {
            status: "MERGED",
            mergedAt,
            syncedAt: new Date(),
            headSha: state.headSha,
            validationLog: "EC PR 已合并，正在核验上游数据记录。",
          },
        });
        for (const item of batch.items) {
          const verification = verifiedItems.find(
            (candidate) => candidate.repositoryId === item.repositoryId,
          );
          if (!verification?.verified) {
            await tx.ecBatchItem.update({
              where: {
                batchId_repositoryId: {
                  batchId: batch.id,
                  repositoryId: item.repositoryId,
                },
              },
              data: {
                failure:
                  "PR 已合并，但未在 EC 上游迁移数据中找到对应的 KiteAI repadd 记录。",
              },
            });
            continue;
          }
          const registration = await tx.ecRegistration.upsert({
            where: {
              repositoryId_ecosystem: {
                repositoryId: item.repositoryId,
                ecosystem: "KiteAI",
              },
            },
            update: {
              status: "VERIFIED",
              evidenceUrl: batch.prUrl,
              verifiedAt: mergedAt,
              upstreamSha: state.headSha,
            },
            create: {
              repositoryId: item.repositoryId,
              ecosystem: "KiteAI",
              status: "VERIFIED",
              evidenceUrl: batch.prUrl,
              verifiedAt: mergedAt,
              upstreamSha: state.headSha,
            },
          });
          const submissions = await tx.submission.findMany({
            where: { repositoryId: item.repositoryId, status: "APPROVED" },
          });
          for (const submission of submissions) {
            await tx.weeklyCompletion.upsert({
              where: { submissionId: submission.id },
              update: {},
              create: {
                userId: submission.userId,
                weekId: submission.weekId,
                submissionId: submission.id,
                registrationId: registration.id,
                policyVersion: "draft-v1",
              },
            });
          }
        }
      });
      return;
    }
    if (state.state === "closed") {
      await getDb().ecBatch.update({
        where: { id: batch.id },
        data: { status: "CLOSED_UNMERGED", syncedAt: new Date(), validationLog: "EC PR 已关闭但未合并。" },
      });
      return;
    }
    await getDb().ecBatch.update({
      where: { id: batch.id },
      data: { syncedAt: new Date(), validationLog: "EC PR 仍在审核中，系统将继续检查。" },
    });
    const pendingSync = await getDb().job.findFirst({
      where: { type: "ec.sync_batch", status: { in: ["PENDING", "RUNNING"] }, payload: { path: ["batchId"], equals: batch.id } },
    });
    if (!pendingSync) await getDb().job.create({
      data: {
        type: "ec.sync_batch",
        key: `ec.sync.batch.${batch.id}.${Date.now()}`,
        payload: { batchId: batch.id },
        runAt: new Date(Date.now() + 10 * 60 * 1000),
      },
    });
    return;
  }
  if (job.type === "payment.send") {
    const payload = job.payload as { claimId?: string };
    if (!payload.claimId) throw new Error("Payment job payload is incomplete");
    const claim = await getDb().rewardClaim.findUnique({ where: { id: payload.claimId } });
    if (!claim) throw new Error("Reward claim not found");
    if (claim.status === "CONFIRMED") return;
    const provider = getPaymentProvider();
    const result = await provider.submit({ claimId: claim.id, chainId: claim.chainId, recipient: claim.wallet, tokenAddress: claim.tokenAddress, amountUnits: claim.amountUnits.toString(), policyVersion: "draft-v1" });
    await getDb().rewardClaim.update({ where: { id: claim.id }, data: { status: "SUBMITTED", providerRequestId: result.requestId, transactionHash: result.transactionHash, } });
    return;
  }
  if (job.type !== "system.ping")
    throw new Error(
      `No handler registered for ${job.type}; EC and payments are not implemented.`,
    );
  console.log(JSON.stringify({ event: "job.pong", jobId: job.id }));
}
