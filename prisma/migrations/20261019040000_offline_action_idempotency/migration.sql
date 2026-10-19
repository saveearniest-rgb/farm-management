-- AlterTable
ALTER TABLE "ActivityLog" ADD COLUMN     "offlineId" TEXT;

-- AlterTable
ALTER TABLE "Expense" ADD COLUMN     "offlineId" TEXT;

-- AlterTable
ALTER TABLE "ScoutingLog" ADD COLUMN     "offlineId" TEXT;

-- AlterTable
ALTER TABLE "SprayRecord" ADD COLUMN     "offlineId" TEXT;

-- AlterTable
ALTER TABLE "WeatherLog" ADD COLUMN     "offlineId" TEXT;

-- AlterTable
ALTER TABLE "WorkEntry" ADD COLUMN     "offlineId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "ActivityLog_offlineId_key" ON "ActivityLog"("offlineId");

-- CreateIndex
CREATE UNIQUE INDEX "Expense_offlineId_key" ON "Expense"("offlineId");

-- CreateIndex
CREATE UNIQUE INDEX "ScoutingLog_offlineId_key" ON "ScoutingLog"("offlineId");

-- CreateIndex
CREATE UNIQUE INDEX "SprayRecord_offlineId_key" ON "SprayRecord"("offlineId");

-- CreateIndex
CREATE UNIQUE INDEX "WeatherLog_offlineId_key" ON "WeatherLog"("offlineId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkEntry_offlineId_key" ON "WorkEntry"("offlineId");
