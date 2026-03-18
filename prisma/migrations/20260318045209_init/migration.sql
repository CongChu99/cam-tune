-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "skillLevel" TEXT NOT NULL DEFAULT 'BEGINNER',
    "uiMode" TEXT NOT NULL DEFAULT 'BEGINNER',
    "openaiApiKeyEncrypted" TEXT,
    "openaiModelId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "CameraDatabase" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "brand" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "sensorSize" TEXT NOT NULL,
    "pixelCountMp" DECIMAL,
    "baseIso" INTEGER NOT NULL,
    "maxUsableIso" INTEGER NOT NULL,
    "maxNativeIso" INTEGER NOT NULL,
    "ibis" BOOLEAN NOT NULL DEFAULT false,
    "ibisStops" DECIMAL,
    "dualNativeIso" BOOLEAN NOT NULL DEFAULT false,
    "dualNativeIsoValues" TEXT,
    "dynamicRangeEv" DECIMAL,
    "releaseYear" INTEGER,
    "mount" TEXT,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "CameraProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "cameraDatabaseId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "isUserEntered" BOOLEAN NOT NULL DEFAULT false,
    "ibisVerified" BOOLEAN NOT NULL DEFAULT false,
    "customOverrides" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CameraProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CameraProfile_cameraDatabaseId_fkey" FOREIGN KEY ("cameraDatabaseId") REFERENCES "CameraDatabase" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LensProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cameraProfileId" TEXT NOT NULL,
    "focalLengthMm" INTEGER NOT NULL,
    "maxAperture" DECIMAL NOT NULL,
    "minAperture" DECIMAL NOT NULL,
    "isStabilized" BOOLEAN NOT NULL DEFAULT false,
    "stabilizationStops" DECIMAL,
    CONSTRAINT "LensProfile_cameraProfileId_fkey" FOREIGN KEY ("cameraProfileId") REFERENCES "CameraProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ShootSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "cameraProfileId" TEXT NOT NULL,
    "lat" DECIMAL NOT NULL,
    "lng" DECIMAL NOT NULL,
    "locationName" TEXT,
    "startedAt" DATETIME NOT NULL,
    "endedAt" DATETIME,
    "weatherSnapshot" JSONB NOT NULL,
    "sunSnapshot" JSONB NOT NULL,
    "sceneType" TEXT,
    "aiRecommendation" JSONB,
    "actualSettings" JSONB,
    "userRating" INTEGER,
    "notes" TEXT,
    "isPlan" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ShootSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ShootSession_cameraProfileId_fkey" FOREIGN KEY ("cameraProfileId") REFERENCES "CameraProfile" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AIRecommendation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "inputSignals" JSONB NOT NULL,
    "rawResponse" JSONB NOT NULL,
    "parsedSuggestions" JSONB NOT NULL,
    "confidenceScores" TEXT NOT NULL,
    "primarySignalDriver" TEXT,
    "latencyMs" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AIRecommendation_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ShootSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SettingsCard" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "sessionId" TEXT,
    "cameraModel" TEXT NOT NULL,
    "lat" DECIMAL NOT NULL,
    "lng" DECIMAL NOT NULL,
    "locationName" TEXT NOT NULL,
    "settings" JSONB NOT NULL,
    "weatherConditions" JSONB,
    "photoUrl" TEXT,
    "caption" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "likesCount" INTEGER NOT NULL DEFAULT 0,
    "savesCount" INTEGER NOT NULL DEFAULT 0,
    "isFlagged" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SettingsCard_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SettingsCard_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ShootSession" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SavedCard" (
    "userId" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "savedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("userId", "cardId"),
    CONSTRAINT "SavedCard_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SavedCard_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "SettingsCard" ("id") ON DELETE CASCADE ON UPDATE CASCADE
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
