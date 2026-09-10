CREATE TYPE "InviteStatus" AS ENUM ('PENDING', 'ACTIVE', 'DISABLED');

CREATE TABLE "ParticipantInvite" (
  "id" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "contact" TEXT NOT NULL,
  "githubLogin" TEXT,
  "wallet" VARCHAR(42),
  "codeHash" TEXT,
  "codeHint" TEXT,
  "status" "InviteStatus" NOT NULL DEFAULT 'PENDING',
  "userId" TEXT,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "activatedAt" TIMESTAMPTZ(3),
  CONSTRAINT "ParticipantInvite_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "WalletNonce" ADD COLUMN "inviteId" TEXT;

CREATE UNIQUE INDEX "ParticipantInvite_contact_key" ON "ParticipantInvite"("contact");
CREATE UNIQUE INDEX "ParticipantInvite_wallet_key" ON "ParticipantInvite"("wallet");
CREATE UNIQUE INDEX "ParticipantInvite_codeHash_key" ON "ParticipantInvite"("codeHash");
CREATE UNIQUE INDEX "ParticipantInvite_userId_key" ON "ParticipantInvite"("userId");
CREATE INDEX "ParticipantInvite_status_idx" ON "ParticipantInvite"("status");
CREATE INDEX "WalletNonce_inviteId_idx" ON "WalletNonce"("inviteId");

ALTER TABLE "ParticipantInvite" ADD CONSTRAINT "ParticipantInvite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WalletNonce" ADD CONSTRAINT "WalletNonce_inviteId_fkey" FOREIGN KEY ("inviteId") REFERENCES "ParticipantInvite"("id") ON DELETE SET NULL ON UPDATE CASCADE;
