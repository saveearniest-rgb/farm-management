-- AlterEnum
ALTER TYPE "ExpenseCategory" ADD VALUE 'VETERINARY_MEDICINE';

-- AlterTable
ALTER TABLE "StockMovement" ADD COLUMN     "animalHealthRecordId" TEXT;

-- AlterTable
ALTER TABLE "AnimalHealthProduct" ADD COLUMN     "stockItemId" TEXT;

-- CreateIndex
CREATE INDEX "StockMovement_farmId_animalHealthRecordId_idx" ON "StockMovement"("farmId", "animalHealthRecordId");

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_animalHealthRecordId_fkey" FOREIGN KEY ("animalHealthRecordId") REFERENCES "AnimalHealthRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnimalHealthProduct" ADD CONSTRAINT "AnimalHealthProduct_stockItemId_fkey" FOREIGN KEY ("stockItemId") REFERENCES "StockItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
