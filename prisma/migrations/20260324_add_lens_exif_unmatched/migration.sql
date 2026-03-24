-- CreateTable
CREATE TABLE "LensExifUnmatched" (
    "id" TEXT NOT NULL,
    "rawLensModelString" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LensExifUnmatched_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LensExifUnmatched_userId_idx" ON "LensExifUnmatched"("userId");

-- AddForeignKey
ALTER TABLE "LensExifUnmatched" ADD CONSTRAINT "LensExifUnmatched_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
