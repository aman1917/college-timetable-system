-- AlterTable
ALTER TABLE "subject_allocations" ADD COLUMN     "commonGroupId" TEXT,
ADD COLUMN     "isCommon" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "common_groups" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "common_groups_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "common_groups_code_key" ON "common_groups"("code");

-- CreateIndex
CREATE INDEX "subject_allocations_commonGroupId_idx" ON "subject_allocations"("commonGroupId");

-- AddForeignKey
ALTER TABLE "subject_allocations" ADD CONSTRAINT "subject_allocations_commonGroupId_fkey" FOREIGN KEY ("commonGroupId") REFERENCES "common_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;
