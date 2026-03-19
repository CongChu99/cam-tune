-- AlterTable
ALTER TABLE "User" ADD COLUMN "lightroomAccessTokenEncrypted" TEXT;
ALTER TABLE "User" ADD COLUMN "lightroomRefreshTokenEncrypted" TEXT;
ALTER TABLE "User" ADD COLUMN "lightroomTokenExpiry" DATETIME;
ALTER TABLE "User" ADD COLUMN "lightroomTokenIssuedAt" DATETIME;
