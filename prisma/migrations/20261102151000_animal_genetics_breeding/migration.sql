ALTER TYPE "AnimalEventType" ADD VALUE 'BREEDING';

CREATE TYPE "AnimalPurpose" AS ENUM ('MILK', 'MEAT', 'EGGS', 'DUAL', 'BREEDING', 'OTHER');
CREATE TYPE "AnimalTraitType" AS ENUM ('BIRTH_WEIGHT', 'COLOR', 'HORN_STATUS', 'TEMPERAMENT', 'CONFORMATION', 'OTHER');
CREATE TYPE "AnimalBreedingMethod" AS ENUM ('NATURAL', 'ARTIFICIAL_INSEMINATION');
CREATE TYPE "AnimalPregnancyResult" AS ENUM ('POSITIVE', 'NEGATIVE', 'INCONCLUSIVE');
CREATE TYPE "AnimalBirthOutcome" AS ENUM ('LIVE', 'STILLBORN', 'ABORTION', 'UNKNOWN');

ALTER TABLE "Animal"
ADD COLUMN "breedId" TEXT,
ADD COLUMN "damId" TEXT,
ADD COLUMN "sireId" TEXT,
ADD COLUMN "breedingRecordId" TEXT;

CREATE TABLE "AnimalSpeciesProfile" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "species" TEXT NOT NULL,
    "gestationDays" INTEGER,
    "sourceLabel" "FigureLabel",
    "sourceDate" TIMESTAMP(3),
    "sourceNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnimalSpeciesProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AnimalBreed" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "species" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "purpose" "AnimalPurpose" NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnimalBreed_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AnimalBreedBenchmark" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "breedId" TEXT NOT NULL,
    "traitName" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "unit" TEXT,
    "sourceLabel" "FigureLabel" NOT NULL,
    "sourceDate" TIMESTAMP(3) NOT NULL,
    "sourceNote" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnimalBreedBenchmark_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AnimalTraitRecord" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "animalId" TEXT NOT NULL,
    "type" "AnimalTraitType" NOT NULL,
    "textValue" TEXT,
    "numericValue" DECIMAL(14,4),
    "unit" TEXT,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "offlineId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnimalTraitRecord_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AnimalBreedingRecord" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "damId" TEXT NOT NULL,
    "sireId" TEXT,
    "semenBatch" TEXT,
    "method" "AnimalBreedingMethod" NOT NULL,
    "servedAt" TIMESTAMP(3) NOT NULL,
    "expectedBirthAt" TIMESTAMP(3),
    "pregnancyCheckedAt" TIMESTAMP(3),
    "pregnancyResult" "AnimalPregnancyResult",
    "birthAt" TIMESTAMP(3),
    "birthOutcome" "AnimalBirthOutcome",
    "notes" TEXT,
    "offlineId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnimalBreedingRecord_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AnimalSpeciesProfile_farmId_species_key" ON "AnimalSpeciesProfile"("farmId", "species");
CREATE UNIQUE INDEX "AnimalBreed_farmId_species_name_key" ON "AnimalBreed"("farmId", "species", "name");
CREATE INDEX "AnimalBreed_farmId_species_archivedAt_idx" ON "AnimalBreed"("farmId", "species", "archivedAt");
CREATE INDEX "AnimalBreedBenchmark_farmId_breedId_traitName_idx" ON "AnimalBreedBenchmark"("farmId", "breedId", "traitName");
CREATE UNIQUE INDEX "AnimalTraitRecord_offlineId_key" ON "AnimalTraitRecord"("offlineId");
CREATE INDEX "AnimalTraitRecord_farmId_animalId_type_recordedAt_idx" ON "AnimalTraitRecord"("farmId", "animalId", "type", "recordedAt");
CREATE UNIQUE INDEX "AnimalBreedingRecord_offlineId_key" ON "AnimalBreedingRecord"("offlineId");
CREATE INDEX "AnimalBreedingRecord_farmId_servedAt_idx" ON "AnimalBreedingRecord"("farmId", "servedAt");
CREATE INDEX "AnimalBreedingRecord_farmId_damId_servedAt_idx" ON "AnimalBreedingRecord"("farmId", "damId", "servedAt");
CREATE INDEX "AnimalBreedingRecord_farmId_sireId_servedAt_idx" ON "AnimalBreedingRecord"("farmId", "sireId", "servedAt");
CREATE INDEX "AnimalBreedingRecord_farmId_expectedBirthAt_idx" ON "AnimalBreedingRecord"("farmId", "expectedBirthAt");
CREATE INDEX "Animal_farmId_damId_idx" ON "Animal"("farmId", "damId");
CREATE INDEX "Animal_farmId_sireId_idx" ON "Animal"("farmId", "sireId");
CREATE INDEX "Animal_farmId_breedId_idx" ON "Animal"("farmId", "breedId");
CREATE INDEX "Animal_farmId_breedingRecordId_idx" ON "Animal"("farmId", "breedingRecordId");

ALTER TABLE "AnimalSpeciesProfile" ADD CONSTRAINT "AnimalSpeciesProfile_farmId_fkey"
FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AnimalBreed" ADD CONSTRAINT "AnimalBreed_farmId_fkey"
FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AnimalBreedBenchmark" ADD CONSTRAINT "AnimalBreedBenchmark_farmId_fkey"
FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AnimalBreedBenchmark" ADD CONSTRAINT "AnimalBreedBenchmark_breedId_fkey"
FOREIGN KEY ("breedId") REFERENCES "AnimalBreed"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AnimalTraitRecord" ADD CONSTRAINT "AnimalTraitRecord_farmId_fkey"
FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AnimalTraitRecord" ADD CONSTRAINT "AnimalTraitRecord_animalId_fkey"
FOREIGN KEY ("animalId") REFERENCES "Animal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AnimalBreedingRecord" ADD CONSTRAINT "AnimalBreedingRecord_farmId_fkey"
FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AnimalBreedingRecord" ADD CONSTRAINT "AnimalBreedingRecord_damId_fkey"
FOREIGN KEY ("damId") REFERENCES "Animal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AnimalBreedingRecord" ADD CONSTRAINT "AnimalBreedingRecord_sireId_fkey"
FOREIGN KEY ("sireId") REFERENCES "Animal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Animal" ADD CONSTRAINT "Animal_breedId_fkey"
FOREIGN KEY ("breedId") REFERENCES "AnimalBreed"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Animal" ADD CONSTRAINT "Animal_damId_fkey"
FOREIGN KEY ("damId") REFERENCES "Animal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Animal" ADD CONSTRAINT "Animal_sireId_fkey"
FOREIGN KEY ("sireId") REFERENCES "Animal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Animal" ADD CONSTRAINT "Animal_breedingRecordId_fkey"
FOREIGN KEY ("breedingRecordId") REFERENCES "AnimalBreedingRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;
