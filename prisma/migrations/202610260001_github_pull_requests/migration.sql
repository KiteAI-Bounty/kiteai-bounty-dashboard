CREATE TABLE "GithubPullRequest" (
    "id" TEXT NOT NULL,
    "reportMonth" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "repoOwner" TEXT NOT NULL,
    "repoName" TEXT NOT NULL,
    "prNumber" INTEGER NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "authorLogin" TEXT NOT NULL,
    "authorGithubId" BIGINT,
    "authorType" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "isDraft" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(3) NOT NULL,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "closedAt" TIMESTAMPTZ(3),
    "mergedAt" TIMESTAMPTZ(3),
    "syncedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GithubPullRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GithubPullRequest_url_key" ON "GithubPullRequest"("url");
CREATE UNIQUE INDEX "GithubPullRequest_repoOwner_repoName_prNumber_key" ON "GithubPullRequest"("repoOwner", "repoName", "prNumber");
CREATE INDEX "GithubPullRequest_reportMonth_source_idx" ON "GithubPullRequest"("reportMonth", "source");
CREATE INDEX "GithubPullRequest_reportMonth_state_idx" ON "GithubPullRequest"("reportMonth", "state");
CREATE INDEX "GithubPullRequest_reportMonth_authorLogin_idx" ON "GithubPullRequest"("reportMonth", "authorLogin");
