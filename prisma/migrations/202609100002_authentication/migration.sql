-- Extend wallet challenges and sessions for the authentication implementation.
ALTER TABLE "WalletNonce" ADD COLUMN "nonce" TEXT;
UPDATE "WalletNonce" SET "nonce" = 'invalidated-' || "id", "consumedAt" = COALESCE("consumedAt", CURRENT_TIMESTAMP);
ALTER TABLE "WalletNonce" ALTER COLUMN "nonce" SET NOT NULL;
ALTER TABLE "WalletNonce" ADD COLUMN "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Session" ADD COLUMN "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX "WalletNonce_wallet_createdAt_idx" ON "WalletNonce"("wallet", "createdAt");

CREATE TABLE "OAuthState" (
  "id" TEXT NOT NULL,
  "stateHash" TEXT NOT NULL,
  "codeVerifier" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "returnTo" TEXT NOT NULL DEFAULT '/dashboard',
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMPTZ(3) NOT NULL,
  "consumedAt" TIMESTAMPTZ(3),
  CONSTRAINT "OAuthState_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OAuthState_stateHash_key" ON "OAuthState"("stateHash");
CREATE INDEX "OAuthState_expiresAt_idx" ON "OAuthState"("expiresAt");
ALTER TABLE "OAuthState" ADD CONSTRAINT "OAuthState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
