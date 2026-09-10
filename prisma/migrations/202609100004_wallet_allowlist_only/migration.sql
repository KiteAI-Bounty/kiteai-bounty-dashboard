-- Wallet addresses are now required for every participant. Invitation codes are removed.
DELETE FROM "ParticipantInvite" WHERE "wallet" IS NULL;
ALTER TABLE "ParticipantInvite" ALTER COLUMN "wallet" SET NOT NULL;
ALTER TABLE "ParticipantInvite" DROP COLUMN "codeHash";
ALTER TABLE "ParticipantInvite" DROP COLUMN "codeHint";
