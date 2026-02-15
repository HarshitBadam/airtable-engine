-- DropIndex
DROP INDEX IF EXISTS "Row_tableId_rowIndex_idx";

-- AlterTable: Column
ALTER TABLE "Column" ADD COLUMN IF NOT EXISTS "config" JSONB,
ADD COLUMN IF NOT EXISTS "defaultValue" TEXT,
ADD COLUMN IF NOT EXISTS "sourceColumnId" TEXT;

-- AlterTable: Row.rowIndex → DOUBLE PRECISION
ALTER TABLE "Row" ALTER COLUMN "rowIndex" SET DATA TYPE DOUBLE PRECISION;

-- AlterTable: View
ALTER TABLE "View" ADD COLUMN IF NOT EXISTS "ranksStale" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable: ViewRowRank
CREATE TABLE IF NOT EXISTS "ViewRowRank" (
    "viewId" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "rowId" UUID NOT NULL,

    CONSTRAINT "ViewRowRank_pkey" PRIMARY KEY ("viewId","rank")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ViewRowRank_viewId_rowId_key" ON "ViewRowRank"("viewId", "rowId");

-- AddForeignKey
ALTER TABLE "ViewRowRank" ADD CONSTRAINT "ViewRowRank_viewId_fkey" FOREIGN KEY ("viewId") REFERENCES "View"("id") ON DELETE CASCADE ON UPDATE CASCADE;
