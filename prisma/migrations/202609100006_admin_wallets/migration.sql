CREATE TABLE "AdminWallet" (
  "id" TEXT NOT NULL,
  "wallet" VARCHAR(42) NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "AdminWallet_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AdminWallet_wallet_key" ON "AdminWallet"("wallet");
