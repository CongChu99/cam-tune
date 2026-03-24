-- CreateTable
CREATE TABLE "LensfunLens" (
    "id" TEXT NOT NULL,
    "lensfunId" TEXT NOT NULL,
    "manufacturer" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "focalLengthMinMm" INTEGER NOT NULL,
    "focalLengthMaxMm" INTEGER NOT NULL,
    "maxAperture" DECIMAL(65,30) NOT NULL,
    "lensType" "LensType" NOT NULL DEFAULT 'PRIME',
    "popularityWeight" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LensfunLens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LensfunLens_lensfunId_key" ON "LensfunLens"("lensfunId");

-- CreateIndex
CREATE INDEX "LensfunLens_manufacturer_idx" ON "LensfunLens"("manufacturer");

-- CreateIndex
CREATE INDEX "LensfunLens_model_idx" ON "LensfunLens"("model");

-- CreateIndex
CREATE INDEX "LensfunLens_popularityWeight_idx" ON "LensfunLens"("popularityWeight");
