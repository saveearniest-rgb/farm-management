-- CreateEnum
CREATE TYPE "AnimalHealthProductType" AS ENUM ('VACCINE', 'MEDICINE', 'OTHER');

-- CreateEnum
CREATE TYPE "AnimalHealthRecordType" AS ENUM ('VACCINATION', 'TREATMENT', 'DEWORMING', 'DIPPING', 'TICK_CONTROL', 'VET_VISIT');

-- CreateEnum
CREATE TYPE "AnimalPerformanceType" AS ENUM ('WEIGHT', 'MILK', 'EGGS');

-- CreateTable
CREATE TABLE "AnimalHealthProduct" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "AnimalHealthProductType" NOT NULL,
    "diseaseCovered" TEXT,
    "dose" TEXT,
    "route" TEXT,
    "storage" TEXT,
    "batch" TEXT,
    "expiresAt" TIMESTAMP(3),
    "costPerDose" DECIMAL(14,4),
    "withdrawalDays" INTEGER NOT NULL DEFAULT 0,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnimalHealthProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnimalVaccinationSchedule" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "species" TEXT NOT NULL,
    "breed" TEXT,
    "animalGroupId" TEXT,
    "ageDays" INTEGER,
    "firstDueAt" TIMESTAMP(3),
    "repeatEveryDays" INTEGER,
    "notes" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnimalVaccinationSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnimalHealthCase" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "animalId" TEXT,
    "animalGroupId" TEXT,
    "symptoms" TEXT NOT NULL,
    "diagnosis" TEXT,
    "diagnosedBy" TEXT,
    "outcome" TEXT,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "offlineId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnimalHealthCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnimalHealthRecord" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "animalId" TEXT,
    "animalGroupId" TEXT,
    "healthCaseId" TEXT,
    "productId" TEXT,
    "scheduleId" TEXT,
    "type" "AnimalHealthRecordType" NOT NULL,
    "administeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dose" TEXT,
    "route" TEXT,
    "batch" TEXT,
    "cost" DECIMAL(14,2),
    "withdrawalDays" INTEGER NOT NULL DEFAULT 0,
    "withdrawalUntil" TIMESTAMP(3),
    "notes" TEXT,
    "offlineId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnimalHealthRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnimalPerformanceRecord" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "animalId" TEXT,
    "animalGroupId" TEXT,
    "type" "AnimalPerformanceType" NOT NULL,
    "quantity" DECIMAL(14,4) NOT NULL,
    "unit" TEXT NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "offlineId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnimalPerformanceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AnimalHealthProduct_farmId_type_archivedAt_idx" ON "AnimalHealthProduct"("farmId", "type", "archivedAt");

-- CreateIndex
CREATE INDEX "AnimalVaccinationSchedule_farmId_species_breed_archivedAt_idx" ON "AnimalVaccinationSchedule"("farmId", "species", "breed", "archivedAt");

-- CreateIndex
CREATE INDEX "AnimalVaccinationSchedule_farmId_animalGroupId_idx" ON "AnimalVaccinationSchedule"("farmId", "animalGroupId");

-- CreateIndex
CREATE UNIQUE INDEX "AnimalHealthCase_offlineId_key" ON "AnimalHealthCase"("offlineId");

-- CreateIndex
CREATE INDEX "AnimalHealthCase_farmId_openedAt_resolvedAt_idx" ON "AnimalHealthCase"("farmId", "openedAt", "resolvedAt");

-- CreateIndex
CREATE INDEX "AnimalHealthCase_farmId_animalId_openedAt_idx" ON "AnimalHealthCase"("farmId", "animalId", "openedAt");

-- CreateIndex
CREATE INDEX "AnimalHealthCase_farmId_animalGroupId_openedAt_idx" ON "AnimalHealthCase"("farmId", "animalGroupId", "openedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AnimalHealthRecord_offlineId_key" ON "AnimalHealthRecord"("offlineId");

-- CreateIndex
CREATE INDEX "AnimalHealthRecord_farmId_animalId_administeredAt_idx" ON "AnimalHealthRecord"("farmId", "animalId", "administeredAt");

-- CreateIndex
CREATE INDEX "AnimalHealthRecord_farmId_animalGroupId_administeredAt_idx" ON "AnimalHealthRecord"("farmId", "animalGroupId", "administeredAt");

-- CreateIndex
CREATE INDEX "AnimalHealthRecord_farmId_withdrawalUntil_idx" ON "AnimalHealthRecord"("farmId", "withdrawalUntil");

-- CreateIndex
CREATE UNIQUE INDEX "AnimalPerformanceRecord_offlineId_key" ON "AnimalPerformanceRecord"("offlineId");

-- CreateIndex
CREATE INDEX "AnimalPerformanceRecord_farmId_type_recordedAt_idx" ON "AnimalPerformanceRecord"("farmId", "type", "recordedAt");

-- CreateIndex
CREATE INDEX "AnimalPerformanceRecord_farmId_animalId_recordedAt_idx" ON "AnimalPerformanceRecord"("farmId", "animalId", "recordedAt");

-- CreateIndex
CREATE INDEX "AnimalPerformanceRecord_farmId_animalGroupId_recordedAt_idx" ON "AnimalPerformanceRecord"("farmId", "animalGroupId", "recordedAt");

-- AddForeignKey
ALTER TABLE "AnimalHealthProduct" ADD CONSTRAINT "AnimalHealthProduct_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnimalVaccinationSchedule" ADD CONSTRAINT "AnimalVaccinationSchedule_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnimalVaccinationSchedule" ADD CONSTRAINT "AnimalVaccinationSchedule_productId_fkey" FOREIGN KEY ("productId") REFERENCES "AnimalHealthProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnimalVaccinationSchedule" ADD CONSTRAINT "AnimalVaccinationSchedule_animalGroupId_fkey" FOREIGN KEY ("animalGroupId") REFERENCES "AnimalGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnimalHealthCase" ADD CONSTRAINT "AnimalHealthCase_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnimalHealthCase" ADD CONSTRAINT "AnimalHealthCase_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "Animal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnimalHealthCase" ADD CONSTRAINT "AnimalHealthCase_animalGroupId_fkey" FOREIGN KEY ("animalGroupId") REFERENCES "AnimalGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnimalHealthRecord" ADD CONSTRAINT "AnimalHealthRecord_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnimalHealthRecord" ADD CONSTRAINT "AnimalHealthRecord_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "Animal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnimalHealthRecord" ADD CONSTRAINT "AnimalHealthRecord_animalGroupId_fkey" FOREIGN KEY ("animalGroupId") REFERENCES "AnimalGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnimalHealthRecord" ADD CONSTRAINT "AnimalHealthRecord_healthCaseId_fkey" FOREIGN KEY ("healthCaseId") REFERENCES "AnimalHealthCase"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnimalHealthRecord" ADD CONSTRAINT "AnimalHealthRecord_productId_fkey" FOREIGN KEY ("productId") REFERENCES "AnimalHealthProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnimalHealthRecord" ADD CONSTRAINT "AnimalHealthRecord_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "AnimalVaccinationSchedule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnimalPerformanceRecord" ADD CONSTRAINT "AnimalPerformanceRecord_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnimalPerformanceRecord" ADD CONSTRAINT "AnimalPerformanceRecord_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "Animal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnimalPerformanceRecord" ADD CONSTRAINT "AnimalPerformanceRecord_animalGroupId_fkey" FOREIGN KEY ("animalGroupId") REFERENCES "AnimalGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
