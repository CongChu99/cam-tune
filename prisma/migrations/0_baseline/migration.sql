[dotenv@17.3.1] injecting env (6) from .env.local -- tip: ⚙️  enable debug logging with { debug: true }
[dotenv@17.3.1] injecting env (0) from .env -- tip: ⚙️  specify custom .env file path with { path: '/custom/path/.env' }
Loaded Prisma config from prisma.config.ts.

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "SensorSize" AS ENUM ('FULL_FRAME', 'APS_C', 'MFT', 'ONE_INCH', 'MEDIUM_FORMAT', 'OTHER');

-- CreateEnum
CREATE TYPE "UiMode" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED');

-- CreateEnum
CREATE TYPE "SkillLevel" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED');

-- CreateEnum
CREATE TYPE "LensType" AS ENUM ('PRIME', 'ZOOM');

-- CreateEnum
CREATE TYPE "LensSource" AS ENUM ('LENSFUN', 'EXIF', 'MANUAL');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "passwordHash" TEXT,
    "skillLevel" "SkillLevel" NOT NULL DEFAULT 'BEGINNER',
    "uiMode" "UiMode" NOT NULL DEFAULT 'BEGINNER',
    "openaiApiKeyEncrypted" TEXT,
    "openaiModelId" TEXT,
    "lightroomAccessTokenEncrypted" TEXT,
    "lightroomRefreshTokenEncrypted" TEXT,
    "lightroomTokenExpiry" TIMESTAMP(3),
    "lightroomTokenIssuedAt" TIMESTAMP(3),
    "captureOneAccessTokenEncrypted" TEXT,
    "captureOneRefreshTokenEncrypted" TEXT,
    "captureOneTokenExpiry" TIMESTAMP(3),
    "captureOneTokenIssuedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CameraDatabase" (
    "id" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "sensorSize" "SensorSize" NOT NULL,
    "pixelCountMp" DECIMAL(65,30),
    "baseIso" INTEGER NOT NULL,
    "maxUsableIso" INTEGER NOT NULL,
    "maxNativeIso" INTEGER NOT NULL,
    "ibis" BOOLEAN NOT NULL DEFAULT false,
    "ibisStops" DECIMAL(65,30),
    "dualNativeIso" BOOLEAN NOT NULL DEFAULT false,
    "dualNativeIsoValues" TEXT,
    "dynamicRangeEv" DECIMAL(65,30),
    "releaseYear" INTEGER,
    "mount" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CameraDatabase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CameraProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "cameraDatabaseId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "isUserEntered" BOOLEAN NOT NULL DEFAULT false,
    "ibisVerified" BOOLEAN NOT NULL DEFAULT false,
    "customOverrides" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CameraProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LensProfile" (
    "id" TEXT NOT NULL,
    "cameraProfileId" TEXT NOT NULL,
    "focalLengthMm" INTEGER NOT NULL,
    "maxAperture" DECIMAL(65,30) NOT NULL,
    "minAperture" DECIMAL(65,30) NOT NULL,
    "isStabilized" BOOLEAN NOT NULL DEFAULT false,
    "stabilizationStops" DECIMAL(65,30),
    "focalLengthMinMm" INTEGER,
    "focalLengthMaxMm" INTEGER,
    "isVariableAperture" BOOLEAN NOT NULL DEFAULT false,
    "maxApertureTele" DECIMAL(65,30),
    "lensType" "LensType",
    "lensfunId" TEXT,
    "source" "LensSource",

    CONSTRAINT "LensProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShootSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cameraProfileId" TEXT NOT NULL,
    "lat" DECIMAL(65,30) NOT NULL,
    "lng" DECIMAL(65,30) NOT NULL,
    "locationName" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "weatherSnapshot" JSONB NOT NULL,
    "sunSnapshot" JSONB NOT NULL,
    "sceneType" TEXT,
    "aiRecommendation" JSONB,
    "actualSettings" JSONB,
    "captureOneSyncQueue" JSONB,
    "userRating" INTEGER,
    "notes" TEXT,
    "isPlan" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShootSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIRecommendation" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "inputSignals" JSONB NOT NULL,
    "rawResponse" JSONB NOT NULL,
    "parsedSuggestions" JSONB NOT NULL,
    "confidenceScores" TEXT NOT NULL,
    "primarySignalDriver" TEXT,
    "latencyMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIRecommendation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SettingsCard" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionId" TEXT,
    "cameraModel" TEXT NOT NULL,
    "lat" DECIMAL(65,30) NOT NULL,
    "lng" DECIMAL(65,30) NOT NULL,
    "locationName" TEXT NOT NULL,
    "settings" JSONB NOT NULL,
    "weatherConditions" JSONB,
    "photoUrl" TEXT,
    "caption" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "likesCount" INTEGER NOT NULL DEFAULT 0,
    "savesCount" INTEGER NOT NULL DEFAULT 0,
    "isFlagged" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SettingsCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavedCard" (
    "userId" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "savedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavedCard_pkey" PRIMARY KEY ("userId","cardId")
);

-- CreateTable
CREATE TABLE "CardLike" (
    "userId" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CardLike_pkey" PRIMARY KEY ("userId","cardId")
);

-- CreateTable
CREATE TABLE "CardReport" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CardReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShootPlan" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "plannedAt" TIMESTAMP(3) NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "locationName" TEXT,
    "sceneType" TEXT NOT NULL,
    "predictedIso" INTEGER,
    "predictedAperture" DOUBLE PRECISION,
    "predictedShutter" TEXT,
    "predictedWB" TEXT,
    "predictedMetering" TEXT,
    "forecastSnapshot" TEXT,
    "notificationSent" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShootPlan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "CameraDatabase_slug_key" ON "CameraDatabase"("slug");

-- CreateIndex
CREATE INDEX "CameraProfile_userId_isActive_idx" ON "CameraProfile"("userId", "isActive");

-- CreateIndex
CREATE INDEX "ShootSession_userId_idx" ON "ShootSession"("userId");

-- CreateIndex
CREATE INDEX "ShootSession_startedAt_idx" ON "ShootSession"("startedAt");

-- CreateIndex
CREATE INDEX "SettingsCard_userId_idx" ON "SettingsCard"("userId");

-- CreateIndex
CREATE INDEX "SettingsCard_isPublic_createdAt_idx" ON "SettingsCard"("isPublic", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CardReport_userId_cardId_key" ON "CardReport"("userId", "cardId");

-- CreateIndex
CREATE INDEX "ShootPlan_userId_idx" ON "ShootPlan"("userId");

-- CreateIndex
CREATE INDEX "ShootPlan_plannedAt_idx" ON "ShootPlan"("plannedAt");

-- AddForeignKey
ALTER TABLE "CameraProfile" ADD CONSTRAINT "CameraProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CameraProfile" ADD CONSTRAINT "CameraProfile_cameraDatabaseId_fkey" FOREIGN KEY ("cameraDatabaseId") REFERENCES "CameraDatabase"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LensProfile" ADD CONSTRAINT "LensProfile_cameraProfileId_fkey" FOREIGN KEY ("cameraProfileId") REFERENCES "CameraProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShootSession" ADD CONSTRAINT "ShootSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShootSession" ADD CONSTRAINT "ShootSession_cameraProfileId_fkey" FOREIGN KEY ("cameraProfileId") REFERENCES "CameraProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIRecommendation" ADD CONSTRAINT "AIRecommendation_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ShootSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SettingsCard" ADD CONSTRAINT "SettingsCard_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SettingsCard" ADD CONSTRAINT "SettingsCard_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ShootSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedCard" ADD CONSTRAINT "SavedCard_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedCard" ADD CONSTRAINT "SavedCard_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "SettingsCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardLike" ADD CONSTRAINT "CardLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardLike" ADD CONSTRAINT "CardLike_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "SettingsCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardReport" ADD CONSTRAINT "CardReport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardReport" ADD CONSTRAINT "CardReport_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "SettingsCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShootPlan" ADD CONSTRAINT "ShootPlan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

