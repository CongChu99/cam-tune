-- AlterTable
ALTER TABLE "ShootSession" ADD COLUMN "captureOneSyncQueue" JSONB;

-- AlterTable
ALTER TABLE "User" ADD COLUMN "captureOneAccessTokenEncrypted" TEXT;
ALTER TABLE "User" ADD COLUMN "captureOneRefreshTokenEncrypted" TEXT;
ALTER TABLE "User" ADD COLUMN "captureOneTokenExpiry" DATETIME;
ALTER TABLE "User" ADD COLUMN "captureOneTokenIssuedAt" DATETIME;
