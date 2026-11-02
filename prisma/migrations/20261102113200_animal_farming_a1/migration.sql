-- CreateEnum
CREATE TYPE "AnimalEventType" AS ENUM ('BIRTH', 'PURCHASE', 'WEANING', 'MOVE', 'SALE', 'DEATH', 'CULLED', 'OTHER');

-- CreateEnum
CREATE TYPE "AnimalDailyRecordType" AS ENUM ('FEEDING', 'WATER', 'MILK', 'EGGS', 'HEALTH_CHECK', 'OTHER');

-- CreateEnum
CREATE TYPE "AnimalTrackingMode" AS ENUM ('INDIVIDUAL', 'HEAD_COUNT');

-- AlterEnum
ALTER TYPE "ExpenseCategory" ADD VALUE 'FEED';

-- AlterTable
ALTER TABLE "Farm" ADD COLUMN     "animalDivisionEnabled" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "ExpenseAllocation" ADD COLUMN     "animalGroupId" TEXT,
ADD COLUMN     "animalId" TEXT;

-- AlterTable
ALTER TABLE "StockMovement" ADD COLUMN     "animalGroupId" TEXT,
ADD COLUMN     "animalId" TEXT;

-- CreateTable
CREATE TABLE "Animal" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "tagNumber" TEXT NOT NULL,
    "species" TEXT NOT NULL,
    "breed" TEXT,
    "sex" TEXT,
    "birthDate" TIMESTAMP(3),
    "source" TEXT,
    "purchasePrice" DECIMAL(14,2),
    "seller" TEXT,
    "groupId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Animal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnimalGroup" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "species" TEXT NOT NULL,
    "trackingMode" "AnimalTrackingMode" NOT NULL DEFAULT 'HEAD_COUNT',
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startingCount" INTEGER NOT NULL,
    "notes" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnimalGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnimalEvent" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "animalId" TEXT,
    "animalGroupId" TEXT,
    "type" "AnimalEventType" NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "quantity" INTEGER,
    "purchaseCost" DECIMAL(14,2),
    "seller" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnimalEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnimalDailyRecord" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "animalId" TEXT,
    "animalGroupId" TEXT,
    "feedItemId" TEXT,
    "type" "AnimalDailyRecordType" NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "quantity" DECIMAL(14,4),
    "unit" TEXT,
    "notes" TEXT,
    "offlineId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnimalDailyRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeedRation" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "animalGroupId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "quantityPerHead" DECIMAL(14,4) NOT NULL,
    "unit" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeedRation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Animal_farmId_species_status_idx" ON "Animal"("farmId", "species", "status");

-- CreateIndex
CREATE INDEX "Animal_farmId_groupId_idx" ON "Animal"("farmId", "groupId");

-- CreateIndex
CREATE UNIQUE INDEX "Animal_farmId_tagNumber_key" ON "Animal"("farmId", "tagNumber");

-- CreateIndex
CREATE INDEX "AnimalGroup_farmId_species_startDate_idx" ON "AnimalGroup"("farmId", "species", "startDate");

-- CreateIndex
CREATE UNIQUE INDEX "AnimalGroup_farmId_name_key" ON "AnimalGroup"("farmId", "name");

-- CreateIndex
CREATE INDEX "AnimalEvent_farmId_animalId_occurredAt_idx" ON "AnimalEvent"("farmId", "animalId", "occurredAt");

-- CreateIndex
CREATE INDEX "AnimalEvent_farmId_animalGroupId_occurredAt_idx" ON "AnimalEvent"("farmId", "animalGroupId", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "AnimalDailyRecord_offlineId_key" ON "AnimalDailyRecord"("offlineId");

-- CreateIndex
CREATE INDEX "AnimalDailyRecord_farmId_recordedAt_idx" ON "AnimalDailyRecord"("farmId", "recordedAt");

-- CreateIndex
CREATE INDEX "AnimalDailyRecord_farmId_animalId_recordedAt_idx" ON "AnimalDailyRecord"("farmId", "animalId", "recordedAt");

-- CreateIndex
CREATE INDEX "AnimalDailyRecord_farmId_animalGroupId_recordedAt_idx" ON "AnimalDailyRecord"("farmId", "animalGroupId", "recordedAt");

-- CreateIndex
CREATE INDEX "FeedRation_farmId_animalGroupId_idx" ON "FeedRation"("farmId", "animalGroupId");

-- CreateIndex
CREATE UNIQUE INDEX "FeedRation_farmId_animalGroupId_itemId_key" ON "FeedRation"("farmId", "animalGroupId", "itemId");

-- CreateIndex
CREATE INDEX "ExpenseAllocation_farmId_animalId_idx" ON "ExpenseAllocation"("farmId", "animalId");

-- CreateIndex
CREATE INDEX "ExpenseAllocation_farmId_animalGroupId_idx" ON "ExpenseAllocation"("farmId", "animalGroupId");

-- CreateIndex
CREATE INDEX "StockMovement_farmId_animalId_movedAt_idx" ON "StockMovement"("farmId", "animalId", "movedAt");

-- CreateIndex
CREATE INDEX "StockMovement_farmId_animalGroupId_movedAt_idx" ON "StockMovement"("farmId", "animalGroupId", "movedAt");

-- AddForeignKey
ALTER TABLE "ExpenseAllocation" ADD CONSTRAINT "ExpenseAllocation_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "Animal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseAllocation" ADD CONSTRAINT "ExpenseAllocation_animalGroupId_fkey" FOREIGN KEY ("animalGroupId") REFERENCES "AnimalGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "Animal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_animalGroupId_fkey" FOREIGN KEY ("animalGroupId") REFERENCES "AnimalGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Animal" ADD CONSTRAINT "Animal_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Animal" ADD CONSTRAINT "Animal_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "AnimalGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnimalGroup" ADD CONSTRAINT "AnimalGroup_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnimalEvent" ADD CONSTRAINT "AnimalEvent_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnimalEvent" ADD CONSTRAINT "AnimalEvent_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "Animal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnimalEvent" ADD CONSTRAINT "AnimalEvent_animalGroupId_fkey" FOREIGN KEY ("animalGroupId") REFERENCES "AnimalGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnimalDailyRecord" ADD CONSTRAINT "AnimalDailyRecord_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnimalDailyRecord" ADD CONSTRAINT "AnimalDailyRecord_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "Animal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnimalDailyRecord" ADD CONSTRAINT "AnimalDailyRecord_animalGroupId_fkey" FOREIGN KEY ("animalGroupId") REFERENCES "AnimalGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnimalDailyRecord" ADD CONSTRAINT "AnimalDailyRecord_feedItemId_fkey" FOREIGN KEY ("feedItemId") REFERENCES "StockItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedRation" ADD CONSTRAINT "FeedRation_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedRation" ADD CONSTRAINT "FeedRation_animalGroupId_fkey" FOREIGN KEY ("animalGroupId") REFERENCES "AnimalGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedRation" ADD CONSTRAINT "FeedRation_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "StockItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

