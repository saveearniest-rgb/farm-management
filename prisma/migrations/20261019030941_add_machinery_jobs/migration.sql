-- CreateTable
CREATE TABLE "MachineJob" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "cycleId" TEXT,
    "plotId" TEXT,
    "description" TEXT NOT NULL,
    "hours" DECIMAL(10,2) NOT NULL,
    "fuelCost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "hireCost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "maintenanceCost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'TZS',
    "performedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MachineJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MachineJob_farmId_cycleId_performedAt_idx" ON "MachineJob"("farmId", "cycleId", "performedAt");

-- CreateIndex
CREATE INDEX "MachineJob_farmId_plotId_idx" ON "MachineJob"("farmId", "plotId");

-- AddForeignKey
ALTER TABLE "MachineJob" ADD CONSTRAINT "MachineJob_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MachineJob" ADD CONSTRAINT "MachineJob_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "CropCycle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MachineJob" ADD CONSTRAINT "MachineJob_plotId_fkey" FOREIGN KEY ("plotId") REFERENCES "Plot"("id") ON DELETE SET NULL ON UPDATE CASCADE;
