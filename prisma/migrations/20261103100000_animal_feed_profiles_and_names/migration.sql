ALTER TABLE "StockItem"
ADD COLUMN "crudeProteinPct" DECIMAL(8,4),
ADD COLUMN "crudeFiberPct" DECIMAL(8,4),
ADD COLUMN "energyValue" DECIMAL(14,4),
ADD COLUMN "energyUnit" TEXT,
ADD COLUMN "qualityNotes" TEXT,
ADD COLUMN "storageInstructions" TEXT,
ADD COLUMN "shelfLifeDays" INTEGER,
ADD COLUMN "openedLifeDays" INTEGER;

ALTER TABLE "Animal"
ADD COLUMN "name" TEXT;

ALTER TABLE "AnimalPerformanceRecord"
ADD COLUMN "feedItemId" TEXT;

CREATE INDEX "AnimalPerformanceRecord_farmId_feedItemId_recordedAt_idx"
ON "AnimalPerformanceRecord"("farmId", "feedItemId", "recordedAt");

ALTER TABLE "AnimalPerformanceRecord"
ADD CONSTRAINT "AnimalPerformanceRecord_feedItemId_fkey"
FOREIGN KEY ("feedItemId") REFERENCES "StockItem"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
