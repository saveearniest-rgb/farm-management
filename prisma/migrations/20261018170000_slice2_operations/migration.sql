-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'BANK', 'MOBILE_MONEY');

-- CreateEnum
CREATE TYPE "ScoutingSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- AlterTable
ALTER TABLE "ConsentRecord" ADD COLUMN     "expiresAt" TIMESTAMP(3),
ADD COLUMN     "retentionUntil" TIMESTAMP(3),
ADD COLUMN     "scope" TEXT,
ADD COLUMN     "sharedWith" TEXT;

-- AlterTable
ALTER TABLE "CropCycle" ADD COLUMN     "actualHarvestAt" TIMESTAMP(3),
ADD COLUMN     "actualStartAt" TIMESTAMP(3),
ADD COLUMN     "archivedAt" TIMESTAMP(3),
ADD COLUMN     "expectedHarvestAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "CropType" ADD COLUMN     "archivedAt" TIMESTAMP(3),
ADD COLUMN     "sourceDate" TIMESTAMP(3),
ADD COLUMN     "sourceNote" TEXT;

-- AlterTable
ALTER TABLE "Expense" ADD COLUMN     "plotId" TEXT;

-- AlterTable
ALTER TABLE "Farm" ADD COLUMN     "nationalFarmerId" TEXT;

-- AlterTable
ALTER TABLE "LandHolding" ADD COLUMN     "archivedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "NurseryCheck" ADD COLUMN     "offlineId" TEXT;

-- AlterTable
ALTER TABLE "Plot" ADD COLUMN     "archivedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "archivedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "WorkEntry" ADD COLUMN     "paymentMethod" "PaymentMethod",
ADD COLUMN     "paymentReference" TEXT;

-- AlterTable
ALTER TABLE "Worker" ADD COLUMN     "phone" TEXT;

-- CreateTable
CREATE TABLE "ExpenseAllocation" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "expenseId" TEXT NOT NULL,
    "cycleId" TEXT,
    "plotId" TEXT,
    "amount" DECIMAL(14,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'TZS',

    CONSTRAINT "ExpenseAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenureDispute" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "holdingId" TEXT,
    "plotId" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "description" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "resolution" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TenureDispute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FileAttachment" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "landHoldingId" TEXT,
    "plotId" TEXT,
    "cropTypeId" TEXT,
    "cycleId" TEXT,
    "taskId" TEXT,
    "filename" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FileAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeatherLog" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "plotId" TEXT NOT NULL,
    "cycleId" TEXT,
    "observedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rainfallMm" DECIMAL(10,2),
    "temperatureC" DECIMAL(6,2),
    "notes" TEXT,

    CONSTRAINT "WeatherLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScoutingLog" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "plotId" TEXT NOT NULL,
    "cycleId" TEXT,
    "observedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "issue" TEXT NOT NULL,
    "severity" "ScoutingSeverity" NOT NULL,
    "notes" TEXT,

    CONSTRAINT "ScoutingLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SprayRecord" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "plotId" TEXT NOT NULL,
    "cycleId" TEXT,
    "product" TEXT NOT NULL,
    "activeIngredient" TEXT,
    "batch" TEXT,
    "dose" TEXT,
    "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "preHarvestIntervalDays" INTEGER,
    "notes" TEXT,

    CONSTRAINT "SprayRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CropCycleStage" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "cycleId" TEXT NOT NULL,
    "stageKey" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "nameSw" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "expectedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "CropCycleStage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubsidyReceipt" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "input" TEXT NOT NULL,
    "quantity" DECIMAL(14,4) NOT NULL,
    "unit" TEXT NOT NULL,
    "price" DECIMAL(14,2),
    "currency" TEXT NOT NULL DEFAULT 'TZS',
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT,
    "notes" TEXT,

    CONSTRAINT "SubsidyReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExpenseAllocation_farmId_cycleId_idx" ON "ExpenseAllocation"("farmId", "cycleId");

-- CreateIndex
CREATE INDEX "ExpenseAllocation_farmId_plotId_idx" ON "ExpenseAllocation"("farmId", "plotId");

-- CreateIndex
CREATE INDEX "TenureDispute_farmId_status_occurredAt_idx" ON "TenureDispute"("farmId", "status", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "FileAttachment_storageKey_key" ON "FileAttachment"("storageKey");

-- CreateIndex
CREATE INDEX "FileAttachment_farmId_createdAt_idx" ON "FileAttachment"("farmId", "createdAt");

-- CreateIndex
CREATE INDEX "WeatherLog_farmId_plotId_observedAt_idx" ON "WeatherLog"("farmId", "plotId", "observedAt");

-- CreateIndex
CREATE INDEX "ScoutingLog_farmId_plotId_observedAt_idx" ON "ScoutingLog"("farmId", "plotId", "observedAt");

-- CreateIndex
CREATE INDEX "SprayRecord_farmId_plotId_appliedAt_idx" ON "SprayRecord"("farmId", "plotId", "appliedAt");

-- CreateIndex
CREATE INDEX "SprayRecord_cycleId_appliedAt_idx" ON "SprayRecord"("cycleId", "appliedAt");

-- CreateIndex
CREATE INDEX "CropCycleStage_farmId_cycleId_startedAt_idx" ON "CropCycleStage"("farmId", "cycleId", "startedAt");

-- CreateIndex
CREATE INDEX "SubsidyReceipt_farmId_receivedAt_idx" ON "SubsidyReceipt"("farmId", "receivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "NurseryCheck_offlineId_key" ON "NurseryCheck"("offlineId");

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_plotId_fkey" FOREIGN KEY ("plotId") REFERENCES "Plot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseAllocation" ADD CONSTRAINT "ExpenseAllocation_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseAllocation" ADD CONSTRAINT "ExpenseAllocation_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "CropCycle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseAllocation" ADD CONSTRAINT "ExpenseAllocation_plotId_fkey" FOREIGN KEY ("plotId") REFERENCES "Plot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenureDispute" ADD CONSTRAINT "TenureDispute_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenureDispute" ADD CONSTRAINT "TenureDispute_holdingId_fkey" FOREIGN KEY ("holdingId") REFERENCES "LandHolding"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenureDispute" ADD CONSTRAINT "TenureDispute_plotId_fkey" FOREIGN KEY ("plotId") REFERENCES "Plot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileAttachment" ADD CONSTRAINT "FileAttachment_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileAttachment" ADD CONSTRAINT "FileAttachment_landHoldingId_fkey" FOREIGN KEY ("landHoldingId") REFERENCES "LandHolding"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileAttachment" ADD CONSTRAINT "FileAttachment_plotId_fkey" FOREIGN KEY ("plotId") REFERENCES "Plot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileAttachment" ADD CONSTRAINT "FileAttachment_cropTypeId_fkey" FOREIGN KEY ("cropTypeId") REFERENCES "CropType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileAttachment" ADD CONSTRAINT "FileAttachment_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "CropCycle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileAttachment" ADD CONSTRAINT "FileAttachment_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeatherLog" ADD CONSTRAINT "WeatherLog_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeatherLog" ADD CONSTRAINT "WeatherLog_plotId_fkey" FOREIGN KEY ("plotId") REFERENCES "Plot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeatherLog" ADD CONSTRAINT "WeatherLog_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "CropCycle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScoutingLog" ADD CONSTRAINT "ScoutingLog_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScoutingLog" ADD CONSTRAINT "ScoutingLog_plotId_fkey" FOREIGN KEY ("plotId") REFERENCES "Plot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScoutingLog" ADD CONSTRAINT "ScoutingLog_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "CropCycle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SprayRecord" ADD CONSTRAINT "SprayRecord_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SprayRecord" ADD CONSTRAINT "SprayRecord_plotId_fkey" FOREIGN KEY ("plotId") REFERENCES "Plot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SprayRecord" ADD CONSTRAINT "SprayRecord_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "CropCycle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CropCycleStage" ADD CONSTRAINT "CropCycleStage_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "CropCycle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubsidyReceipt" ADD CONSTRAINT "SubsidyReceipt_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;
