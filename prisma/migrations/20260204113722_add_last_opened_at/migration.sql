-- DropIndex
DROP INDEX "Row_searchText_trgm_idx";

-- AlterTable
ALTER TABLE "Base" ADD COLUMN     "isStarred" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lastOpenedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX "Base_ownerId_lastOpenedAt_idx" ON "Base"("ownerId", "lastOpenedAt");
