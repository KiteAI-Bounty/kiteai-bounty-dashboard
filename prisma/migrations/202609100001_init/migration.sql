-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('SUBMITTED', 'CHANGES_REQUESTED', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "EcStatus" AS ENUM ('QUEUED', 'GENERATING', 'VALIDATION_FAILED', 'READY', 'PR_OPEN', 'CHANGES_REQUESTED', 'CI_FAILED', 'MERGED', 'CLOSED_UNMERGED');

-- CreateEnum
CREATE TYPE "RegistrationStatus" AS ENUM ('UNKNOWN', 'PENDING', 'VERIFIED', 'REMOVED');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "wallet" VARCHAR(42) NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "disabledAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GithubAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "githubUserId" BIGINT NOT NULL,
    "login" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "boundAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GithubAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WalletNonce" (
    "id" TEXT NOT NULL,
    "wallet" VARCHAR(42) NOT NULL,
    "chainId" INTEGER NOT NULL,
    "nonceHash" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "consumedAt" TIMESTAMPTZ(3),

    CONSTRAINT "WalletNonce_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "chainId" INTEGER NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Shanghai',
    "startsAt" TIMESTAMPTZ(3) NOT NULL,
    "endsAt" TIMESTAMPTZ(3),
    "targetMad" INTEGER NOT NULL DEFAULT 50,

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RewardPeriod" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startsAt" TIMESTAMPTZ(3) NOT NULL,
    "endsAt" TIMESTAMPTZ(3) NOT NULL,
    "payoutFrom" TIMESTAMPTZ(3) NOT NULL,
    "policy" JSONB NOT NULL,

    CONSTRAINT "RewardPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignWeek" (
    "id" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "startsAt" TIMESTAMPTZ(3) NOT NULL,
    "endsAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "CampaignWeek_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Enrollment" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Enrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Repository" (
    "id" TEXT NOT NULL,
    "githubRepoId" BIGINT NOT NULL,
    "url" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "integration" TEXT NOT NULL,
    "defaultBranch" TEXT NOT NULL,
    "isFork" BOOLEAN NOT NULL DEFAULT false,
    "isOfficial" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Repository_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectMember" (
    "userId" TEXT NOT NULL,
    "repositoryId" TEXT NOT NULL,

    CONSTRAINT "ProjectMember_pkey" PRIMARY KEY ("userId","repositoryId")
);

-- CreateTable
CREATE TABLE "Submission" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "weekId" TEXT NOT NULL,
    "repositoryId" TEXT NOT NULL,
    "status" "ReviewStatus" NOT NULL DEFAULT 'SUBMITTED',
    "version" INTEGER NOT NULL DEFAULT 1,
    "submittedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Submission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubmissionRevision" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "summary" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubmissionRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContributionEvidence" (
    "id" TEXT NOT NULL,
    "revisionId" TEXT NOT NULL,
    "sha" TEXT NOT NULL,
    "githubAuthorId" BIGINT,
    "authoredAt" TIMESTAMPTZ(3) NOT NULL,
    "committedAt" TIMESTAMPTZ(3) NOT NULL,
    "observedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "url" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,

    CONSTRAINT "ContributionEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubmissionReview" (
    "id" TEXT NOT NULL,
    "revisionId" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "decision" "ReviewStatus" NOT NULL,
    "note" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubmissionReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EcBatch" (
    "id" TEXT NOT NULL,
    "status" "EcStatus" NOT NULL DEFAULT 'QUEUED',
    "branch" TEXT NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "upstreamRepoId" BIGINT NOT NULL,
    "prNumber" INTEGER,
    "prUrl" TEXT,
    "baseSha" TEXT,
    "headSha" TEXT,
    "migrationPath" TEXT,
    "contentHash" TEXT,
    "validationLog" TEXT,
    "mergedAt" TIMESTAMPTZ(3),
    "syncedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EcBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EcBatchItem" (
    "batchId" TEXT NOT NULL,
    "repositoryId" TEXT NOT NULL,
    "verifiedAt" TIMESTAMPTZ(3),
    "failure" TEXT,

    CONSTRAINT "EcBatchItem_pkey" PRIMARY KEY ("batchId","repositoryId")
);

-- CreateTable
CREATE TABLE "EcRegistration" (
    "id" TEXT NOT NULL,
    "repositoryId" TEXT NOT NULL,
    "ecosystem" TEXT NOT NULL DEFAULT 'KiteAI',
    "status" "RegistrationStatus" NOT NULL DEFAULT 'UNKNOWN',
    "upstreamSha" TEXT,
    "evidenceUrl" TEXT,
    "verifiedAt" TIMESTAMPTZ(3),

    CONSTRAINT "EcRegistration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeeklyCompletion" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "weekId" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "registrationId" TEXT NOT NULL,
    "policyVersion" TEXT NOT NULL,
    "completedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WeeklyCompletion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RewardEntitlement" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "policy" JSONB NOT NULL,
    "unlockedUnits" BIGINT NOT NULL DEFAULT 0,
    "paidUnits" BIGINT NOT NULL DEFAULT 0,
    "reviewedAt" TIMESTAMPTZ(3),
    "frozenReason" TEXT,

    CONSTRAINT "RewardEntitlement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RewardClaim" (
    "id" TEXT NOT NULL,
    "entitlementId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "wallet" VARCHAR(42) NOT NULL,
    "chainId" INTEGER NOT NULL,
    "tokenAddress" VARCHAR(42) NOT NULL,
    "amountUnits" BIGINT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "transactionHash" TEXT,
    "providerRequestId" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RewardClaim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Job" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "runAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedUntil" TIMESTAMPTZ(3),
    "lockedBy" TEXT,
    "lastError" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutboxEvent" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMPTZ(3),

    CONSTRAINT "OutboxEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_wallet_key" ON "User"("wallet");

-- CreateIndex
CREATE UNIQUE INDEX "GithubAccount_userId_key" ON "GithubAccount"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "GithubAccount_githubUserId_key" ON "GithubAccount"("githubUserId");

-- CreateIndex
CREATE UNIQUE INDEX "WalletNonce_nonceHash_key" ON "WalletNonce"("nonceHash");

-- CreateIndex
CREATE INDEX "WalletNonce_expiresAt_idx" ON "WalletNonce"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "CampaignWeek_periodId_number_key" ON "CampaignWeek"("periodId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "Enrollment_campaignId_userId_key" ON "Enrollment"("campaignId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Repository_githubRepoId_key" ON "Repository"("githubRepoId");

-- CreateIndex
CREATE UNIQUE INDEX "Repository_url_key" ON "Repository"("url");

-- CreateIndex
CREATE INDEX "Submission_weekId_status_idx" ON "Submission"("weekId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Submission_userId_weekId_key" ON "Submission"("userId", "weekId");

-- CreateIndex
CREATE UNIQUE INDEX "SubmissionRevision_submissionId_version_key" ON "SubmissionRevision"("submissionId", "version");

-- CreateIndex
CREATE INDEX "ContributionEvidence_githubAuthorId_sha_idx" ON "ContributionEvidence"("githubAuthorId", "sha");

-- CreateIndex
CREATE UNIQUE INDEX "ContributionEvidence_revisionId_sha_key" ON "ContributionEvidence"("revisionId", "sha");

-- CreateIndex
CREATE UNIQUE INDEX "EcBatch_branch_key" ON "EcBatch"("branch");

-- CreateIndex
CREATE UNIQUE INDEX "EcBatch_upstreamRepoId_prNumber_key" ON "EcBatch"("upstreamRepoId", "prNumber");

-- CreateIndex
CREATE UNIQUE INDEX "EcRegistration_repositoryId_ecosystem_key" ON "EcRegistration"("repositoryId", "ecosystem");

-- CreateIndex
CREATE UNIQUE INDEX "WeeklyCompletion_submissionId_key" ON "WeeklyCompletion"("submissionId");

-- CreateIndex
CREATE UNIQUE INDEX "WeeklyCompletion_userId_weekId_key" ON "WeeklyCompletion"("userId", "weekId");

-- CreateIndex
CREATE UNIQUE INDEX "RewardEntitlement_userId_periodId_key" ON "RewardEntitlement"("userId", "periodId");

-- CreateIndex
CREATE UNIQUE INDEX "RewardClaim_idempotencyKey_key" ON "RewardClaim"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "RewardClaim_transactionHash_key" ON "RewardClaim"("transactionHash");

-- CreateIndex
CREATE UNIQUE INDEX "RewardClaim_providerRequestId_key" ON "RewardClaim"("providerRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "Job_key_key" ON "Job"("key");

-- CreateIndex
CREATE INDEX "Job_status_runAt_idx" ON "Job"("status", "runAt");

-- CreateIndex
CREATE UNIQUE INDEX "OutboxEvent_key_key" ON "OutboxEvent"("key");

-- CreateIndex
CREATE INDEX "OutboxEvent_processedAt_createdAt_idx" ON "OutboxEvent"("processedAt", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_createdAt_idx" ON "AuditLog"("entityType", "entityId", "createdAt");

-- AddForeignKey
ALTER TABLE "GithubAccount" ADD CONSTRAINT "GithubAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardPeriod" ADD CONSTRAINT "RewardPeriod_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignWeek" ADD CONSTRAINT "CampaignWeek_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "RewardPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "Repository"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_weekId_fkey" FOREIGN KEY ("weekId") REFERENCES "CampaignWeek"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "Repository"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubmissionRevision" ADD CONSTRAINT "SubmissionRevision_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContributionEvidence" ADD CONSTRAINT "ContributionEvidence_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "SubmissionRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubmissionReview" ADD CONSTRAINT "SubmissionReview_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "SubmissionRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubmissionReview" ADD CONSTRAINT "SubmissionReview_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EcBatchItem" ADD CONSTRAINT "EcBatchItem_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "EcBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EcBatchItem" ADD CONSTRAINT "EcBatchItem_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "Repository"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EcRegistration" ADD CONSTRAINT "EcRegistration_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "Repository"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyCompletion" ADD CONSTRAINT "WeeklyCompletion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyCompletion" ADD CONSTRAINT "WeeklyCompletion_weekId_fkey" FOREIGN KEY ("weekId") REFERENCES "CampaignWeek"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyCompletion" ADD CONSTRAINT "WeeklyCompletion_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyCompletion" ADD CONSTRAINT "WeeklyCompletion_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "EcRegistration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardEntitlement" ADD CONSTRAINT "RewardEntitlement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardEntitlement" ADD CONSTRAINT "RewardEntitlement_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "RewardPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardClaim" ADD CONSTRAINT "RewardClaim_entitlementId_fkey" FOREIGN KEY ("entitlementId") REFERENCES "RewardEntitlement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

