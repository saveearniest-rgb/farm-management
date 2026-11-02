CREATE TYPE "AssetStatus" AS ENUM ('ACTIVE', 'IDLE', 'RETIRED');

CREATE TABLE "Asset" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "purchasedAt" TIMESTAMP(3),
    "purchaseCost" DECIMAL(14,2),
    "currency" TEXT NOT NULL DEFAULT 'TZS',
    "expectedLifeMonths" INTEGER,
    "status" "AssetStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AssetUsage" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "cycleId" TEXT,
    "plotId" TEXT,
    "usedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "hours" DECIMAL(10,2),
    "distance" DECIMAL(12,2),
    "distanceUnit" TEXT,
    "operator" TEXT,
    "fuelCost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'TZS',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssetUsage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AssetMaintenance" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "cycleId" TEXT,
    "performedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "description" TEXT NOT NULL,
    "cost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'TZS',
    "nextServiceAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssetMaintenance_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Asset_farmId_status_idx" ON "Asset"("farmId", "status");
CREATE INDEX "AssetUsage_farmId_assetId_usedAt_idx" ON "AssetUsage"("farmId", "assetId", "usedAt");
CREATE INDEX "AssetUsage_farmId_cycleId_usedAt_idx" ON "AssetUsage"("farmId", "cycleId", "usedAt");
CREATE INDEX "AssetMaintenance_farmId_assetId_performedAt_idx" ON "AssetMaintenance"("farmId", "assetId", "performedAt");
CREATE INDEX "AssetMaintenance_farmId_cycleId_performedAt_idx" ON "AssetMaintenance"("farmId", "cycleId", "performedAt");

ALTER TABLE "Asset" ADD CONSTRAINT "Asset_farmId_fkey"
    FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssetUsage" ADD CONSTRAINT "AssetUsage_farmId_fkey"
    FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssetUsage" ADD CONSTRAINT "AssetUsage_assetId_fkey"
    FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssetUsage" ADD CONSTRAINT "AssetUsage_cycleId_fkey"
    FOREIGN KEY ("cycleId") REFERENCES "CropCycle"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AssetUsage" ADD CONSTRAINT "AssetUsage_plotId_fkey"
    FOREIGN KEY ("plotId") REFERENCES "Plot"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AssetMaintenance" ADD CONSTRAINT "AssetMaintenance_farmId_fkey"
    FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssetMaintenance" ADD CONSTRAINT "AssetMaintenance_assetId_fkey"
    FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssetMaintenance" ADD CONSTRAINT "AssetMaintenance_cycleId_fkey"
    FOREIGN KEY ("cycleId") REFERENCES "CropCycle"("id") ON DELETE SET NULL ON UPDATE CASCADE;
