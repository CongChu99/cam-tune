-- CreateTable
CREATE TABLE "ShootPlan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "plannedAt" DATETIME NOT NULL,
    "latitude" REAL NOT NULL,
    "longitude" REAL NOT NULL,
    "locationName" TEXT,
    "sceneType" TEXT NOT NULL,
    "predictedIso" INTEGER,
    "predictedAperture" REAL,
    "predictedShutter" TEXT,
    "predictedWB" TEXT,
    "predictedMetering" TEXT,
    "forecastSnapshot" TEXT,
    "notificationSent" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ShootPlan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ShootPlan_userId_idx" ON "ShootPlan"("userId");

-- CreateIndex
CREATE INDEX "ShootPlan_plannedAt_idx" ON "ShootPlan"("plannedAt");
