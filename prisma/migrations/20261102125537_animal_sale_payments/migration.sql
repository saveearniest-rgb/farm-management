-- CreateTable
CREATE TABLE "AnimalSalePayment" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "animalSaleId" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paymentMethod" "PaymentMethod",
    "reference" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnimalSalePayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AnimalSalePayment_farmId_receivedAt_idx" ON "AnimalSalePayment"("farmId", "receivedAt");

-- CreateIndex
CREATE INDEX "AnimalSalePayment_farmId_animalSaleId_receivedAt_idx" ON "AnimalSalePayment"("farmId", "animalSaleId", "receivedAt");

-- AddForeignKey
ALTER TABLE "AnimalSalePayment" ADD CONSTRAINT "AnimalSalePayment_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnimalSalePayment" ADD CONSTRAINT "AnimalSalePayment_animalSaleId_fkey" FOREIGN KEY ("animalSaleId") REFERENCES "AnimalSale"("id") ON DELETE CASCADE ON UPDATE CASCADE;
