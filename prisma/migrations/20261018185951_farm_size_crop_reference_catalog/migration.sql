-- CreateEnum
CREATE TYPE "CropReferenceKind" AS ENUM ('DISEASE', 'PESTICIDE');

-- AlterTable
ALTER TABLE "Farm" ADD COLUMN     "totalAreaUnit" TEXT NOT NULL DEFAULT 'acre',
ADD COLUMN     "totalAreaValue" DECIMAL(12,4);

-- CreateTable
CREATE TABLE "CropReferenceItem" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "cropTypeId" TEXT NOT NULL,
    "kind" "CropReferenceKind" NOT NULL,
    "name" TEXT NOT NULL,
    "activeIngredient" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CropReferenceItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CropReferenceItem_farmId_cropTypeId_kind_idx" ON "CropReferenceItem"("farmId", "cropTypeId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "CropReferenceItem_farmId_cropTypeId_kind_name_key" ON "CropReferenceItem"("farmId", "cropTypeId", "kind", "name");

-- AddForeignKey
ALTER TABLE "CropReferenceItem" ADD CONSTRAINT "CropReferenceItem_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CropReferenceItem" ADD CONSTRAINT "CropReferenceItem_cropTypeId_fkey" FOREIGN KEY ("cropTypeId") REFERENCES "CropType"("id") ON DELETE CASCADE ON UPDATE CASCADE;
