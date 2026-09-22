import type { Job } from "@/generated/prisma/client";
import { getDb } from "@/lib/db";
import {
  createEcPullRequest,
  syncEcPullRequest,
  verifyEcMigration,
  verifyEcRepository,
} from "@/modules/ec/github-provider";
import { analyzeContribution } from "@/modules/ai/glm";
import { getPaymentProvider } from "@/modules/rewards/provider";

async function verifyBatchRepository(
  repositoryUrl: string,
  migrationPath: string | null,
) {
  const exact = migrationPath
    ? await verifyEcMigration(repositoryUrl, migrationPath)
    : null;
  return exact ?? verifyEcRepository(repositoryUrl);
}

async function ensureEcSyncJob(batchId: string, currentJobId?: string) {
  const pending = await getDb().job.findFirst({
    where: {
      id: currentJobId ? { not: currentJobId } : undefined,
      type: "ec.sync_batch",
      status: { in: ["PENDING", "RUNNING"] },
      payload: { path: ["batchId"], equals: batchId },
    },
  });
  if (pending) return;
  await getDb().job.create({
    data: {
      type: "ec.sync_batch",
      key: `ec.sync.batch.${batchId}.${Date.now()}`,
      payload: { batchId },
      runAt: new Date(Date.now() + 10 * 60 * 1000),
    },
  });
}

async function completeSubmissionWithRegistration(input: {
  submissionId: string;
  userId: string;
  weekId: string;
  registrationId: string;
}) {
  await getDb().weeklyCompletion.upsert({
    where: { submissionId: input.submissionId },
    update: { registrationId: input.registrationId },
    create: {
      userId: input.userId,
      weekId: input.weekId,
      submissionId: input.submissionId,
      registrationId: input.registrationId,
      policyVersion: "ec-rules-v1",
    },
  });
}

function ecPrDraft(input: {
  repository: { name: string; url: string; description: string };
  direction: string;
  summary: string;
  githubLogin: string;
  evidence: Array<{ url: string }>;
  aiTitle: string | null;
  aiBody: string | null;
  aiVerdict: string | null;
}) {
  const title =
    input.aiTitle?.trim() || `Add KiteAI repository: ${input.repository.name}`;
  const evidence = input.evidence.map((item) => `- ${item.url}`).join("\n");
  const generated = `## Repository

${input.repository.url}

## Project

${input.repository.description || input.summary}

## KiteAI relevance

${input.summary}

Contribution direction: ${input.direction}

## Evidence

Contributor: @${input.githubLogin}

${evidence}

## Pre-review

${input.aiVerdict ? `AI recommendation: ${input.aiVerdict}.` : "Reviewed by the KiteAI Bounty Dashboard administrator."}

This pull request only registers the repository-to-ecosystem relationship. Electric Capital maintainers retain final review and merge authority.`;
  const aiBody = input.aiBody?.trim();
  return {
    title: title.slice(0, 240),
    body: aiBody
      ? `${aiBody}\n\n## Repository\n\n${input.repository.url}\n\n## Submitted evidence\n\n${evidence}\n\nContributor: @${input.githubLogin}\n\nThis pull request only registers the repository-to-ecosystem relationship. Electric Capital maintainers retain final review and merge authority.`.slice(
          0,
          12_000,
        )
      : generated,
  };
}

export async function handleJob(job: Pick<Job, "id" | "type" | "payload">) {
  if (job.type === "ai.analyze_submission") {
    const payload = job.payload as { revisionId?: string };
    if (!payload.revisionId) throw new Error("AI job payload is incomplete");
    const revision = await getDb().submissionRevision.findUnique({
      where: { id: payload.revisionId },
      include: {
        evidence: true,
        submission: {
          include: {
            repository: true,
            user: { include: { github: true } },
          },
        },
      },
    });
    if (!revision) throw new Error("Submission revision not found");
    if (!revision.submission.user.github)
      throw new Error("Submission GitHub identity is missing");
    if (!process.env.GLM_API_KEY) {
      await getDb().submissionRevision.update({
        where: { id: revision.id },
        data: {
          aiStatus: "SKIPPED",
          aiSummary: "GLM_API_KEY 尚未配置，等待管理员人工审核。",
          aiCheckedAt: new Date(),
        },
      });
      return;
    }
    await getDb().submissionRevision.update({
      where: { id: revision.id },
      data: { aiStatus: "RUNNING" },
    });
    try {
      const result = await analyzeContribution({
        scope: revision.aiScope === "COMMIT" ? "COMMIT" : "REPOSITORY",
        repository: {
          owner: revision.submission.repository.owner,
          name: revision.submission.repository.name,
          url: revision.submission.repository.url,
          description: revision.submission.repository.description,
          defaultBranch: revision.submission.repository.defaultBranch,
          isFork: revision.submission.repository.isFork,
        },
        direction: revision.submission.direction,
        participantSummary: revision.summary,
        githubLogin: revision.submission.user.github.login,
        evidence: revision.evidence.map((item) => ({
          sha: item.sha,
          url: item.url,
          authoredAt: item.authoredAt,
          committedAt: item.committedAt,
          snapshot: item.snapshot,
        })),
      });
      await getDb().submissionRevision.update({
        where: { id: revision.id },
        data: {
          aiStatus: "SUCCEEDED",
          aiVerdict: result.verdict,
          aiSummary: result.summary,
          aiFindings: result,
          aiPrTitle: result.prTitle,
          aiPrBody: result.prBody,
          aiModel: result.model,
          aiCheckedAt: new Date(),
        },
      });
    } catch (error) {
      await getDb().submissionRevision.update({
        where: { id: revision.id },
        data: {
          aiStatus: "FAILED",
          aiSummary:
            error instanceof Error
              ? error.message.slice(0, 3000)
              : "AI 分析失败",
          aiCheckedAt: new Date(),
        },
      });
      throw error;
    }
    return;
  }
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
    if (!submission || !revision)
      throw new Error("Submission or revision is missing");
    // Approval can be withdrawn or superseded after the job was queued. This
    // is a valid stale job, not a transient failure worth retrying.
    if (
      submission.status !== "APPROVED" ||
      submission.version !== payload.version
    )
      return;
    const registration = await getDb().ecRegistration.findUnique({
      where: {
        repositoryId_ecosystem: {
          repositoryId: submission.repositoryId,
          ecosystem: "KiteAI",
        },
      },
    });
    if (registration?.status === "VERIFIED") {
      await completeSubmissionWithRegistration({
        submissionId: submission.id,
        userId: submission.userId,
        weekId: submission.weekId,
        registrationId: registration.id,
      });
      return;
    }
    const env = process.env.EC_PROVIDER_MODE ?? "mock";
    const existing = await getDb().ecBatch.findFirst({
      where: {
        items: { some: { repositoryId: submission.repositoryId } },
        status: {
          in: [
            "QUEUED",
            "GENERATING",
            "READY",
            "PR_OPEN",
            "CHANGES_REQUESTED",
            "CI_FAILED",
            "MERGED",
          ],
        },
      },
    });
    if (existing) {
      if (
        env !== "mock" &&
        existing.status === "MERGED" &&
        (await verifyBatchRepository(
          submission.repository.url,
          existing.migrationPath,
        ))
      ) {
        const verified = await getDb().ecRegistration.upsert({
          where: {
            repositoryId_ecosystem: {
              repositoryId: submission.repositoryId,
              ecosystem: "KiteAI",
            },
          },
          update: {
            status: "VERIFIED",
            evidenceUrl: existing.prUrl,
            verifiedAt: existing.mergedAt ?? new Date(),
            upstreamSha: existing.headSha,
          },
          create: {
            repositoryId: submission.repositoryId,
            ecosystem: "KiteAI",
            status: "VERIFIED",
            evidenceUrl: existing.prUrl,
            verifiedAt: existing.mergedAt ?? new Date(),
            upstreamSha: existing.headSha,
          },
        });
        await completeSubmissionWithRegistration({
          submissionId: submission.id,
          userId: submission.userId,
          weekId: submission.weekId,
          registrationId: verified.id,
        });
      } else if (
        existing.prNumber &&
        ["PR_OPEN", "CHANGES_REQUESTED", "CI_FAILED", "MERGED"].includes(
          existing.status,
        )
      ) {
        await ensureEcSyncJob(existing.id);
      }
      return;
    }
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
    if (await verifyEcRepository(submission.repository.url)) {
      const verified = await getDb().ecRegistration.upsert({
        where: {
          repositoryId_ecosystem: {
            repositoryId: submission.repositoryId,
            ecosystem: "KiteAI",
          },
        },
        update: {
          status: "VERIFIED",
          evidenceUrl: `https://github.com/${process.env.EC_UPSTREAM_OWNER ?? "electric-capital"}/${process.env.EC_UPSTREAM_REPOSITORY ?? "open-dev-data"}`,
          verifiedAt: new Date(),
        },
        create: {
          repositoryId: submission.repositoryId,
          ecosystem: "KiteAI",
          status: "VERIFIED",
          evidenceUrl: `https://github.com/${process.env.EC_UPSTREAM_OWNER ?? "electric-capital"}/${process.env.EC_UPSTREAM_REPOSITORY ?? "open-dev-data"}`,
          verifiedAt: new Date(),
        },
      });
      await completeSubmissionWithRegistration({
        submissionId: submission.id,
        userId: submission.userId,
        weekId: submission.weekId,
        registrationId: verified.id,
      });
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
      const draft = ecPrDraft({
        repository: submission.repository,
        direction: submission.direction,
        summary: revision.summary,
        githubLogin: String(
          (revision.evidence[0]?.snapshot as { author?: { login?: string } })
            ?.author?.login ?? "unknown",
        ),
        evidence: revision.evidence,
        aiTitle: revision.aiPrTitle,
        aiBody: revision.aiPrBody,
        aiVerdict: revision.aiVerdict,
      });
      const result = await createEcPullRequest({
        repositoryUrl: submission.repository.url,
        batchId: batch.id,
        title: draft.title,
        body: draft.body,
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
        await ensureEcSyncJob(batch.id);
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
      const verifiedItems = [] as Array<{
        repositoryId: string;
        verified: boolean;
      }>;
      for (const item of batch.items) {
        const repository = await getDb().repository.findUnique({
          where: { id: item.repositoryId },
          select: { url: true },
        });
        const verified = repository
          ? await verifyBatchRepository(repository.url, batch.migrationPath)
          : false;
        verifiedItems.push({ repositoryId: item.repositoryId, verified });
      }
      await getDb().$transaction(async (tx) => {
        const mergedAt = new Date(state.mergedAt!);
        const allVerified = verifiedItems.every((item) => item.verified);
        await tx.ecBatch.update({
          where: { id: batch.id },
          data: {
            status: "MERGED",
            mergedAt,
            syncedAt: new Date(),
            headSha: state.headSha,
            validationLog: allVerified
              ? "EC PR 已合并，上游数据记录已核验。"
              : "EC PR 已合并，正在核验上游数据记录。",
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
          await tx.ecBatchItem.update({
            where: {
              batchId_repositoryId: {
                batchId: batch.id,
                repositoryId: item.repositoryId,
              },
            },
            data: { verifiedAt: mergedAt, failure: null },
          });
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
      if (verifiedItems.some((item) => !item.verified)) {
        const retryKey = `ec.sync.batch.${batch.id}.verify.${Date.now()}`;
        await getDb().job.create({
          data: {
            type: "ec.sync_batch",
            key: retryKey,
            payload: { batchId: batch.id },
            runAt: new Date(Date.now() + 10 * 60 * 1000),
          },
        });
      }
      return;
    }
    if (state.state === "closed") {
      await getDb().ecBatch.update({
        where: { id: batch.id },
        data: {
          status: "CLOSED_UNMERGED",
          syncedAt: new Date(),
          validationLog: "EC PR 已关闭但未合并。",
        },
      });
      return;
    }
    await getDb().ecBatch.update({
      where: { id: batch.id },
      data: {
        syncedAt: new Date(),
        validationLog: "EC PR 仍在审核中，系统将继续检查。",
      },
    });
    await ensureEcSyncJob(batch.id, job.id);
    return;
  }
  if (job.type === "payment.send") {
    const payload = job.payload as { claimId?: string };
    if (!payload.claimId) throw new Error("Payment job payload is incomplete");
    const claim = await getDb().rewardClaim.findUnique({
      where: { id: payload.claimId },
    });
    if (!claim) throw new Error("Reward claim not found");
    if (claim.status === "CONFIRMED") return;
    const provider = getPaymentProvider();
    const result = await provider.submit({
      claimId: claim.id,
      chainId: claim.chainId,
      recipient: claim.wallet,
      tokenAddress: claim.tokenAddress,
      amountUnits: claim.amountUnits.toString(),
      policyVersion: "draft-v1",
    });
    await getDb().rewardClaim.update({
      where: { id: claim.id },
      data: {
        status: "SUBMITTED",
        providerRequestId: result.requestId,
        transactionHash: result.transactionHash,
      },
    });
    return;
  }
  if (job.type !== "system.ping")
    throw new Error(
      `No handler registered for ${job.type}; EC and payments are not implemented.`,
    );
  console.log(JSON.stringify({ event: "job.pong", jobId: job.id }));
}
