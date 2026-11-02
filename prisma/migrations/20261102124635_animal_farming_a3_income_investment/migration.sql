-- CreateEnum
CREATE TYPE "AnimalProductLine" AS ENUM ('MILK', 'MEAT', 'EGGS', 'LIVE_ANIMAL', 'MANURE', 'HIDES', 'BREEDING_SERVICE', 'OTHER');

-- CreateEnum
CREATE TYPE "AssetDivision" AS ENUM ('CROPS', 'ANIMALS', 'SHARED');

-- AlterTable
ALTER TABLE "Asset" ADD COLUMN     "division" "AssetDivision",
ADD COLUMN     "fundingSource" TEXT,
ADD COLUMN     "isCapitalInvestment" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "productLine" "AnimalProductLine",
ADD COLUMN     "salvageValue" DECIMAL(14,2);

-- AlterTable
ALTER TABLE "ExpenseAllocation" ADD COLUMN     "animalProductLine" "AnimalProductLine";

-- CreateTable
CREATE TABLE "AnimalSale" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "productLine" "AnimalProductLine" NOT NULL,
    "animalId" TEXT,
    "animalGroupId" TEXT,
    "soldAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "quantity" DECIMAL(14,4) NOT NULL,
    "unit" TEXT NOT NULL,
    "price" DECIMAL(14,2) NOT NULL,
    "totalAmount" DECIMAL(14,2) NOT NULL,
    "amountReceived" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "paymentMethod" "PaymentMethod",
    "paymentReference" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'TZS',
    "buyer" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnimalSale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnimalSalesForecast" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "productLine" "AnimalProductLine" NOT NULL,
    "plannedFor" TIMESTAMP(3) NOT NULL,
    "quantity" DECIMAL(14,4) NOT NULL,
    "unit" TEXT NOT NULL,
    "unitPrice" DECIMAL(14,2),
    "currency" TEXT NOT NULL DEFAULT 'TZS',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnimalSalesForecast_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AnimalSale_farmId_productLine_soldAt_idx" ON "AnimalSale"("farmId", "productLine", "soldAt");

-- CreateIndex
CREATE INDEX "AnimalSale_farmId_animalId_soldAt_idx" ON "AnimalSale"("farmId", "animalId", "soldAt");

-- CreateIndex
CREATE INDEX "AnimalSale_farmId_animalGroupId_soldAt_idx" ON "AnimalSale"("farmId", "animalGroupId", "soldAt");

-- CreateIndex
CREATE INDEX "AnimalSalesForecast_farmId_plannedFor_idx" ON "AnimalSalesForecast"("farmId", "plannedFor");

-- CreateIndex
CREATE INDEX "AnimalSalesForecast_farmId_productLine_plannedFor_idx" ON "AnimalSalesForecast"("farmId", "productLine", "plannedFor");

-- AddForeignKey
ALTER TABLE "AnimalSale" ADD CONSTRAINT "AnimalSale_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnimalSale" ADD CONSTRAINT "AnimalSale_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "Animal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnimalSale" ADD CONSTRAINT "AnimalSale_animalGroupId_fkey" FOREIGN KEY ("animalGroupId") REFERENCES "AnimalGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnimalSalesForecast" ADD CONSTRAINT "AnimalSalesForecast_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;
