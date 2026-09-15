ALTER TABLE "SubmissionRevision"
  ADD COLUMN "aiScope" TEXT,
  ADD COLUMN "aiStatus" TEXT NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "aiVerdict" TEXT,
  ADD COLUMN "aiSummary" TEXT,
  ADD COLUMN "aiFindings" JSONB,
  ADD COLUMN "aiPrTitle" TEXT,
  ADD COLUMN "aiPrBody" TEXT,
  ADD COLUMN "aiModel" TEXT,
  ADD COLUMN "aiCheckedAt" TIMESTAMPTZ(3);

CREATE INDEX "ContributionEvidence_sha_idx" ON "ContributionEvidence"("sha");
