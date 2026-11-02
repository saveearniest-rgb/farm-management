"use server";

import { AnimalDailyRecordType, AnimalEventType, AnimalHealthProductType, AnimalHealthRecordType, AnimalPerformanceType, AnimalTrackingMode, AssetStatus, CropMode, CropReferenceKind, DocumentStatus, ExpenseCategory, FarmRole, PaymentMethod, Prisma, ScoutingSeverity, TaskStatus, TenureType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAppContext } from "@/lib/auth";
import { db } from "@/lib/db";
import { tenantDb } from "@/lib/tenant-db";
import { parseExpenseAllocations } from "@/lib/expense-allocations";
import { calculateAnimalGroupCount } from "@/lib/animal-management";
import type { FormState } from "@/lib/form-state";

const optionalNumber = z.preprocess(
  (value) => (value === "" || value === null || value === undefined ? undefined : value),
  z.coerce.number().finite().optional(),
);
const positiveNumber = z.coerce.number().finite().positive();
const optionalText = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().trim().max(500).optional(),
);

function value(formData: FormData, key: string) {
  const field = formData.get(key);
  return typeof field === "string" ? field.trim() : "";
}

function optionalDate(input: string) {
  if (!input) return null;
  const date = new Date(`${input}T12:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function dateError(input: string) {
  return input.length > 0 && optionalDate(input) === null;
}

async function signedInFarm() {
  return getAppContext();
}

function message(error: unknown) {
  if (
    error instanceof Prisma.PrismaClientInitializationError ||
    (error instanceof Prisma.PrismaClientKnownRequestError &&
      ["P1001", "P1003", "P1010", "P2021", "P2022"].includes(error.code))
  ) {
    return "Database setup is incomplete. Configure PostgreSQL and run npm run db:migrate.";
  }
  return null;
}

function invalid(messageText: string): FormState {
  return { message: messageText };
}

function parseCsvRows(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]!;
    if (character === '"') {
      if (quoted && text[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      row.push(cell);
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += character;
    }
  }

  if (quoted) return null;
  row.push(cell);
  if (row.some((value) => value.trim())) rows.push(row);
  return rows;
}

function catalogCsvMessage(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    return "This crop already has a reference with that name and type.";
  }
  return message(error);
}

export async function createCropReferenceAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const context = await signedInFarm();
  if (!context) return invalid("Your session expired. Sign in again.");
  if (context.role !== FarmRole.OWNER) return invalid("Only a farm owner can manage crop reference data.");
  const parsed = z.object({
    cropTypeId: z.string().min(1),
    kind: z.nativeEnum(CropReferenceKind),
    name: z.string().trim().min(1).max(120),
    activeIngredient: optionalText,
    notes: z.preprocess(
      (input) => (typeof input === "string" && input.trim() === "" ? undefined : input),
      z.string().trim().max(2000).optional(),
    ),
  }).safeParse({
    cropTypeId: value(formData, "cropTypeId"),
    kind: value(formData, "kind"),
    name: value(formData, "name"),
    activeIngredient: value(formData, "activeIngredient"),
    notes: value(formData, "notes"),
  });
  if (!parsed.success) return invalid("Enter a crop, reference type and name.");

  const db = tenantDb(context.farm.id, context.user.id);
  const crop = await db.cropType.findFirst({
    where: { id: parsed.data.cropTypeId, archivedAt: null },
    select: { id: true },
  });
  if (!crop) return invalid("Choose a crop from this farm.");

  try {
    await db.cropReferenceItem.create({
      data: {
        farmId: context.farm.id,
        cropTypeId: crop.id,
        kind: parsed.data.kind,
        name: parsed.data.name,
        activeIngredient: parsed.data.activeIngredient,
        notes: parsed.data.notes,
      },
    });
  } catch (error) {
    const errorMessage = catalogCsvMessage(error);
    if (errorMessage) return invalid(errorMessage);
    throw error;
  }

  revalidatePath("/");
  return { message: "Crop reference saved.", success: true };
}

export async function importCropReferencesAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const context = await signedInFarm();
  if (!context) return invalid("Your session expired. Sign in again.");
  if (context.role !== FarmRole.OWNER) return invalid("Only a farm owner can import crop reference data.");
  const cropTypeId = value(formData, "cropTypeId");
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return invalid("Choose a CSV template file to import.");
  if (file.size > 1_000_000) return invalid("The CSV file must be smaller than 1 MB.");

  const db = tenantDb(context.farm.id, context.user.id);
  const crop = await db.cropType.findFirst({
    where: { id: cropTypeId, archivedAt: null },
    select: { id: true },
  });
  if (!crop) return invalid("Choose a crop from this farm.");

  const rows = parseCsvRows((await file.text()).replace(/^\uFEFF/, ""));
  if (!rows || rows.length < 2) return invalid("The CSV is empty or has unclosed quotation marks.");
  const expectedHeader = ["kind", "name", "active_ingredient", "notes"];
  if (rows[0]!.map((cell) => cell.trim().toLowerCase()).join(",") !== expectedHeader.join(",")) {
    return invalid("Use the downloaded template with columns: kind, name, active_ingredient, notes.");
  }
  if (rows.length > 201) return invalid("Import no more than 200 crop reference rows at a time.");

  const uniqueRows = new Map<string, {
    farmId: string;
    cropTypeId: string;
    kind: CropReferenceKind;
    name: string;
    activeIngredient: string | null;
    notes: string | null;
  }>();
  for (const [index, row] of rows.slice(1).entries()) {
    if (row.length !== expectedHeader.length) return invalid(`Row ${index + 2} must contain exactly four columns.`);
    const [kindInput, nameInput, ingredientInput, notesInput] = row.map((cell) => cell.trim());
    const kind = kindInput?.toUpperCase();
    const name = nameInput ?? "";
    const activeIngredient = ingredientInput || null;
    const notes = notesInput || null;
    if (kind !== "DISEASE" && kind !== "PESTICIDE") {
      return invalid(`Row ${index + 2}: kind must be DISEASE or PESTICIDE.`);
    }
    if (!name || name.length > 120 || (activeIngredient?.length ?? 0) > 500 || (notes?.length ?? 0) > 2000) {
      return invalid(`Row ${index + 2}: enter a name (up to 120 characters); optional fields have length limits.`);
    }
    const key = `${kind}:${name.toLocaleLowerCase()}`;
    uniqueRows.set(key, {
      farmId: context.farm.id,
      cropTypeId: crop.id,
      kind,
      name,
      activeIngredient,
      notes,
    });
  }
  if (!uniqueRows.size) return invalid("Add at least one disease or pesticide row to the template.");

  try {
    const result = await db.cropReferenceItem.createMany({
      data: [...uniqueRows.values()],
      skipDuplicates: true,
    });
    revalidatePath("/");
    return {
      message: `Imported ${result.count} crop reference item${result.count === 1 ? "" : "s"}. Duplicate rows were skipped.`,
      success: true,
    };
  } catch (error) {
    const errorMessage = catalogCsvMessage(error);
    if (errorMessage) return invalid(errorMessage);
    throw error;
  }
}

export async function createHoldingAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const context = await signedInFarm();
  if (!context) return invalid("Your session expired. Sign in again.");
  if (context.role !== FarmRole.OWNER) return invalid("Only a farm owner can add land holdings.");

  const ownedInput = value(formData, "owned");
  const parsed = z.object({
    name: z.string().trim().min(2).max(100),
    owned: z.enum(["yes", "no"]),
    costOrRent: optionalNumber,
    ownerName: optionalText,
    leaseStart: z.string().optional(),
    leaseEnd: z.string().optional(),
    notes: optionalText,
  }).safeParse({
    name: value(formData, "name"),
    owned: ownedInput,
    costOrRent: value(formData, "costOrRent"),
    ownerName: value(formData, "ownerName"),
    leaseStart: value(formData, "leaseStart"),
    leaseEnd: value(formData, "leaseEnd"),
    notes: value(formData, "notes"),
  });
  if (!parsed.success) return invalid("Enter a name and valid land details.");
  if (dateError(parsed.data.leaseStart ?? "") || dateError(parsed.data.leaseEnd ?? "")) {
    return invalid("Enter valid lease dates.");
  }

  try {
    await tenantDb(context.farm.id, context.user.id).landHolding.create({
      data: {
        farmId: context.farm.id,
        name: parsed.data.name,
        owned: parsed.data.owned === "yes",
        costOrRent: parsed.data.costOrRent,
        currency: context.farm.currency,
        ownerName: parsed.data.ownerName,
        leaseStart: optionalDate(parsed.data.leaseStart ?? ""),
        leaseEnd: optionalDate(parsed.data.leaseEnd ?? ""),
        notes: parsed.data.notes,
      },
    });
  } catch (error) {
    const databaseMessage = message(error);
    if (databaseMessage) return invalid(databaseMessage);
    throw error;
  }

  revalidatePath("/");
  return { message: "Land holding added.", success: true };
}

export async function createPlotAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const context = await signedInFarm();
  if (!context) return invalid("Your session expired. Sign in again.");
  if (context.role !== FarmRole.OWNER) return invalid("Only a farm owner can change land records.");

  const parsed = z.object({
    holdingId: z.string().min(1),
    name: z.string().trim().min(1).max(80),
    areaValue: positiveNumber,
    areaUnit: z.enum(["acre", "hectare", "square metre"]),
    soilType: optionalText,
    waterSource: optionalText,
    gpsLat: optionalNumber,
    gpsLng: optionalNumber,
    tenureType: z.nativeEnum(TenureType),
    documentStatus: z.nativeEnum(DocumentStatus),
    renewalDate: z.string().optional(),
    notes: optionalText,
  }).safeParse({
    holdingId: value(formData, "holdingId"),
    name: value(formData, "name"),
    areaValue: value(formData, "areaValue"),
    areaUnit: value(formData, "areaUnit"),
    soilType: value(formData, "soilType"),
    waterSource: value(formData, "waterSource"),
    gpsLat: value(formData, "gpsLat"),
    gpsLng: value(formData, "gpsLng"),
    tenureType: value(formData, "tenureType"),
    documentStatus: value(formData, "documentStatus"),
    renewalDate: value(formData, "renewalDate"),
    notes: value(formData, "notes"),
  });
  if (!parsed.success) return invalid("Enter a plot name, area, and valid land details.");
  if (
    (parsed.data.gpsLat !== undefined && (parsed.data.gpsLat < -90 || parsed.data.gpsLat > 90)) ||
    (parsed.data.gpsLng !== undefined && (parsed.data.gpsLng < -180 || parsed.data.gpsLng > 180))
  ) {
    return invalid("GPS coordinates are outside the valid range.");
  }
  if (dateError(parsed.data.renewalDate ?? "")) return invalid("Enter a valid renewal date.");

  const holding = await tenantDb(context.farm.id, context.user.id).landHolding.findFirst({
    where: { id: parsed.data.holdingId, farmId: context.farm.id },
    select: { id: true },
  });
  if (!holding) return invalid("Choose a land holding from this farm.");

  try {
    await tenantDb(context.farm.id, context.user.id).plot.create({
      data: {
        farmId: context.farm.id,
        holdingId: holding.id,
        name: parsed.data.name,
        areaValue: parsed.data.areaValue,
        areaUnit: parsed.data.areaUnit,
        soilType: parsed.data.soilType,
        waterSource: parsed.data.waterSource,
        gpsLat: parsed.data.gpsLat,
        gpsLng: parsed.data.gpsLng,
        tenureType: parsed.data.tenureType,
        documentStatus: parsed.data.documentStatus,
        renewalDate: optionalDate(parsed.data.renewalDate ?? ""),
        notes: parsed.data.notes,
      },
    });
  } catch (error) {
    const databaseMessage = message(error);
    if (databaseMessage) return invalid(databaseMessage);
    throw error;
  }

  revalidatePath("/");
  return { message: "Plot added.", success: true };
}

export async function recordTenureDisputeAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const context = await signedInFarm();
  if (!context) return invalid("Your session expired. Sign in again.");
  if (context.role !== FarmRole.OWNER) return invalid("Only a farm owner can update tenure records.");
  const parsed = z.object({
    plotId: optionalText,
    holdingId: optionalText,
    occurredAt: z.string().optional(),
    description: z.string().trim().min(5).max(2000),
    status: z.enum(["OPEN", "RESOLVED"]),
    resolution: optionalText,
  }).safeParse({
    plotId: value(formData, "plotId"),
    holdingId: value(formData, "holdingId"),
    occurredAt: value(formData, "occurredAt"),
    description: value(formData, "description"),
    status: value(formData, "status") || "OPEN",
    resolution: value(formData, "resolution"),
  });
  if (!parsed.success || Boolean(parsed.data.plotId) === Boolean(parsed.data.holdingId)) {
    return invalid("Choose exactly one plot or land holding and describe the dispute.");
  }
  if (dateError(parsed.data.occurredAt ?? "")) return invalid("Enter a valid dispute date.");
  const tenant = tenantDb(context.farm.id, context.user.id);
  const record = parsed.data.plotId
    ? await tenant.plot.findFirst({ where: { id: parsed.data.plotId }, select: { id: true } })
    : await tenant.landHolding.findFirst({ where: { id: parsed.data.holdingId }, select: { id: true } });
  if (!record) return invalid("Choose a land record from this farm.");

  await tenant.tenureDispute.create({
    data: {
      farmId: context.farm.id,
      plotId: parsed.data.plotId || null,
      holdingId: parsed.data.holdingId || null,
      occurredAt: optionalDate(parsed.data.occurredAt ?? "") ?? new Date(),
      description: parsed.data.description,
      status: parsed.data.status,
      resolution: parsed.data.resolution,
    },
  });
  revalidatePath("/");
  return { message: "Tenure dispute recorded.", success: true };
}

export async function archiveLandRecordAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const context = await signedInFarm();
  if (!context) return invalid("Your session expired. Sign in again.");
  if (context.role !== FarmRole.OWNER) return invalid("Only a farm owner can archive land records.");
  const recordType = value(formData, "recordType");
  const recordId = value(formData, "recordId");
  if (!recordId || (recordType !== "plot" && recordType !== "holding")) {
    return invalid("Choose a land record to archive.");
  }
  const tenant = tenantDb(context.farm.id, context.user.id);
  if (recordType === "plot") {
    const activeCycle = await tenant.cropCycle.findFirst({
      where: { plotId: recordId, archivedAt: null, status: { not: "CLOSED" } },
      select: { id: true },
    });
    if (activeCycle) return invalid("Close or archive the crop cycle before archiving its plot.");
    const archived = await tenant.plot.updateMany({
      where: { id: recordId, archivedAt: null },
      data: { archivedAt: new Date() },
    });
    if (!archived.count) return invalid("The plot was not found or is already archived.");
  } else {
    const activePlot = await tenant.plot.findFirst({
      where: { holdingId: recordId, archivedAt: null },
      select: { id: true },
    });
    if (activePlot) return invalid("Archive or move all plots before archiving this land holding.");
    const archived = await tenant.landHolding.updateMany({
      where: { id: recordId, archivedAt: null },
      data: { archivedAt: new Date() },
    });
    if (!archived.count) return invalid("The land holding was not found or is already archived.");
  }
  revalidatePath("/");
  return { message: "Land record archived.", success: true };
}

const stageDefaults: Record<CropMode, Array<{ key: string; nameEn: string; nameSw: string; dayOffset: number | null }>> = {
  NURSERY: [
    { key: "seed-purchase", nameEn: "Seed purchase", nameSw: "Ununuzi wa mbegu", dayOffset: 0 },
    { key: "nursery", nameEn: "Nursery", nameSw: "Kitalu", dayOffset: null },
    { key: "transplant", nameEn: "Transplant", nameSw: "Kupandikiza", dayOffset: null },
    { key: "growing", nameEn: "Growing", nameSw: "Ukuaji", dayOffset: null },
    { key: "harvest", nameEn: "Harvest", nameSw: "Mavuno", dayOffset: null },
  ],
  DIRECT: [
    { key: "land-preparation", nameEn: "Land preparation", nameSw: "Maandalizi ya shamba", dayOffset: 0 },
    { key: "sowing", nameEn: "Sowing", nameSw: "Kupanda", dayOffset: null },
    { key: "growing", nameEn: "Growing", nameSw: "Ukuaji", dayOffset: null },
    { key: "harvest", nameEn: "Harvest", nameSw: "Mavuno", dayOffset: null },
  ],
};

function slug(valueText: string) {
  return valueText.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export async function createCropTypeAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const context = await signedInFarm();
  if (!context) return invalid("Your session expired. Sign in again.");
  if (context.role !== FarmRole.OWNER) return invalid("Only a farm owner can change crop templates.");

  const mode = value(formData, "mode");
  const parsed = z.object({
    name: z.string().trim().min(2).max(80),
    varietyDefault: optionalText,
    mode: z.nativeEnum(CropMode),
    cycleLengthDays: optionalNumber,
    spacingNote: optionalText,
    plantsPerAcre: optionalNumber,
    yieldPerPlant: optionalNumber,
    yieldUnit: z.string().trim().min(1).max(20),
    stages: z.string().max(2000).optional(),
    careTemplates: z.string().max(2000).optional(),
  }).safeParse({
    name: value(formData, "name"),
    varietyDefault: value(formData, "varietyDefault"),
    mode,
    cycleLengthDays: value(formData, "cycleLengthDays"),
    spacingNote: value(formData, "spacingNote"),
    plantsPerAcre: value(formData, "plantsPerAcre"),
    yieldPerPlant: value(formData, "yieldPerPlant"),
    yieldUnit: value(formData, "yieldUnit") || "kg",
    stages: value(formData, "stages"),
    careTemplates: value(formData, "careTemplates"),
  });
  if (!parsed.success) return invalid("Enter a crop name and review the template fields.");
  if (parsed.data.cycleLengthDays !== undefined &&
      (!Number.isInteger(parsed.data.cycleLengthDays) || parsed.data.cycleLengthDays < 1 || parsed.data.cycleLengthDays > 730)) {
    return invalid("Cycle length must be between 1 and 730 days.");
  }
  if (parsed.data.plantsPerAcre !== undefined && parsed.data.plantsPerAcre <= 0) {
    return invalid("Plants per acre must be greater than zero.");
  }
  if (parsed.data.yieldPerPlant !== undefined && parsed.data.yieldPerPlant <= 0) {
    return invalid("Yield per plant must be greater than zero.");
  }

  const stages = parsed.data.stages?.trim()
    ? parsed.data.stages.split(/\r?\n/).map((line, index) => {
        const [nameEn, nameSw, dayOffset] = line.split("|").map((part) => part.trim());
        return {
          key: slug(nameEn || `stage-${index + 1}`),
          nameEn: nameEn ?? "",
          nameSw: nameSw || nameEn || "",
          dayOffset: dayOffset ? Number(dayOffset) : null,
          sortOrder: index,
        };
      })
    : stageDefaults[parsed.data.mode].map((stage, index) => ({ ...stage, sortOrder: index }));
  if (
    stages.length === 0 ||
    stages.some((stage) =>
      !stage.nameEn ||
      (stage.dayOffset !== null &&
        (!Number.isInteger(stage.dayOffset) || stage.dayOffset < 0 || stage.dayOffset > 730)),
    )
  ) {
    return invalid("Check stages: use English | Kiswahili | days after planting.");
  }

  const careTemplates: Array<{
    taskType: string;
    afterStageKey: string;
    intervalDays: number;
    nameEn: string;
    nameSw: string;
  }> = [];
  for (const line of (parsed.data.careTemplates ?? "").split(/\r?\n/).filter(Boolean)) {
    const [nameEn, nameSw, stageName, intervalText] = line.split("|").map((part) => part.trim());
    const stage = stages.find(
      (item) => item.key === slug(stageName ?? "") || item.nameEn.toLowerCase() === stageName?.toLowerCase(),
    );
    const intervalDays = Number(intervalText);
    if (!nameEn || !stage || !Number.isInteger(intervalDays) || intervalDays < 1 || intervalDays > 365) {
      return invalid("Check reminders: use task | Kiswahili | stage name | repeat every N days.");
    }
    careTemplates.push({
      taskType: slug(nameEn),
      afterStageKey: stage.key,
      intervalDays,
      nameEn,
      nameSw: nameSw || nameEn,
    });
  }

  try {
    await tenantDb(context.farm.id, context.user.id).cropType.create({
      data: {
        farmId: context.farm.id,
        name: parsed.data.name,
        varietyDefault: parsed.data.varietyDefault,
        mode: parsed.data.mode,
        cycleLengthDays: parsed.data.cycleLengthDays,
        spacingNote: parsed.data.spacingNote,
        plantsPerAcre: parsed.data.plantsPerAcre,
        yieldPerPlant: parsed.data.yieldPerPlant,
        yieldUnit: parsed.data.yieldUnit,
        figureLabel: "PLACEHOLDER_BENCHMARK",
        stageTemplates: {
          create: stages.map((stage) => ({ ...stage, farmId: context.farm.id })),
        },
        careTemplates: {
          create: careTemplates.map((template) => ({
            ...template,
            farmId: context.farm.id,
          })),
        },
      },
    });
  } catch (error) {
    const databaseMessage = message(error);
    if (databaseMessage) return invalid(databaseMessage);
    throw error;
  }

  revalidatePath("/");
  return { message: "Crop type and templates added.", success: true };
}

export async function createCropCycleAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const context = await signedInFarm();
  if (!context) return invalid("Your session expired. Sign in again.");
  if (context.role !== FarmRole.OWNER) return invalid("Only a farm owner can create crop cycles.");

  const plantingDate = value(formData, "plantingAt");
  const parsed = z.object({
    plotId: z.string().min(1),
    cropTypeId: z.string().min(1),
    variety: optionalText,
    areaValue: positiveNumber,
    areaUnit: z.enum(["acre", "hectare", "square metre"]),
    plantingAt: z.string().optional(),
    expectedYield: optionalNumber,
    yieldUnit: z.string().trim().min(1).max(20),
  }).safeParse({
    plotId: value(formData, "plotId"),
    cropTypeId: value(formData, "cropTypeId"),
    variety: value(formData, "variety"),
    areaValue: value(formData, "areaValue"),
    areaUnit: value(formData, "areaUnit"),
    plantingAt: plantingDate,
    expectedYield: value(formData, "expectedYield"),
    yieldUnit: value(formData, "yieldUnit") || "kg",
  });
  if (!parsed.success) return invalid("Choose a plot and crop and enter a valid planted area.");
  if (dateError(parsed.data.plantingAt ?? "")) return invalid("Enter a valid planting date.");

  try {
    const result = await tenantDb(context.farm.id, context.user.id).$transaction(async (tx) => {
      const [plot, cropType] = await Promise.all([
        tx.plot.findFirst({ where: { id: parsed.data.plotId, farmId: context.farm.id } }),
        tx.cropType.findFirst({
          where: { id: parsed.data.cropTypeId, farmId: context.farm.id },
          include: { stageTemplates: true, careTemplates: true },
        }),
      ]);
      if (!plot || !cropType) return null;

      const plantingAt = optionalDate(parsed.data.plantingAt ?? "");
      const cycle = await tx.cropCycle.create({
        data: {
          farmId: context.farm.id,
          plotId: plot.id,
          cropTypeId: cropType.id,
          variety: parsed.data.variety || cropType.varietyDefault,
          areaValue: parsed.data.areaValue,
          areaUnit: parsed.data.areaUnit,
          plantingAt,
          expectedHarvestAt: plantingAt && cropType.cycleLengthDays
            ? new Date(plantingAt.getTime() + cropType.cycleLengthDays * 86_400_000)
            : null,
          status: cropType.mode === "NURSERY" ? "NURSERY" : "PLANNED",
          expectedYield: parsed.data.expectedYield,
          yieldUnit: parsed.data.yieldUnit,
        },
      });

      const plantedOn = optionalDate(parsed.data.plantingAt ?? "");
      if (plantedOn && cropType.cycleLengthDays) {
        const taskRows = cropType.careTemplates.flatMap((template) => {
          const stage = cropType.stageTemplates.find(
            (item) => item.key === template.afterStageKey,
          );
          if (stage?.dayOffset === null || stage?.dayOffset === undefined) return [];
          const firstDueDay = stage.dayOffset + template.intervalDays;
          const lastDueDay = Math.min(cropType.cycleLengthDays ?? firstDueDay, 730);
          const rows = [];
          for (let day = firstDueDay; day <= lastDueDay; day += template.intervalDays) {
            const dueAt = new Date(plantedOn);
            dueAt.setDate(dueAt.getDate() + day);
            rows.push({
              farmId: context.farm.id,
              cycleId: cycle.id,
              plotId: plot.id,
              taskType: template.taskType,
              titleEn: template.nameEn,
              titleSw: template.nameSw,
              dueAt,
            });
          }
          return rows;
        });
        if (taskRows.length > 0) await tx.task.createMany({ data: taskRows });
      }

      return { id: cycle.id, scheduledTasks: cropType.careTemplates.length };
    });

    if (!result) return invalid("Choose a plot and crop type from this farm.");
    revalidatePath("/");
    return {
      message: result.scheduledTasks
        ? "Crop cycle created. Reminders were scheduled where stage day offsets are set."
        : "Crop cycle created.",
      success: true,
    };
  } catch (error) {
    const databaseMessage = message(error);
    if (databaseMessage) return invalid(databaseMessage);
    throw error;
  }
}

export async function createNurseryBatchAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const context = await signedInFarm();
  if (!context) return invalid("Your session expired. Sign in again.");
  const parsed = z.object({
    cycleId: z.string().min(1),
    seedLot: optionalText,
    variety: optionalText,
    supplier: optionalText,
    quantity: positiveNumber,
    quantityUnit: z.string().trim().min(1).max(20),
    costAmount: optionalNumber,
    sownAt: z.string().optional(),
    notes: optionalText,
  }).safeParse({
    cycleId: value(formData, "cycleId"),
    seedLot: value(formData, "seedLot"),
    variety: value(formData, "variety"),
    supplier: value(formData, "supplier"),
    quantity: value(formData, "quantity"),
    quantityUnit: value(formData, "quantityUnit") || "g",
    costAmount: value(formData, "costAmount"),
    sownAt: value(formData, "sownAt"),
    notes: value(formData, "notes"),
  });
  if (!parsed.success) return invalid("Choose a crop cycle and enter the seed quantity.");
  if (dateError(parsed.data.sownAt ?? "")) return invalid("Enter a valid sowing date.");

  const cycle = await tenantDb(context.farm.id, context.user.id).cropCycle.findFirst({
    where: { id: parsed.data.cycleId, farmId: context.farm.id },
    include: { cropType: { select: { mode: true } } },
  });
  if (!cycle || cycle.cropType.mode !== "NURSERY") {
    return invalid("Choose a nursery-based crop cycle from this farm.");
  }

  try {
    await tenantDb(context.farm.id, context.user.id).nurseryBatch.create({
      data: {
        farmId: context.farm.id,
        cycleId: cycle.id,
        seedLot: parsed.data.seedLot,
        variety: parsed.data.variety,
        supplier: parsed.data.supplier,
        quantity: parsed.data.quantity,
        quantityUnit: parsed.data.quantityUnit,
        costAmount: parsed.data.costAmount,
        currency: context.farm.currency,
        sownAt: optionalDate(parsed.data.sownAt ?? ""),
        notes: parsed.data.notes,
      },
    });
  } catch (error) {
    const databaseMessage = message(error);
    if (databaseMessage) return invalid(databaseMessage);
    throw error;
  }
  revalidatePath("/");
  return { message: "Nursery batch recorded.", success: true };
}

export async function createNurseryCheckAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const context = await signedInFarm();
  if (!context) return invalid("Your session expired. Sign in again.");
  const parsed = z.object({
    batchId: z.string().min(1),
    offlineId: optionalText,
    germinated: optionalNumber,
    surviving: optionalNumber,
    condition: optionalText,
    notes: optionalText,
  }).safeParse({
    batchId: value(formData, "batchId"),
    offlineId: value(formData, "offlineId"),
    germinated: value(formData, "germinated"),
    surviving: value(formData, "surviving"),
    condition: value(formData, "condition"),
    notes: value(formData, "notes"),
  });
  if (
    !parsed.success ||
    (parsed.data.germinated !== undefined && !Number.isInteger(parsed.data.germinated)) ||
    (parsed.data.surviving !== undefined && !Number.isInteger(parsed.data.surviving)) ||
    (parsed.data.germinated !== undefined &&
      parsed.data.surviving !== undefined &&
      parsed.data.surviving > parsed.data.germinated)
  ) {
    return invalid("Enter whole-number counts; surviving seedlings cannot exceed germinated seeds.");
  }
  const batch = await tenantDb(context.farm.id, context.user.id).nurseryBatch.findFirst({
    where: { id: parsed.data.batchId, farmId: context.farm.id },
    select: { id: true },
  });
  if (!batch) return invalid("Choose a nursery batch from this farm.");
  if (parsed.data.offlineId && await tenantDb(context.farm.id, context.user.id).nurseryCheck.findFirst({
    where: { farmId: context.farm.id, offlineId: parsed.data.offlineId }, select: { id: true },
  })) return { message: "Nursery check already synced.", success: true };

  try {
    await tenantDb(context.farm.id, context.user.id).nurseryCheck.create({
      data: {
        farmId: context.farm.id,
        batchId: batch.id,
        offlineId: parsed.data.offlineId ?? null,
        germinated: parsed.data.germinated,
        surviving: parsed.data.surviving,
        condition: parsed.data.condition,
        notes: parsed.data.notes,
      },
    });
  } catch (error) {
    const databaseMessage = message(error);
    if (databaseMessage) return invalid(databaseMessage);
    throw error;
  }
  revalidatePath("/");
  return { message: "Nursery check recorded.", success: true };
}

export async function createTransplantAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const context = await signedInFarm();
  if (!context) return invalid("Your session expired. Sign in again.");
  const parsed = z.object({
    batchId: z.string().min(1),
    quantityMoved: z.coerce.number().int().nonnegative(),
    quantityDiscarded: z.coerce.number().int().nonnegative(),
    reason: optionalText,
    movedAt: z.string().optional(),
  }).safeParse({
    batchId: value(formData, "batchId"),
    quantityMoved: value(formData, "quantityMoved"),
    quantityDiscarded: value(formData, "quantityDiscarded") || "0",
    reason: value(formData, "reason"),
    movedAt: value(formData, "movedAt"),
  });
  if (!parsed.success || parsed.data.quantityMoved + parsed.data.quantityDiscarded === 0) {
    return invalid("Enter valid transplanted and discarded quantities.");
  }
  if (dateError(parsed.data.movedAt ?? "")) return invalid("Enter a valid transplant date.");
  const batch = await tenantDb(context.farm.id, context.user.id).nurseryBatch.findFirst({
    where: { id: parsed.data.batchId, farmId: context.farm.id },
    select: { id: true },
  });
  if (!batch) return invalid("Choose a nursery batch from this farm.");

  try {
    await tenantDb(context.farm.id, context.user.id).transplant.create({
      data: {
        farmId: context.farm.id,
        batchId: batch.id,
        quantityMoved: parsed.data.quantityMoved,
        quantityDiscarded: parsed.data.quantityDiscarded,
        reason: parsed.data.reason,
        movedAt: optionalDate(parsed.data.movedAt ?? "") ?? new Date(),
      },
    });
  } catch (error) {
    const databaseMessage = message(error);
    if (databaseMessage) return invalid(databaseMessage);
    throw error;
  }
  revalidatePath("/");
  return { message: "Transplant recorded.", success: true };
}

export async function createTaskAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const context = await signedInFarm();
  if (!context) return invalid("Your session expired. Sign in again.");
  const dueAt = value(formData, "dueAt");
  const parsed = z.object({
    cycleId: z.string().min(1),
    title: z.string().trim().min(2).max(120),
    dueAt: z.string().min(1),
    notes: optionalText,
  }).safeParse({
    cycleId: value(formData, "cycleId"),
    title: value(formData, "title"),
    dueAt,
    notes: value(formData, "notes"),
  });
  if (!parsed.success || dateError(parsed.data.dueAt)) return invalid("Choose a crop cycle and valid task date.");
  const cycle = await tenantDb(context.farm.id, context.user.id).cropCycle.findFirst({
    where: { id: parsed.data.cycleId, farmId: context.farm.id },
    select: { id: true, plotId: true },
  });
  if (!cycle) return invalid("Choose a crop cycle from this farm.");

  try {
    await tenantDb(context.farm.id, context.user.id).task.create({
      data: {
        farmId: context.farm.id,
        cycleId: cycle.id,
        plotId: cycle.plotId,
        taskType: "manual",
        titleEn: parsed.data.title,
        titleSw: parsed.data.title,
        dueAt: optionalDate(parsed.data.dueAt)!,
        notes: parsed.data.notes,
      },
    });
  } catch (error) {
    const databaseMessage = message(error);
    if (databaseMessage) return invalid(databaseMessage);
    throw error;
  }
  revalidatePath("/");
  return { message: "Task added.", success: true };
}

async function farmPlotAndCycle(
  farmId: string,
  actorUserId: string,
  plotId: string,
  cycleId?: string,
) {
  const tenant = tenantDb(farmId, actorUserId);
  const plot = await tenant.plot.findFirst({
    where: { id: plotId, farmId, archivedAt: null },
    select: { id: true },
  });
  if (!plot) return false;
  if (!cycleId) return true;
  const cycle = await tenant.cropCycle.findFirst({
    where: { id: cycleId, plotId, farmId, archivedAt: null },
    select: { id: true },
  });
  return Boolean(cycle);
}

export async function recordWeatherAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const context = await signedInFarm();
  if (!context) return invalid("Your session expired. Sign in again.");
  const observedAt = value(formData, "observedAt");
  const parsed = z.object({
    plotId: z.string().min(1),
    cycleId: optionalText,
    offlineId: optionalText,
    rainfallMm: optionalNumber,
    temperatureC: optionalNumber,
    notes: optionalText,
  }).safeParse({
    plotId: value(formData, "plotId"),
    cycleId: value(formData, "cycleId") || undefined,
    offlineId: value(formData, "offlineId"),
    rainfallMm: value(formData, "rainfallMm"),
    temperatureC: value(formData, "temperatureC"),
    notes: value(formData, "notes"),
  });
  if (!parsed.success || dateError(observedAt) ||
      (parsed.data.rainfallMm !== undefined && parsed.data.rainfallMm < 0) ||
      (parsed.data.temperatureC !== undefined &&
        (parsed.data.temperatureC < -80 || parsed.data.temperatureC > 80))) {
    return invalid("Enter a valid plot, date, rainfall and temperature.");
  }
  if (!await farmPlotAndCycle(context.farm.id, context.user.id, parsed.data.plotId, parsed.data.cycleId)) {
    return invalid("Choose a plot and crop cycle from this farm.");
  }
  if (parsed.data.offlineId && await tenantDb(context.farm.id, context.user.id).weatherLog.findFirst({
    where: { farmId: context.farm.id, offlineId: parsed.data.offlineId }, select: { id: true },
  })) return { message: "Weather observation already synced.", success: true };
  try {
    await tenantDb(context.farm.id, context.user.id).weatherLog.create({
      data: {
        farmId: context.farm.id,
        plotId: parsed.data.plotId,
        cycleId: parsed.data.cycleId || null,
        offlineId: parsed.data.offlineId ?? null,
        observedAt: optionalDate(observedAt) ?? new Date(),
        rainfallMm: parsed.data.rainfallMm,
        temperatureC: parsed.data.temperatureC,
        notes: parsed.data.notes,
      },
    });
  } catch (error) {
    const databaseMessage = message(error);
    if (databaseMessage) return invalid(databaseMessage);
    throw error;
  }
  revalidatePath("/");
  return { message: "Weather observation recorded.", success: true };
}

export async function recordScoutingAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const context = await signedInFarm();
  if (!context) return invalid("Your session expired. Sign in again.");
  const observedAt = value(formData, "observedAt");
  const parsed = z.object({
    plotId: z.string().min(1),
    cycleId: optionalText,
    offlineId: optionalText,
    issue: z.string().trim().min(2).max(120),
    severity: z.nativeEnum(ScoutingSeverity),
    notes: optionalText,
  }).safeParse({
    plotId: value(formData, "plotId"),
    cycleId: value(formData, "cycleId") || undefined,
    offlineId: value(formData, "offlineId"),
    issue: value(formData, "issue"),
    severity: value(formData, "severity"),
    notes: value(formData, "notes"),
  });
  if (!parsed.success || dateError(observedAt)) return invalid("Enter a pest or disease, severity and valid date.");
  if (!await farmPlotAndCycle(context.farm.id, context.user.id, parsed.data.plotId, parsed.data.cycleId)) {
    return invalid("Choose a plot and crop cycle from this farm.");
  }
  if (parsed.data.offlineId && await tenantDb(context.farm.id, context.user.id).scoutingLog.findFirst({
    where: { farmId: context.farm.id, offlineId: parsed.data.offlineId }, select: { id: true },
  })) return { message: "Scouting observation already synced.", success: true };
  try {
    await tenantDb(context.farm.id, context.user.id).scoutingLog.create({
      data: {
        farmId: context.farm.id,
        plotId: parsed.data.plotId,
        cycleId: parsed.data.cycleId || null,
        offlineId: parsed.data.offlineId ?? null,
        observedAt: optionalDate(observedAt) ?? new Date(),
        issue: parsed.data.issue,
        severity: parsed.data.severity,
        notes: parsed.data.notes,
      },
    });
  } catch (error) {
    const databaseMessage = message(error);
    if (databaseMessage) return invalid(databaseMessage);
    throw error;
  }
  revalidatePath("/");
  return { message: "Scouting observation recorded.", success: true };
}

export async function recordSprayAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const context = await signedInFarm();
  if (!context) return invalid("Your session expired. Sign in again.");
  const appliedAt = value(formData, "appliedAt");
  const parsed = z.object({
    plotId: z.string().min(1),
    cycleId: optionalText,
    offlineId: optionalText,
    product: z.string().trim().min(2).max(120),
    activeIngredient: optionalText,
    batch: optionalText,
    dose: optionalText,
    preHarvestIntervalDays: optionalNumber,
    notes: optionalText,
  }).safeParse({
    plotId: value(formData, "plotId"),
    cycleId: value(formData, "cycleId") || undefined,
    offlineId: value(formData, "offlineId"),
    product: value(formData, "product"),
    activeIngredient: value(formData, "activeIngredient"),
    batch: value(formData, "batch"),
    dose: value(formData, "dose"),
    preHarvestIntervalDays: value(formData, "preHarvestIntervalDays"),
    notes: value(formData, "notes"),
  });
  if (!parsed.success || dateError(appliedAt) ||
      (parsed.data.preHarvestIntervalDays !== undefined &&
        (!Number.isInteger(parsed.data.preHarvestIntervalDays) ||
          parsed.data.preHarvestIntervalDays < 0 ||
          parsed.data.preHarvestIntervalDays > 365))) {
    return invalid("Enter a product, valid application date and pre-harvest interval (0–365 days).");
  }
  if (!await farmPlotAndCycle(context.farm.id, context.user.id, parsed.data.plotId, parsed.data.cycleId)) {
    return invalid("Choose a plot and crop cycle from this farm.");
  }
  if (parsed.data.offlineId && await tenantDb(context.farm.id, context.user.id).sprayRecord.findFirst({
    where: { farmId: context.farm.id, offlineId: parsed.data.offlineId }, select: { id: true },
  })) return { message: "Spray record already synced.", success: true };
  try {
    await tenantDb(context.farm.id, context.user.id).sprayRecord.create({
      data: {
        farmId: context.farm.id,
        plotId: parsed.data.plotId,
        cycleId: parsed.data.cycleId || null,
        offlineId: parsed.data.offlineId ?? null,
        product: parsed.data.product,
        activeIngredient: parsed.data.activeIngredient,
        batch: parsed.data.batch,
        dose: parsed.data.dose,
        appliedAt: optionalDate(appliedAt) ?? new Date(),
        preHarvestIntervalDays: parsed.data.preHarvestIntervalDays,
        notes: parsed.data.notes,
      },
    });
  } catch (error) {
    const databaseMessage = message(error);
    if (databaseMessage) return invalid(databaseMessage);
    throw error;
  }
  revalidatePath("/");
  return { message: "Spray record saved. Check harvest dates against the pre-harvest interval.", success: true };
}

export async function recordSubsidyReceiptAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const context = await signedInFarm();
  if (!context) return invalid("Your session expired. Sign in again.");
  if (context.role !== FarmRole.OWNER) return invalid("Only a farm owner can record subsidised inputs.");
  const receivedAt = value(formData, "receivedAt");
  const parsed = z.object({
    input: z.string().trim().min(2).max(120),
    quantity: positiveNumber,
    unit: z.string().trim().min(1).max(20),
    price: optionalNumber,
    source: optionalText,
    notes: optionalText,
  }).safeParse({
    input: value(formData, "input"),
    quantity: value(formData, "quantity"),
    unit: value(formData, "unit"),
    price: value(formData, "price"),
    source: value(formData, "source"),
    notes: value(formData, "notes"),
  });
  if (!parsed.success || dateError(receivedAt) ||
      (parsed.data.price !== undefined && parsed.data.price < 0)) {
    return invalid("Enter an input, quantity and valid receipt details.");
  }
  try {
    await tenantDb(context.farm.id, context.user.id).subsidyReceipt.create({
      data: {
        farmId: context.farm.id,
        input: parsed.data.input,
        quantity: parsed.data.quantity,
        unit: parsed.data.unit,
        price: parsed.data.price,
        currency: context.farm.currency,
        receivedAt: optionalDate(receivedAt) ?? new Date(),
        source: parsed.data.source,
        notes: parsed.data.notes,
      },
    });
  } catch (error) {
    const databaseMessage = message(error);
    if (databaseMessage) return invalid(databaseMessage);
    throw error;
  }
  revalidatePath("/");
  return { message: "Subsidised input receipt recorded.", success: true };
}

export async function updateTaskStatusAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const context = await signedInFarm();
  if (!context) return invalid("Your session expired. Sign in again.");
  const parsed = z.object({
    taskId: z.string().min(1),
    status: z.nativeEnum(TaskStatus),
  }).safeParse({
    taskId: value(formData, "taskId"),
    status: value(formData, "status"),
  });
  if (!parsed.success) return invalid("Choose a valid task status.");

  const updated = await tenantDb(context.farm.id, context.user.id).task.updateMany({
    where: { id: parsed.data.taskId, farmId: context.farm.id },
    data: {
      status: parsed.data.status,
      doneAt: parsed.data.status === "DONE" ? new Date() : null,
    },
  });
  if (updated.count === 0) return invalid("Task not found in this farm.");
  revalidatePath("/");
  return { message: "Task status updated.", success: true };
}

export async function createActivityLogAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const context = await signedInFarm();
  if (!context) return invalid("Your session expired. Sign in again.");
  const loggedAt = value(formData, "loggedAt");
  const parsed = z.object({
    cycleId: optionalText,
    offlineId: optionalText,
    body: z.string().trim().min(1).max(4000),
    weather: optionalText,
    whoWorked: optionalText,
    loggedAt: z.string().optional(),
  }).safeParse({
    cycleId: value(formData, "cycleId") || undefined,
    offlineId: value(formData, "offlineId"),
    body: value(formData, "body"),
    weather: value(formData, "weather"),
    whoWorked: value(formData, "whoWorked"),
    loggedAt,
  });
  if (!parsed.success || dateError(parsed.data.loggedAt ?? "")) return invalid("Write a daily note and check the date.");
  if (parsed.data.offlineId && await tenantDb(context.farm.id, context.user.id).activityLog.findFirst({
    where: { farmId: context.farm.id, offlineId: parsed.data.offlineId }, select: { id: true },
  })) return { message: "Daily activity already synced.", success: true };
  if (parsed.data.cycleId) {
    const cycle = await tenantDb(context.farm.id, context.user.id).cropCycle.findFirst({
      where: { id: parsed.data.cycleId, farmId: context.farm.id },
      select: { id: true },
    });
    if (!cycle) return invalid("Choose a crop cycle from this farm.");
  }

  try {
    await tenantDb(context.farm.id, context.user.id).activityLog.create({
      data: {
        farmId: context.farm.id,
        cycleId: parsed.data.cycleId || null,
        userId: context.user.id,
        body: parsed.data.body,
        weather: parsed.data.weather,
        whoWorked: parsed.data.whoWorked,
        loggedAt: optionalDate(parsed.data.loggedAt ?? "") ?? new Date(),
        offlineId: parsed.data.offlineId ?? null,
      },
    });
  } catch (error) {
    const databaseMessage = message(error);
    if (databaseMessage) return invalid(databaseMessage);
    throw error;
  }
  revalidatePath("/");
  return { message: "Daily activity saved.", success: true };
}

export async function createWorkerAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const context = await signedInFarm();
  if (!context) return invalid("Your session expired. Sign in again.");
  if (context.role !== FarmRole.OWNER) return invalid("Only a farm owner can manage worker settings.");
  const parsed = z.object({
    name: z.string().trim().min(2).max(100),
    hourlyRate: optionalNumber,
  }).safeParse({
    name: value(formData, "name"),
    hourlyRate: value(formData, "hourlyRate"),
  });
  if (!parsed.success || (parsed.data.hourlyRate !== undefined && parsed.data.hourlyRate < 0)) {
    return invalid("Enter a worker name and a valid hourly rate.");
  }

  try {
    await tenantDb(context.farm.id, context.user.id).worker.create({
      data: {
        farmId: context.farm.id,
        name: parsed.data.name,
        hourlyRate: parsed.data.hourlyRate,
        currency: context.farm.currency,
      },
    });
  } catch (error) {
    const databaseMessage = message(error);
    if (databaseMessage) return invalid(databaseMessage);
    throw error;
  }
  revalidatePath("/");
  return { message: "Worker added.", success: true };
}

export async function createWorkEntryAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const context = await signedInFarm();
  if (!context) return invalid("Your session expired. Sign in again.");
  const startedAt = value(formData, "startedAt");
  const endedAt = value(formData, "endedAt");
  const parsed = z.object({
    workerId: z.string().min(1),
    cycleId: optionalText,
    offlineId: optionalText,
    taskLabel: z.string().trim().min(1).max(120),
    startedAt: z.string().min(1),
    endedAt: z.string().min(1),
    hourlyRate: optionalNumber,
    paid: z.enum(["yes", "no"]),
    paymentMethod: z.preprocess(
      (input) => (input === "" || input === undefined ? undefined : input),
      z.nativeEnum(PaymentMethod).optional(),
    ),
    paymentReference: optionalText,
  }).safeParse({
    workerId: value(formData, "workerId"),
    cycleId: value(formData, "cycleId") || undefined,
    offlineId: value(formData, "offlineId"),
    taskLabel: value(formData, "taskLabel"),
    startedAt,
    endedAt,
    hourlyRate: value(formData, "hourlyRate"),
    paid: value(formData, "paid"),
    paymentMethod: value(formData, "paymentMethod"),
    paymentReference: value(formData, "paymentReference"),
  });
  if (
    !parsed.success ||
    dateError(parsed.data.startedAt) ||
    dateError(parsed.data.endedAt) ||
    optionalDate(parsed.data.endedAt)!.getTime() <= optionalDate(parsed.data.startedAt)!.getTime()
  ) {
    return invalid("Enter valid work times; the end time must be after the start.");
  }
  if (parsed.data.offlineId && await tenantDb(context.farm.id, context.user.id).workEntry.findFirst({
    where: { farmId: context.farm.id, offlineId: parsed.data.offlineId }, select: { id: true },
  })) return { message: "Work entry already synced.", success: true };
  const [worker, cycle] = await Promise.all([
    tenantDb(context.farm.id, context.user.id).worker.findFirst({
      where: { id: parsed.data.workerId, farmId: context.farm.id, active: true },
      select: { id: true, hourlyRate: true },
    }),
    parsed.data.cycleId
      ? tenantDb(context.farm.id, context.user.id).cropCycle.findFirst({
          where: { id: parsed.data.cycleId, farmId: context.farm.id },
          select: { id: true },
        })
      : Promise.resolve(null),
  ]);
  if (!worker) return invalid("Choose a worker from this farm.");
  if (parsed.data.cycleId && !cycle) return invalid("Choose a crop cycle from this farm.");
  if (context.role !== FarmRole.OWNER && parsed.data.paid === "yes") {
    return invalid("Only the farm owner can mark a worker payment as paid.");
  }
  if (parsed.data.paid === "yes" && !parsed.data.paymentMethod) {
    return invalid("Choose how the worker was paid.");
  }
  if (context.role !== FarmRole.OWNER && parsed.data.hourlyRate !== undefined) {
    return invalid("Farm managers record hours; only the owner sets wage rates.");
  }
  const hourlyRate = parsed.data.hourlyRate ?? worker.hourlyRate?.toNumber();
  if (hourlyRate === undefined || hourlyRate <= 0) {
    return invalid("Ask the farm owner to set this worker's hourly rate before recording work.");
  }

  const hours =
    (optionalDate(parsed.data.endedAt)!.getTime() -
      optionalDate(parsed.data.startedAt)!.getTime()) /
    3_600_000;
  const amount = new Prisma.Decimal(hours).mul(hourlyRate).toDecimalPlaces(2);
  try {
    await tenantDb(context.farm.id, context.user.id).workEntry.create({
      data: {
        farmId: context.farm.id,
        workerId: worker.id,
        cycleId: cycle?.id ?? null,
        userId: context.user.id,
        taskLabel: parsed.data.taskLabel,
        startedAt: optionalDate(parsed.data.startedAt)!,
        endedAt: optionalDate(parsed.data.endedAt)!,
        hourlyRate,
        amount,
        currency: context.farm.currency,
        paid: parsed.data.paid === "yes",
        paymentMethod: parsed.data.paid === "yes" ? parsed.data.paymentMethod : null,
        paymentReference: parsed.data.paid === "yes" ? parsed.data.paymentReference : null,
        offlineId: parsed.data.offlineId ?? null,
      },
    });
  } catch (error) {
    const databaseMessage = message(error);
    if (databaseMessage) return invalid(databaseMessage);
    throw error;
  }
  revalidatePath("/");
  return { message: `${hours.toFixed(2)} hours recorded; labour cost ${amount.toFixed(2)} ${context.farm.currency}.`, success: true };
}

export async function createExpenseAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const context = await signedInFarm();
  if (!context) return invalid("Your session expired. Sign in again.");
  if (context.role !== FarmRole.OWNER) return invalid("Only a farm owner can enter financial expenses.");
  const spentAt = value(formData, "spentAt");
  const parsed = z.object({
    cycleId: optionalText,
    category: z.nativeEnum(ExpenseCategory),
    amount: positiveNumber,
    offlineId: optionalText,
    allocations: z.string().max(5000).optional(),
    animalTarget: optionalText,
    spentAt: z.string().optional(),
    notes: optionalText,
  }).safeParse({
    cycleId: value(formData, "cycleId") || undefined,
    category: value(formData, "category"),
    amount: value(formData, "amount"),
    offlineId: value(formData, "offlineId"),
    allocations: value(formData, "allocations"),
    animalTarget: value(formData, "animalTarget"),
    spentAt,
    notes: value(formData, "notes"),
  });
  if (!parsed.success || dateError(parsed.data.spentAt ?? "")) return invalid("Enter a valid expense and date.");
  if (parsed.data.offlineId && await tenantDb(context.farm.id, context.user.id).expense.findFirst({
    where: { farmId: context.farm.id, offlineId: parsed.data.offlineId }, select: { id: true },
  })) return { message: "Expense already synced.", success: true };
  let allocationText = parsed.data.allocations?.trim() ?? "";
  if (parsed.data.animalTarget) {
    if (allocationText || parsed.data.cycleId) {
      return invalid("Choose either one direct target or a split allocation, not both.");
    }
    if (!/^(animal|group):[^|]+$/.test(parsed.data.animalTarget)) {
      return invalid("Choose an animal or group allocation target.");
    }
    allocationText = `${parsed.data.animalTarget} | ${parsed.data.amount}`;
  }
  let allocations: Array<{
    cycleId?: string;
    plotId?: string;
    animalId?: string;
    animalGroupId?: string;
    amount: number;
  }> = [];
  if (allocationText) {
    const allocationResult = parseExpenseAllocations(allocationText, parsed.data.amount);
    if (!allocationResult.allocations) return invalid(allocationResult.error);
    allocations = allocationResult.allocations;
    const cycleIds = allocations.flatMap((allocation) => allocation.cycleId ? [allocation.cycleId] : []);
    const plotIds = allocations.flatMap((allocation) => allocation.plotId ? [allocation.plotId] : []);
    const animalIds = allocations.flatMap((allocation) => allocation.animalId ? [allocation.animalId] : []);
    const animalGroupIds = allocations.flatMap((allocation) => allocation.animalGroupId ? [allocation.animalGroupId] : []);
    const [validCycles, validPlots, validAnimals, validAnimalGroups] = await Promise.all([
      cycleIds.length ? tenantDb(context.farm.id, context.user.id).cropCycle.count({
        where: { farmId: context.farm.id, id: { in: cycleIds } },
      }) : 0,
      plotIds.length ? tenantDb(context.farm.id, context.user.id).plot.count({
        where: { farmId: context.farm.id, id: { in: plotIds } },
      }) : 0,
      animalIds.length ? tenantDb(context.farm.id, context.user.id).animal.count({
        where: { farmId: context.farm.id, id: { in: animalIds }, archivedAt: null },
      }) : 0,
      animalGroupIds.length ? tenantDb(context.farm.id, context.user.id).animalGroup.count({
        where: { farmId: context.farm.id, id: { in: animalGroupIds }, archivedAt: null },
      }) : 0,
    ]);
    if (
      validCycles !== new Set(cycleIds).size ||
      validPlots !== new Set(plotIds).size ||
      validAnimals !== new Set(animalIds).size ||
      validAnimalGroups !== new Set(animalGroupIds).size
    ) {
      return invalid("Every allocation target must belong to this farm.");
    }
  } else if (parsed.data.cycleId) {
    const cycle = await tenantDb(context.farm.id, context.user.id).cropCycle.findFirst({
      where: { id: parsed.data.cycleId, farmId: context.farm.id },
      select: { id: true },
    });
    if (!cycle) return invalid("Choose a crop cycle from this farm.");
  }

  try {
    await tenantDb(context.farm.id, context.user.id).expense.create({
      data: {
        farmId: context.farm.id,
        cycleId: allocationText ? null : parsed.data.cycleId || null,
        category: parsed.data.category,
        amount: parsed.data.amount,
        currency: context.farm.currency,
        spentAt: optionalDate(parsed.data.spentAt ?? "") ?? new Date(),
        notes: parsed.data.notes,
        offlineId: parsed.data.offlineId ?? null,
        ...(allocationText ? {
          allocations: {
            create: allocations.map((allocation) => ({
              farmId: context.farm.id,
              cycleId: allocation.cycleId ?? null,
              plotId: allocation.plotId ?? null,
              animalId: allocation.animalId ?? null,
              animalGroupId: allocation.animalGroupId ?? null,
              amount: allocation.amount,
              currency: context.farm.currency,
            })),
          },
        } : {}),
      },
    });
  } catch (error) {
    const databaseMessage = message(error);
    if (databaseMessage) return invalid(databaseMessage);
    throw error;
  }
  revalidatePath("/");
  return { message: "Expense recorded.", success: true };
}

export async function createMachineJobAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const context = await signedInFarm();
  if (!context) return invalid("Your session expired. Sign in again.");
  if (context.role !== FarmRole.OWNER) return invalid("Only a farm owner can record machinery costs.");
  const parsed = z.object({
    cycleId: optionalText,
    plotId: optionalText,
    description: z.string().trim().min(1).max(200),
    hours: positiveNumber,
    fuelCost: z.coerce.number().finite().min(0),
    hireCost: z.coerce.number().finite().min(0),
    maintenanceCost: z.coerce.number().finite().min(0),
    performedAt: z.string().optional(),
  }).safeParse({
    cycleId: value(formData, "cycleId"),
    plotId: value(formData, "plotId"),
    description: value(formData, "description"),
    hours: value(formData, "hours"),
    fuelCost: value(formData, "fuelCost") || "0",
    hireCost: value(formData, "hireCost") || "0",
    maintenanceCost: value(formData, "maintenanceCost") || "0",
    performedAt: value(formData, "performedAt"),
  });
  if (!parsed.success || dateError(parsed.data.performedAt ?? "")) {
    return invalid("Enter a valid machinery job, hours and date.");
  }
  const [cycle, plot] = await Promise.all([
    parsed.data.cycleId ? tenantDb(context.farm.id, context.user.id).cropCycle.findFirst({
      where: { id: parsed.data.cycleId, farmId: context.farm.id },
      select: { id: true, plotId: true },
    }) : null,
    parsed.data.plotId ? tenantDb(context.farm.id, context.user.id).plot.findFirst({
      where: { id: parsed.data.plotId, farmId: context.farm.id },
      select: { id: true },
    }) : null,
  ]);
  if ((parsed.data.cycleId && !cycle) || (parsed.data.plotId && !plot)) {
    return invalid("Choose a crop cycle and plot from this farm.");
  }
  if (cycle && plot && cycle.plotId !== plot.id) {
    return invalid("The selected plot must match the crop cycle's plot.");
  }
  try {
    await tenantDb(context.farm.id, context.user.id).machineJob.create({
      data: {
        farmId: context.farm.id,
        cycleId: cycle?.id ?? null,
        plotId: plot?.id ?? cycle?.plotId ?? null,
        description: parsed.data.description,
        hours: parsed.data.hours,
        fuelCost: parsed.data.fuelCost,
        hireCost: parsed.data.hireCost,
        maintenanceCost: parsed.data.maintenanceCost,
        currency: context.farm.currency,
        performedAt: optionalDate(parsed.data.performedAt ?? "") ?? new Date(),
      },
    });
  } catch (error) {
    const databaseMessage = message(error);
    if (databaseMessage) return invalid(databaseMessage);
    throw error;
  }
  revalidatePath("/");
  return { message: "Machinery job recorded.", success: true };
}

export async function createAssetAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const context = await signedInFarm();
  if (!context) return invalid("Your session expired. Sign in again.");
  if (context.role !== FarmRole.OWNER) return invalid("Only a farm owner can manage assets.");
  const parsed = z.object({
    name: z.string().trim().min(2).max(100),
    type: z.string().trim().min(2).max(80),
    purchasedAt: z.string().optional(),
    purchaseCost: optionalNumber,
    expectedLifeMonths: optionalNumber,
    status: z.nativeEnum(AssetStatus),
    notes: optionalText,
  }).safeParse({
    name: value(formData, "name"),
    type: value(formData, "type"),
    purchasedAt: value(formData, "purchasedAt"),
    purchaseCost: value(formData, "purchaseCost"),
    expectedLifeMonths: value(formData, "expectedLifeMonths"),
    status: value(formData, "status") || AssetStatus.ACTIVE,
    notes: value(formData, "notes"),
  });
  if (
    !parsed.success ||
    dateError(parsed.data.purchasedAt ?? "") ||
    (parsed.data.purchaseCost !== undefined && parsed.data.purchaseCost < 0) ||
    (parsed.data.expectedLifeMonths !== undefined &&
      (!Number.isInteger(parsed.data.expectedLifeMonths) || parsed.data.expectedLifeMonths <= 0))
  ) {
    return invalid("Enter an asset name and type, with valid optional purchase details.");
  }
  try {
    await tenantDb(context.farm.id, context.user.id).asset.create({
      data: {
        farmId: context.farm.id,
        name: parsed.data.name,
        type: parsed.data.type,
        purchasedAt: optionalDate(parsed.data.purchasedAt ?? ""),
        purchaseCost: parsed.data.purchaseCost === undefined
          ? null
          : new Prisma.Decimal(parsed.data.purchaseCost),
        currency: context.farm.currency,
        expectedLifeMonths: parsed.data.expectedLifeMonths,
        status: parsed.data.status,
        notes: parsed.data.notes,
      },
    });
  } catch (error) {
    const databaseMessage = message(error);
    if (databaseMessage) return invalid(databaseMessage);
    throw error;
  }
  revalidatePath("/");
  return { message: "Asset added.", success: true };
}

export async function archiveAssetAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const context = await signedInFarm();
  if (!context) return invalid("Your session expired. Sign in again.");
  if (context.role !== FarmRole.OWNER) return invalid("Only a farm owner can archive assets.");
  const assetId = value(formData, "assetId");
  if (!assetId) return invalid("Choose an asset to archive.");

  const result = await tenantDb(context.farm.id, context.user.id).asset.updateMany({
    where: { id: assetId, farmId: context.farm.id, archivedAt: null },
    data: { archivedAt: new Date() },
  });
  if (result.count !== 1) return invalid("That active asset was not found in this farm.");
  revalidatePath("/");
  return { message: "Asset archived.", success: true };
}

export async function recordAssetUsageAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const context = await signedInFarm();
  if (!context) return invalid("Your session expired. Sign in again.");
  const parsed = z.object({
    assetId: z.string().min(1),
    cycleId: optionalText,
    plotId: optionalText,
    usedAt: z.string().optional(),
    hours: optionalNumber,
    distance: optionalNumber,
    distanceUnit: optionalText,
    operator: optionalText,
    fuelCost: z.coerce.number().finite().min(0),
    notes: optionalText,
  }).safeParse({
    assetId: value(formData, "assetId"),
    cycleId: value(formData, "cycleId"),
    plotId: value(formData, "plotId"),
    usedAt: value(formData, "usedAt"),
    hours: value(formData, "hours"),
    distance: value(formData, "distance"),
    distanceUnit: value(formData, "distanceUnit"),
    operator: value(formData, "operator"),
    fuelCost: value(formData, "fuelCost") || "0",
    notes: value(formData, "notes"),
  });
  if (
    !parsed.success ||
    dateError(parsed.data.usedAt ?? "") ||
    (parsed.data.hours !== undefined && parsed.data.hours <= 0) ||
    (parsed.data.distance !== undefined && parsed.data.distance <= 0) ||
    (parsed.data.hours === undefined && parsed.data.distance === undefined) ||
    (parsed.data.distance !== undefined && !parsed.data.distanceUnit) ||
    (parsed.data.distance === undefined && parsed.data.distanceUnit)
  ) {
    return invalid("Enter a valid usage date and either positive hours or distance with its unit.");
  }
  if (context.role !== FarmRole.OWNER && parsed.data.fuelCost > 0) {
    return invalid("Only the farm owner can record asset fuel costs.");
  }
  const [asset, cycle, plot] = await Promise.all([
    tenantDb(context.farm.id, context.user.id).asset.findFirst({
      where: { id: parsed.data.assetId, farmId: context.farm.id, archivedAt: null, status: AssetStatus.ACTIVE },
      select: { id: true },
    }),
    parsed.data.cycleId
      ? tenantDb(context.farm.id, context.user.id).cropCycle.findFirst({
          where: { id: parsed.data.cycleId, farmId: context.farm.id },
          select: { id: true, plotId: true },
        })
      : Promise.resolve(null),
    parsed.data.plotId
      ? tenantDb(context.farm.id, context.user.id).plot.findFirst({
          where: { id: parsed.data.plotId, farmId: context.farm.id },
          select: { id: true },
        })
      : Promise.resolve(null),
  ]);
  if (!asset) return invalid("Choose an active asset from this farm.");
  if (parsed.data.cycleId && !cycle) return invalid("Choose a crop cycle from this farm.");
  if (parsed.data.plotId && !plot) return invalid("Choose a plot from this farm.");
  if (cycle && plot && cycle.plotId !== plot.id) {
    return invalid("The selected plot must match the crop cycle's plot.");
  }

  try {
    await tenantDb(context.farm.id, context.user.id).assetUsage.create({
      data: {
        farmId: context.farm.id,
        assetId: asset.id,
        cycleId: cycle?.id ?? null,
        plotId: plot?.id ?? cycle?.plotId ?? null,
        usedAt: optionalDate(parsed.data.usedAt ?? "") ?? new Date(),
        hours: parsed.data.hours === undefined ? null : new Prisma.Decimal(parsed.data.hours),
        distance: parsed.data.distance === undefined ? null : new Prisma.Decimal(parsed.data.distance),
        distanceUnit: parsed.data.distanceUnit ?? null,
        operator: parsed.data.operator ?? null,
        fuelCost: new Prisma.Decimal(context.role === FarmRole.OWNER ? parsed.data.fuelCost : 0),
        currency: context.farm.currency,
        notes: parsed.data.notes ?? null,
      },
    });
  } catch (error) {
    const databaseMessage = message(error);
    if (databaseMessage) return invalid(databaseMessage);
    throw error;
  }
  revalidatePath("/");
  return { message: "Asset usage recorded.", success: true };
}

export async function createAssetMaintenanceAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const context = await signedInFarm();
  if (!context) return invalid("Your session expired. Sign in again.");
  if (context.role !== FarmRole.OWNER) return invalid("Only a farm owner can record asset maintenance.");
  const parsed = z.object({
    assetId: z.string().min(1),
    cycleId: optionalText,
    performedAt: z.string().optional(),
    description: z.string().trim().min(2).max(200),
    cost: z.coerce.number().finite().min(0),
    nextServiceAt: z.string().optional(),
    notes: optionalText,
  }).safeParse({
    assetId: value(formData, "assetId"),
    cycleId: value(formData, "cycleId"),
    performedAt: value(formData, "performedAt"),
    description: value(formData, "description"),
    cost: value(formData, "cost") || "0",
    nextServiceAt: value(formData, "nextServiceAt"),
    notes: value(formData, "notes"),
  });
  if (
    !parsed.success ||
    dateError(parsed.data.performedAt ?? "") ||
    dateError(parsed.data.nextServiceAt ?? "")
  ) {
    return invalid("Enter a maintenance description and valid dates.");
  }
  const [asset, cycle] = await Promise.all([
    tenantDb(context.farm.id, context.user.id).asset.findFirst({
      where: { id: parsed.data.assetId, farmId: context.farm.id, archivedAt: null },
      select: { id: true },
    }),
    parsed.data.cycleId
      ? tenantDb(context.farm.id, context.user.id).cropCycle.findFirst({
          where: { id: parsed.data.cycleId, farmId: context.farm.id },
          select: { id: true },
        })
      : Promise.resolve(null),
  ]);
  if (!asset) return invalid("Choose an active asset from this farm.");
  if (parsed.data.cycleId && !cycle) return invalid("Choose a crop cycle from this farm.");

  try {
    await tenantDb(context.farm.id, context.user.id).assetMaintenance.create({
      data: {
        farmId: context.farm.id,
        assetId: asset.id,
        cycleId: cycle?.id ?? null,
        performedAt: optionalDate(parsed.data.performedAt ?? "") ?? new Date(),
        description: parsed.data.description,
        cost: new Prisma.Decimal(parsed.data.cost),
        currency: context.farm.currency,
        nextServiceAt: optionalDate(parsed.data.nextServiceAt ?? ""),
        notes: parsed.data.notes ?? null,
      },
    });
  } catch (error) {
    const databaseMessage = message(error);
    if (databaseMessage) return invalid(databaseMessage);
    throw error;
  }
  revalidatePath("/");
  return { message: "Asset maintenance recorded.", success: true };
}

export async function createStockItemAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const context = await signedInFarm();
  if (!context) return invalid("Your session expired. Sign in again.");
  if (context.role !== FarmRole.OWNER) return invalid("Only a farm owner can set up stock items.");
  const parsed = z.object({
    name: z.string().trim().min(2).max(100),
    category: z.nativeEnum(ExpenseCategory),
    unit: z.string().trim().min(1).max(20),
    lowStockThreshold: optionalNumber,
  }).safeParse({
    name: value(formData, "name"),
    category: value(formData, "category"),
    unit: value(formData, "unit"),
    lowStockThreshold: value(formData, "lowStockThreshold"),
  });
  if (
    !parsed.success ||
    (parsed.data.lowStockThreshold !== undefined && parsed.data.lowStockThreshold < 0)
  ) {
    return invalid("Enter an item name, unit, and non-negative low-stock threshold.");
  }

  try {
    await tenantDb(context.farm.id, context.user.id).stockItem.create({
      data: {
        farmId: context.farm.id,
        name: parsed.data.name,
        category: parsed.data.category,
        unit: parsed.data.unit,
        lowStockThreshold: parsed.data.lowStockThreshold,
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return invalid("An item with that name already exists in this farm.");
    }
    const databaseMessage = message(error);
    if (databaseMessage) return invalid(databaseMessage);
    throw error;
  }
  revalidatePath("/");
  return { message: "Stock item added.", success: true };
}

export async function createSupplierAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const context = await signedInFarm();
  if (!context) return invalid("Your session expired. Sign in again.");
  if (context.role !== FarmRole.OWNER) return invalid("Only a farm owner can manage supplier records.");
  const parsed = z.object({
    name: z.string().trim().min(2).max(100),
    contact: optionalText,
  }).safeParse({
    name: value(formData, "name"),
    contact: value(formData, "contact"),
  });
  if (!parsed.success) return invalid("Enter a supplier name.");

  try {
    await tenantDb(context.farm.id, context.user.id).supplier.create({
      data: {
        farmId: context.farm.id,
        name: parsed.data.name,
        contact: parsed.data.contact,
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return invalid("A supplier with that name already exists in this farm.");
    }
    const databaseMessage = message(error);
    if (databaseMessage) return invalid(databaseMessage);
    throw error;
  }
  revalidatePath("/");
  return { message: "Supplier added.", success: true };
}

export async function createStockMovementAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const context = await signedInFarm();
  if (!context) return invalid("Your session expired. Sign in again.");
  const parsed = z.object({
    itemId: z.string().min(1),
    type: z.enum(["PURCHASE", "USAGE", "ADJUSTMENT"]),
    quantity: z.coerce.number().finite(),
    supplierId: optionalText,
    cycleId: optionalText,
    taskId: optionalText,
    unitCost: optionalNumber,
    lotReference: optionalText,
    movedAt: z.string().optional(),
    notes: optionalText,
  }).safeParse({
    itemId: value(formData, "itemId"),
    type: value(formData, "type"),
    quantity: value(formData, "quantity"),
    supplierId: value(formData, "supplierId") || undefined,
    cycleId: value(formData, "cycleId") || undefined,
    taskId: value(formData, "taskId") || undefined,
    unitCost: value(formData, "unitCost"),
    lotReference: value(formData, "lotReference"),
    movedAt: value(formData, "movedAt"),
    notes: value(formData, "notes"),
  });
  if (
    !parsed.success ||
    (parsed.data.type !== "ADJUSTMENT" && parsed.data.quantity <= 0) ||
    (parsed.data.type === "ADJUSTMENT" && parsed.data.quantity === 0) ||
    (parsed.data.unitCost !== undefined && parsed.data.unitCost < 0) ||
    dateError(parsed.data.movedAt ?? "")
  ) {
    return invalid("Enter a valid quantity, movement type, and date.");
  }
  if (parsed.data.type === "USAGE" && !parsed.data.cycleId) {
    return invalid("Link stock usage to a crop cycle so the input cost is counted.");
  }
  if (context.role !== FarmRole.OWNER && parsed.data.type !== "USAGE") {
    return invalid("Only a farm owner can record purchases or stock adjustments.");
  }
  if (parsed.data.type === "PURCHASE" && parsed.data.unitCost === undefined) {
    return invalid("Enter the actual purchase cost per unit.");
  }
  if (context.role !== FarmRole.OWNER && parsed.data.unitCost !== undefined) {
    return invalid("Stock usage cost is calculated from recorded purchase prices.");
  }
  const [item, supplier, cycle, task] = await Promise.all([
    tenantDb(context.farm.id, context.user.id).stockItem.findFirst({
      where: { id: parsed.data.itemId, farmId: context.farm.id },
      select: { id: true, unit: true },
    }),
    parsed.data.supplierId
      ? tenantDb(context.farm.id, context.user.id).supplier.findFirst({
          where: { id: parsed.data.supplierId, farmId: context.farm.id },
          select: { id: true },
        })
      : Promise.resolve(null),
    parsed.data.cycleId
      ? tenantDb(context.farm.id, context.user.id).cropCycle.findFirst({
          where: { id: parsed.data.cycleId, farmId: context.farm.id },
          select: { id: true },
        })
      : Promise.resolve(null),
    parsed.data.taskId
      ? tenantDb(context.farm.id, context.user.id).task.findFirst({
          where: { id: parsed.data.taskId, farmId: context.farm.id },
          select: { id: true },
        })
      : Promise.resolve(null),
  ]);
  if (!item) return invalid("Choose a stock item from this farm.");
  if (parsed.data.supplierId && !supplier) return invalid("Choose a supplier from this farm.");
  if (parsed.data.cycleId && !cycle) return invalid("Choose a crop cycle from this farm.");
  if (parsed.data.taskId && !task) return invalid("Choose a task from this farm.");
  if (parsed.data.type === "USAGE" && parsed.data.unitCost === undefined) {
    return invalid("Enter the unit cost for stock used on a crop cycle.");
  }

  try {
    await tenantDb(context.farm.id, context.user.id).$transaction(async (tx) => {
      const movements = await tx.stockMovement.findMany({
        where: { farmId: context.farm.id, itemId: item.id },
        orderBy: [{ movedAt: "asc" }, { id: "asc" }],
        select: { type: true, quantity: true, unitCost: true },
      });
      let currentStock = 0;
      let inventoryValue = 0;
      for (const movement of movements) {
        const quantity = movement.quantity.toNumber();
        if (movement.type === "PURCHASE") {
          currentStock += quantity;
          inventoryValue += quantity * (movement.unitCost?.toNumber() ?? 0);
        } else if (movement.type === "USAGE") {
          if (currentStock > 0) {
            const averageCost = inventoryValue / currentStock;
            inventoryValue -= averageCost * quantity;
          }
          currentStock -= quantity;
        } else {
          const adjustmentCost =
            currentStock > 0 ? inventoryValue / currentStock : 0;
          currentStock += quantity;
          inventoryValue += adjustmentCost * quantity;
        }
      }
      const nextStock =
        parsed.data.type === "PURCHASE"
          ? currentStock + parsed.data.quantity
          : parsed.data.type === "USAGE"
            ? currentStock - parsed.data.quantity
            : currentStock + parsed.data.quantity;
      if (nextStock < 0) throw new Error("INSUFFICIENT_STOCK");
      if (parsed.data.type === "USAGE" && currentStock <= 0) {
        throw new Error("NO_STOCK_COST");
      }
      const usageUnitCost =
        parsed.data.type === "USAGE"
          ? inventoryValue / currentStock
          : parsed.data.unitCost;

      await tx.stockMovement.create({
        data: {
          farmId: context.farm.id,
          itemId: item.id,
          supplierId: supplier?.id ?? null,
          cycleId: cycle?.id ?? null,
          taskId: task?.id ?? null,
          type: parsed.data.type,
          quantity:
            parsed.data.type === "ADJUSTMENT"
              ? parsed.data.quantity
              : Math.abs(parsed.data.quantity),
          unit: item.unit,
          unitCost: usageUnitCost,
          currency: context.farm.currency,
          lotReference: parsed.data.lotReference,
          movedAt: optionalDate(parsed.data.movedAt ?? "") ?? new Date(),
          notes: parsed.data.notes,
        },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    if (error instanceof Error && error.message === "INSUFFICIENT_STOCK") {
      return invalid("This movement would make stock negative. Check purchases and usage first.");
    }
    if (error instanceof Error && error.message === "NO_STOCK_COST") {
      return invalid("Record priced stock purchases before using this item on a crop cycle.");
    }
    const databaseMessage = message(error);
    if (databaseMessage) return invalid(databaseMessage);
    throw error;
  }

  revalidatePath("/");
  return { message: "Stock movement recorded.", success: true };
}

export async function addFarmMemberAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const context = await signedInFarm();
  if (!context) return invalid("Your session expired. Sign in again.");
  if (context.role !== FarmRole.OWNER) return invalid("Only a farm owner can manage farm roles.");
  const parsed = z.object({
    email: z.email().trim().toLowerCase(),
    role: z.nativeEnum(FarmRole),
  }).safeParse({
    email: value(formData, "email"),
    role: value(formData, "role"),
  });
  if (!parsed.success || parsed.data.role === "OWNER") {
    return invalid("Enter an existing user's email and choose the manager role.");
  }

  const user = await db.user.findUnique({
    where: { email: parsed.data.email },
    select: { id: true },
  });
  if (!user) return invalid("That user must create an account before being added as a manager.");
  try {
    await tenantDb(context.farm.id, context.user.id).farmMember.create({
      data: { farmId: context.farm.id, userId: user.id, role: "MANAGER" },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return invalid("That user is already a member of this farm.");
    }
    const databaseMessage = message(error);
    if (databaseMessage) return invalid(databaseMessage);
    throw error;
  }
  revalidatePath("/");
  return { message: "Farm manager added.", success: true };
}

export async function createAnimalGroupAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const context = await signedInFarm();
  if (!context) return invalid("Your session expired. Sign in again.");
  if (context.role !== FarmRole.OWNER) return invalid("Only a farm owner can register animal groups.");
  const parsed = z.object({
    name: z.string().trim().min(2).max(100),
    species: z.string().trim().min(2).max(80),
    trackingMode: z.nativeEnum(AnimalTrackingMode),
    startDate: z.string().optional(),
    startingCount: z.coerce.number().int().min(0).max(1_000_000),
    notes: optionalText,
  }).safeParse({
    name: value(formData, "name"),
    species: value(formData, "species"),
    trackingMode: value(formData, "trackingMode"),
    startDate: value(formData, "startDate"),
    startingCount: value(formData, "startingCount"),
    notes: value(formData, "notes"),
  });
  if (
    !parsed.success ||
    dateError(parsed.data.startDate ?? "") ||
    (parsed.data.trackingMode === AnimalTrackingMode.INDIVIDUAL && parsed.data.startingCount !== 0)
  ) {
    return invalid("Enter a group name, species, start date and a whole starting count.");
  }
  const startDate = optionalDate(parsed.data.startDate ?? "") ?? new Date();
  if (startDate.getTime() > Date.now()) return invalid("Group start date must not be in the future.");
  try {
    await tenantDb(context.farm.id, context.user.id).animalGroup.create({
      data: {
        farmId: context.farm.id,
        name: parsed.data.name,
        species: parsed.data.species,
        trackingMode: parsed.data.trackingMode,
        startDate,
        startingCount: parsed.data.startingCount,
        notes: parsed.data.notes,
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return invalid("A group with that name already exists in this farm.");
    }
    const databaseMessage = message(error);
    if (databaseMessage) return invalid(databaseMessage);
    throw error;
  }
  revalidatePath("/");
  return { message: "Animal group created.", success: true };
}

export async function createAnimalAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const context = await signedInFarm();
  if (!context) return invalid("Your session expired. Sign in again.");
  if (context.role !== FarmRole.OWNER) return invalid("Only a farm owner can register individual animals.");
  const parsed = z.object({
    tagNumber: z.string().trim().min(1).max(80),
    species: z.string().trim().min(2).max(80),
    breed: optionalText,
    sex: optionalText,
    birthDate: z.string().optional(),
    source: optionalText,
    purchasePrice: optionalNumber,
    seller: optionalText,
    groupId: z.string().min(1),
  }).safeParse({
    tagNumber: value(formData, "tagNumber"),
    species: value(formData, "species"),
    breed: value(formData, "breed"),
    sex: value(formData, "sex"),
    birthDate: value(formData, "birthDate"),
    source: value(formData, "source"),
    purchasePrice: value(formData, "purchasePrice"),
    seller: value(formData, "seller"),
    groupId: value(formData, "groupId"),
  });
  if (
    !parsed.success ||
    dateError(parsed.data.birthDate ?? "") ||
    (parsed.data.purchasePrice !== undefined && parsed.data.purchasePrice < 0) ||
    (context.role !== FarmRole.OWNER && parsed.data.purchasePrice !== undefined)
  ) {
    return invalid("Enter a tag number and species, and check the birth date.");
  }
  const birthDate = optionalDate(parsed.data.birthDate ?? "");
  if (birthDate && birthDate.getTime() > Date.now()) {
    return invalid("Birth date must not be in the future.");
  }
  const group = await tenantDb(context.farm.id, context.user.id).animalGroup.findFirst({
        where: { id: parsed.data.groupId, farmId: context.farm.id, archivedAt: null },
        select: { id: true, species: true, trackingMode: true },
      });
  if (!group || group.trackingMode !== AnimalTrackingMode.INDIVIDUAL) {
    return invalid("Choose an active individual-tracking group from this farm.");
  }
  if (group.species.toLocaleLowerCase() !== parsed.data.species.toLocaleLowerCase()) {
    return invalid("The animal species must match its group.");
  }
  try {
    await tenantDb(context.farm.id, context.user.id).animal.create({
      data: {
        farmId: context.farm.id,
        tagNumber: parsed.data.tagNumber,
        species: parsed.data.species,
        breed: parsed.data.breed,
        sex: parsed.data.sex,
        birthDate,
        source: parsed.data.source,
        purchasePrice: parsed.data.purchasePrice,
        seller: parsed.data.seller,
        groupId: group.id,
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return invalid("That tag number is already registered in this farm.");
    }
    const databaseMessage = message(error);
    if (databaseMessage) return invalid(databaseMessage);
    throw error;
  }
  revalidatePath("/");
  return { message: "Animal registered.", success: true };
}

export async function archiveAnimalGroupAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const context = await signedInFarm();
  if (!context) return invalid("Your session expired. Sign in again.");
  if (context.role !== FarmRole.OWNER) return invalid("Only a farm owner can archive animal groups.");
  const id = value(formData, "id");
  if (!id) return invalid("Choose an animal group to archive.");
  const group = await tenantDb(context.farm.id, context.user.id).animalGroup.findFirst({
    where: { id, farmId: context.farm.id, archivedAt: null },
    select: { id: true },
  });
  if (!group) return invalid("That active animal group was not found in this farm.");
  const activeTaggedAnimals = await tenantDb(context.farm.id, context.user.id).animal.count({
    where: { farmId: context.farm.id, groupId: group.id, archivedAt: null, status: "ACTIVE" },
  });
  if (activeTaggedAnimals > 0) {
    return invalid("Archive or move the group's active tagged animals before archiving the group.");
  }
  try {
    await tenantDb(context.farm.id, context.user.id).animalGroup.update({
      where: { id: group.id },
      data: { archivedAt: new Date() },
    });
  } catch (error) {
    const databaseMessage = message(error);
    if (databaseMessage) return invalid(databaseMessage);
    throw error;
  }
  revalidatePath("/");
  return { message: "Animal group archived.", success: true };
}

export async function archiveAnimalAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const context = await signedInFarm();
  if (!context) return invalid("Your session expired. Sign in again.");
  if (context.role !== FarmRole.OWNER) return invalid("Only a farm owner can archive animals.");
  const id = value(formData, "id");
  if (!id) return invalid("Choose an animal to archive.");
  const animal = await tenantDb(context.farm.id, context.user.id).animal.findFirst({
    where: { id, farmId: context.farm.id, archivedAt: null },
    select: { id: true },
  });
  if (!animal) return invalid("That active animal was not found in this farm.");
  try {
    await tenantDb(context.farm.id, context.user.id).animal.update({
      where: { id: animal.id },
      data: { archivedAt: new Date() },
    });
  } catch (error) {
    const databaseMessage = message(error);
    if (databaseMessage) return invalid(databaseMessage);
    throw error;
  }
  revalidatePath("/");
  return { message: "Animal archived.", success: true };
}

export async function recordAnimalEventAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const context = await signedInFarm();
  if (!context) return invalid("Your session expired. Sign in again.");
  const parsed = z.object({
    animalId: optionalText,
    animalGroupId: optionalText,
    type: z.nativeEnum(AnimalEventType),
    occurredAt: z.string().optional(),
    quantity: optionalNumber,
    purchaseCost: optionalNumber,
    seller: optionalText,
    notes: optionalText,
  }).safeParse({
    animalId: value(formData, "animalId"),
    animalGroupId: value(formData, "animalGroupId"),
    type: value(formData, "type"),
    occurredAt: value(formData, "occurredAt"),
    quantity: value(formData, "quantity"),
    purchaseCost: value(formData, "purchaseCost"),
    seller: value(formData, "seller"),
    notes: value(formData, "notes"),
  });
  if (
    !parsed.success ||
    Boolean(parsed.data.animalId) === Boolean(parsed.data.animalGroupId) ||
    dateError(parsed.data.occurredAt ?? "") ||
    (Boolean(parsed.data.animalId) && parsed.data.quantity !== undefined) ||
    (parsed.data.quantity !== undefined &&
      (!Number.isInteger(parsed.data.quantity) || parsed.data.quantity <= 0)) ||
    (parsed.data.purchaseCost !== undefined &&
      (parsed.data.purchaseCost < 0 ||
        parsed.data.type !== AnimalEventType.PURCHASE ||
        context.role !== FarmRole.OWNER)) ||
    (parsed.data.seller && parsed.data.type !== AnimalEventType.PURCHASE)
  ) {
    return invalid("Choose one animal or group, event type, date and a positive whole quantity where needed.");
  }
  const occurredAt = optionalDate(parsed.data.occurredAt ?? "") ?? new Date();
  if (occurredAt.getTime() > Date.now()) return invalid("Animal events must not be dated in the future.");
  const isCountEvent = ["BIRTH", "PURCHASE", "SALE", "DEATH", "CULLED"].includes(parsed.data.type);
  if (parsed.data.animalGroupId && isCountEvent && parsed.data.quantity === undefined) {
    return invalid("Enter how many animals were affected.");
  }

  const farmDb = tenantDb(context.farm.id, context.user.id);
  const group = parsed.data.animalGroupId
    ? await farmDb.animalGroup.findFirst({
        where: { id: parsed.data.animalGroupId, farmId: context.farm.id, archivedAt: null },
        include: { events: { select: { type: true, quantity: true } } },
      })
    : null;
  const animal = parsed.data.animalId
    ? await farmDb.animal.findFirst({
        where: { id: parsed.data.animalId, farmId: context.farm.id, archivedAt: null },
        select: { id: true, status: true },
      })
    : null;
  if (parsed.data.animalGroupId && !group) return invalid("Choose an active animal group from this farm.");
  if (parsed.data.animalId && !animal) return invalid("Choose an active animal from this farm.");
  if (group && group.trackingMode !== AnimalTrackingMode.HEAD_COUNT) {
    return invalid("Record count events through tagged animals in an individual-tracking group.");
  }
  if (group && occurredAt < group.startDate) {
    return invalid("A group event cannot be earlier than the group's start date.");
  }
  if (animal && animal.status !== "ACTIVE") return invalid("Only active animals can receive new events.");
  const quantity = parsed.data.quantity ?? (parsed.data.animalId && isCountEvent ? 1 : null);

  try {
    await farmDb.$transaction(async (tx) => {
      if (group && quantity !== null && ["SALE", "DEATH", "CULLED"].includes(parsed.data.type)) {
        const latestGroup = await tx.animalGroup.findFirst({
          where: { id: group.id, farmId: context.farm.id, archivedAt: null },
          include: { events: { select: { type: true, quantity: true } } },
        });
        if (!latestGroup) throw new Error("ANIMAL_GROUP_NOT_FOUND");
        if (quantity > calculateAnimalGroupCount(latestGroup.startingCount, latestGroup.events)) {
          throw new Error("GROUP_COUNT_EXCEEDED");
        }
      }
      await tx.animalEvent.create({
        data: {
          farmId: context.farm.id,
          animalId: animal?.id ?? null,
          animalGroupId: group?.id ?? null,
          type: parsed.data.type,
          occurredAt,
          quantity,
          purchaseCost: parsed.data.purchaseCost,
          seller: parsed.data.seller,
          notes: parsed.data.notes,
        },
      });
      if (animal && ["SALE", "DEATH", "CULLED"].includes(parsed.data.type)) {
        await tx.animal.update({
          where: { id: animal.id, farmId: context.farm.id },
          data: { status: parsed.data.type === "SALE" ? "SOLD" : parsed.data.type === "DEATH" ? "DEAD" : "CULLED" },
        });
      }
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    if (error instanceof Error && error.message === "GROUP_COUNT_EXCEEDED") {
      return invalid("The event quantity cannot exceed the group's current count.");
    }
    if (error instanceof Error && error.message === "ANIMAL_GROUP_NOT_FOUND") {
      return invalid("Choose an active animal group from this farm.");
    }
    const databaseMessage = message(error);
    if (databaseMessage) return invalid(databaseMessage);
    throw error;
  }
  revalidatePath("/");
  return { message: "Animal event recorded.", success: true };
}

export async function saveFeedRationAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const context = await signedInFarm();
  if (!context) return invalid("Your session expired. Sign in again.");
  if (context.role !== FarmRole.OWNER) return invalid("Only a farm owner can change feed rations.");
  const parsed = z.object({
    animalGroupId: z.string().min(1),
    itemId: z.string().min(1),
    quantityPerHead: positiveNumber,
  }).safeParse({
    animalGroupId: value(formData, "animalGroupId"),
    itemId: value(formData, "itemId"),
    quantityPerHead: value(formData, "quantityPerHead"),
  });
  if (!parsed.success) return invalid("Choose a group and feed item, then enter a positive daily amount per head.");

  const farmDb = tenantDb(context.farm.id, context.user.id);
  const [group, item] = await Promise.all([
    farmDb.animalGroup.findFirst({
      where: { id: parsed.data.animalGroupId, farmId: context.farm.id, archivedAt: null },
      select: { id: true },
    }),
    farmDb.stockItem.findFirst({
      where: { id: parsed.data.itemId, farmId: context.farm.id },
      select: { id: true, category: true, unit: true },
    }),
  ]);
  if (!group || !item) return invalid("Choose a group and feed item from this farm.");
  if (item.category !== ExpenseCategory.FEED) return invalid("The selected stock item is not categorized as feed.");

  try {
    await farmDb.feedRation.upsert({
      where: {
        farmId_animalGroupId_itemId: {
          farmId: context.farm.id,
          animalGroupId: group.id,
          itemId: item.id,
        },
      },
      create: {
        farmId: context.farm.id,
        animalGroupId: group.id,
        itemId: item.id,
        quantityPerHead: parsed.data.quantityPerHead,
        unit: item.unit,
      },
      update: {
        quantityPerHead: parsed.data.quantityPerHead,
        unit: item.unit,
      },
    });
  } catch (error) {
    const databaseMessage = message(error);
    if (databaseMessage) return invalid(databaseMessage);
    throw error;
  }
  revalidatePath("/");
  return { message: "Daily feed ration saved.", success: true };
}

export async function recordAnimalDailyAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const context = await signedInFarm();
  if (!context) return invalid("Your session expired. Sign in again.");
  const parsed = z.object({
    animalId: optionalText,
    animalGroupId: optionalText,
    type: z.nativeEnum(AnimalDailyRecordType),
    quantity: optionalNumber,
    feedItemId: optionalText,
    unit: optionalText,
    recordedAt: z.string().optional(),
    notes: optionalText,
    offlineId: optionalText,
  }).safeParse({
    animalId: value(formData, "animalId"),
    animalGroupId: value(formData, "animalGroupId"),
    type: value(formData, "type"),
    quantity: value(formData, "quantity"),
    feedItemId: value(formData, "feedItemId"),
    unit: value(formData, "unit"),
    recordedAt: value(formData, "recordedAt"),
    notes: value(formData, "notes"),
    offlineId: value(formData, "offlineId"),
  });
  if (
    !parsed.success ||
    Boolean(parsed.data.animalId) === Boolean(parsed.data.animalGroupId) ||
    dateError(parsed.data.recordedAt ?? "") ||
    (parsed.data.quantity !== undefined && parsed.data.quantity <= 0)
  ) {
    return invalid("Choose one animal or group, an activity, date and a positive quantity when applicable.");
  }
  const isMeasured = ["FEEDING", "WATER", "MILK", "EGGS"].includes(parsed.data.type);
  if (isMeasured && parsed.data.quantity === undefined) {
    return invalid("Enter the recorded quantity for this activity.");
  }
  if (isMeasured && parsed.data.type !== AnimalDailyRecordType.FEEDING && !parsed.data.unit) {
    return invalid("Choose the unit for the recorded quantity.");
  }
  if (parsed.data.type === AnimalDailyRecordType.FEEDING &&
      (!parsed.data.feedItemId || parsed.data.quantity === undefined)) {
    return invalid("Choose a feed item and enter the amount actually given.");
  }
  if (parsed.data.feedItemId && parsed.data.type !== AnimalDailyRecordType.FEEDING) {
    return invalid("Feed stock can only be selected for a feeding entry.");
  }
  const farmDb = tenantDb(context.farm.id, context.user.id);
  if (parsed.data.offlineId && await farmDb.animalDailyRecord.findFirst({
    where: { farmId: context.farm.id, offlineId: parsed.data.offlineId },
    select: { id: true },
  })) return { message: "Animal daily record already synced.", success: true };

  const occurredAt = optionalDate(parsed.data.recordedAt ?? "") ?? new Date();
  const item = parsed.data.feedItemId
    ? await farmDb.stockItem.findFirst({
        where: { id: parsed.data.feedItemId, farmId: context.farm.id },
        select: { id: true, category: true, unit: true },
      })
    : null;
  if (parsed.data.feedItemId && !item) return invalid("Choose a feed item from this farm.");
  if (item && item.category !== ExpenseCategory.FEED) return invalid("The selected stock item is not categorized as feed.");

  const [animal, group] = await Promise.all([
    parsed.data.animalId
      ? farmDb.animal.findFirst({
          where: { id: parsed.data.animalId, farmId: context.farm.id, archivedAt: null },
          select: { id: true },
        })
      : Promise.resolve(null),
    parsed.data.animalGroupId
      ? farmDb.animalGroup.findFirst({
          where: { id: parsed.data.animalGroupId, farmId: context.farm.id, archivedAt: null },
          select: { id: true },
        })
      : Promise.resolve(null),
  ]);
  if (parsed.data.animalId && !animal) return invalid("Choose an active animal from this farm.");
  if (parsed.data.animalGroupId && !group) return invalid("Choose an active animal group from this farm.");
  if (parsed.data.type === AnimalDailyRecordType.FEEDING && !item) return invalid("Choose a feed item.");

  try {
    const created = await farmDb.$transaction(async (tx) => {
      if (parsed.data.offlineId && await tx.animalDailyRecord.findFirst({
        where: { farmId: context.farm.id, offlineId: parsed.data.offlineId },
        select: { id: true },
      })) return false;

      let unitCost: number | null = null;
      if (item && parsed.data.quantity !== undefined) {
        const movements = await tx.stockMovement.findMany({
          where: { farmId: context.farm.id, itemId: item.id },
          orderBy: [{ movedAt: "asc" }, { id: "asc" }],
          select: { type: true, quantity: true, unitCost: true },
        });
        let currentStock = 0;
        let inventoryValue = 0;
        for (const movement of movements) {
          const movedQuantity = movement.quantity.toNumber();
          if (movement.type === "PURCHASE") {
            currentStock += movedQuantity;
            inventoryValue += movedQuantity * (movement.unitCost?.toNumber() ?? 0);
          } else if (movement.type === "USAGE") {
            if (currentStock > 0) {
              inventoryValue -= (inventoryValue / currentStock) * movedQuantity;
            }
            currentStock -= movedQuantity;
          } else {
            const averageCost = currentStock > 0 ? inventoryValue / currentStock : 0;
            currentStock += movedQuantity;
            inventoryValue += averageCost * movedQuantity;
          }
        }
        if (parsed.data.quantity > currentStock) throw new Error("INSUFFICIENT_FEED_STOCK");
        if (currentStock <= 0 || inventoryValue <= 0) throw new Error("FEED_COST_UNAVAILABLE");
        unitCost = inventoryValue / currentStock;
      }

      await tx.animalDailyRecord.create({
        data: {
          farmId: context.farm.id,
          animalId: animal?.id ?? null,
          animalGroupId: group?.id ?? null,
          feedItemId: item?.id ?? null,
          type: parsed.data.type,
          recordedAt: occurredAt,
          quantity: parsed.data.quantity,
          unit: item?.unit ?? parsed.data.unit ?? null,
          notes: parsed.data.notes,
          offlineId: parsed.data.offlineId ?? null,
        },
      });
      if (item && parsed.data.quantity !== undefined) {
        await tx.stockMovement.create({
          data: {
            farmId: context.farm.id,
            itemId: item.id,
            animalId: animal?.id ?? null,
            animalGroupId: group?.id ?? null,
            type: "USAGE",
            quantity: parsed.data.quantity,
            unit: item.unit,
            unitCost,
            currency: context.farm.currency,
            movedAt: occurredAt,
            notes: parsed.data.notes,
          },
        });
      }
      return true;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    if (!created) return { message: "Animal daily record already synced.", success: true };
  } catch (error) {
    if (error instanceof Error && error.message === "INSUFFICIENT_FEED_STOCK") {
      return invalid("There is not enough feed stock for this entry.");
    }
    if (error instanceof Error && error.message === "FEED_COST_UNAVAILABLE") {
      return invalid("Record a priced feed purchase before using stock in the daily tracker.");
    }
    if (
      parsed.data.offlineId &&
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002" &&
      await farmDb.animalDailyRecord.findFirst({
        where: { farmId: context.farm.id, offlineId: parsed.data.offlineId },
        select: { id: true },
      })
    ) {
      return { message: "Animal daily record already synced.", success: true };
    }
    const databaseMessage = message(error);
    if (databaseMessage) return invalid(databaseMessage);
    throw error;
  }
  revalidatePath("/");
  return { message: "Animal daily record saved.", success: true };
}

export async function createAnimalHealthProductAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const context = await signedInFarm();
  if (!context) return invalid("Your session expired. Sign in again.");
  if (context.role !== FarmRole.OWNER) return invalid("Only a farm owner can manage vaccine and medicine records.");
  const parsed = z.object({
    name: z.string().trim().min(2).max(120),
    type: z.nativeEnum(AnimalHealthProductType),
    diseaseCovered: optionalText,
    dose: optionalText,
    route: optionalText,
    storage: optionalText,
    batch: optionalText,
    expiresAt: z.string().optional(),
    costPerDose: optionalNumber,
    withdrawalDays: z.coerce.number().int().min(0).max(3650),
  }).safeParse({
    name: value(formData, "name"),
    type: value(formData, "type"),
    diseaseCovered: value(formData, "diseaseCovered"),
    dose: value(formData, "dose"),
    route: value(formData, "route"),
    storage: value(formData, "storage"),
    batch: value(formData, "batch"),
    expiresAt: value(formData, "expiresAt"),
    costPerDose: value(formData, "costPerDose"),
    withdrawalDays: value(formData, "withdrawalDays"),
  });
  if (
    !parsed.success ||
    dateError(parsed.data.expiresAt ?? "") ||
    (parsed.data.costPerDose !== undefined && parsed.data.costPerDose < 0)
  ) {
    return invalid("Enter valid vaccine or medicine details, expiry date, cost, and withdrawal days.");
  }
  try {
    await tenantDb(context.farm.id, context.user.id).animalHealthProduct.create({
      data: {
        farmId: context.farm.id,
        name: parsed.data.name,
        type: parsed.data.type,
        diseaseCovered: parsed.data.diseaseCovered,
        dose: parsed.data.dose,
        route: parsed.data.route,
        storage: parsed.data.storage,
        batch: parsed.data.batch,
        expiresAt: optionalDate(parsed.data.expiresAt ?? ""),
        costPerDose: parsed.data.costPerDose,
        withdrawalDays: parsed.data.withdrawalDays,
      },
    });
  } catch (error) {
    const databaseMessage = message(error);
    if (databaseMessage) return invalid(databaseMessage);
    throw error;
  }
  revalidatePath("/");
  return { message: "Vaccine or medicine record added.", success: true };
}

export async function createAnimalVaccinationScheduleAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const context = await signedInFarm();
  if (!context) return invalid("Your session expired. Sign in again.");
  if (context.role !== FarmRole.OWNER) return invalid("Only a farm owner can manage vaccination schedules.");
  const parsed = z.object({
    title: z.string().trim().min(2).max(120),
    productId: z.string().min(1),
    species: z.string().trim().min(2).max(80),
    breed: optionalText,
    animalGroupId: optionalText,
    ageDays: optionalNumber,
    firstDueAt: z.string().optional(),
    repeatEveryDays: optionalNumber,
    notes: optionalText,
  }).safeParse({
    title: value(formData, "title"),
    productId: value(formData, "productId"),
    species: value(formData, "species"),
    breed: value(formData, "breed"),
    animalGroupId: value(formData, "animalGroupId"),
    ageDays: value(formData, "ageDays"),
    firstDueAt: value(formData, "firstDueAt"),
    repeatEveryDays: value(formData, "repeatEveryDays"),
    notes: value(formData, "notes"),
  });
  if (
    !parsed.success ||
    (parsed.data.ageDays !== undefined &&
      (!Number.isInteger(parsed.data.ageDays) || parsed.data.ageDays < 0 || parsed.data.ageDays > 36500)) ||
    (parsed.data.repeatEveryDays !== undefined &&
      (!Number.isInteger(parsed.data.repeatEveryDays) || parsed.data.repeatEveryDays <= 0 || parsed.data.repeatEveryDays > 36500)) ||
    dateError(parsed.data.firstDueAt ?? "") ||
    (parsed.data.ageDays === undefined && !parsed.data.firstDueAt) ||
    (Boolean(parsed.data.animalGroupId) && !parsed.data.firstDueAt)
  ) {
    return invalid("Enter a schedule title, species, first due date or age, and a valid repeat interval.");
  }
  const farmDb = tenantDb(context.farm.id, context.user.id);
  const [product, group] = await Promise.all([
    farmDb.animalHealthProduct.findFirst({
      where: { id: parsed.data.productId, farmId: context.farm.id, archivedAt: null },
      select: { id: true, type: true },
    }),
    parsed.data.animalGroupId
      ? farmDb.animalGroup.findFirst({
          where: { id: parsed.data.animalGroupId, farmId: context.farm.id, archivedAt: null },
          select: { id: true, species: true },
        })
      : Promise.resolve(null),
  ]);
  if (!product || product.type !== AnimalHealthProductType.VACCINE) {
    return invalid("Choose an active vaccine product from this farm.");
  }
  if (parsed.data.animalGroupId && !group) return invalid("Choose an active animal group from this farm.");
  if (group && group.species.toLocaleLowerCase() !== parsed.data.species.toLocaleLowerCase()) {
    return invalid("The schedule species must match its selected group.");
  }
  try {
    await farmDb.animalVaccinationSchedule.create({
      data: {
        farmId: context.farm.id,
        productId: product.id,
        title: parsed.data.title,
        species: parsed.data.species,
        breed: parsed.data.breed,
        animalGroupId: group?.id ?? null,
        ageDays: parsed.data.ageDays,
        firstDueAt: optionalDate(parsed.data.firstDueAt ?? ""),
        repeatEveryDays: parsed.data.repeatEveryDays,
        notes: parsed.data.notes,
      },
    });
  } catch (error) {
    const databaseMessage = message(error);
    if (databaseMessage) return invalid(databaseMessage);
    throw error;
  }
  revalidatePath("/");
  return { message: "Vaccination schedule saved.", success: true };
}

export async function recordAnimalHealthAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const context = await signedInFarm();
  if (!context) return invalid("Your session expired. Sign in again.");
  const parsed = z.object({
    animalId: optionalText,
    animalGroupId: optionalText,
    healthCaseId: optionalText,
    productId: optionalText,
    scheduleId: optionalText,
    type: z.nativeEnum(AnimalHealthRecordType),
    administeredAt: z.string().optional(),
    dose: optionalText,
    route: optionalText,
    batch: optionalText,
    cost: optionalNumber,
    notes: optionalText,
    offlineId: optionalText,
  }).safeParse({
    animalId: value(formData, "animalId"),
    animalGroupId: value(formData, "animalGroupId"),
    healthCaseId: value(formData, "healthCaseId"),
    productId: value(formData, "productId"),
    scheduleId: value(formData, "scheduleId"),
    type: value(formData, "type"),
    administeredAt: value(formData, "administeredAt"),
    dose: value(formData, "dose"),
    route: value(formData, "route"),
    batch: value(formData, "batch"),
    cost: value(formData, "cost"),
    notes: value(formData, "notes"),
    offlineId: value(formData, "offlineId"),
  });
  if (
    !parsed.success ||
    Boolean(parsed.data.animalId) === Boolean(parsed.data.animalGroupId) ||
    dateError(parsed.data.administeredAt ?? "") ||
    (parsed.data.cost !== undefined && parsed.data.cost < 0) ||
    (parsed.data.type === AnimalHealthRecordType.VACCINATION && !parsed.data.productId) ||
    (context.role !== FarmRole.OWNER && parsed.data.cost !== undefined)
  ) {
    return invalid("Choose one animal or group, a health activity and date; check any cost entered.");
  }
  const farmDb = tenantDb(context.farm.id, context.user.id);
  if (parsed.data.offlineId && await farmDb.animalHealthRecord.findFirst({
    where: { farmId: context.farm.id, offlineId: parsed.data.offlineId },
    select: { id: true },
  })) return { message: "Animal health record already synced.", success: true };
  const administeredAt = optionalDate(parsed.data.administeredAt ?? "") ?? new Date();
  if (administeredAt.getTime() > Date.now()) return invalid("Health record date must not be in the future.");
  const [animal, group, healthCase, product, schedule] = await Promise.all([
    parsed.data.animalId
      ? farmDb.animal.findFirst({
          where: { id: parsed.data.animalId, farmId: context.farm.id, archivedAt: null, status: "ACTIVE" },
          select: { id: true, species: true, breed: true, groupId: true },
        })
      : Promise.resolve(null),
    parsed.data.animalGroupId
      ? farmDb.animalGroup.findFirst({
          where: { id: parsed.data.animalGroupId, farmId: context.farm.id, archivedAt: null },
          select: { id: true, species: true },
        })
      : Promise.resolve(null),
    parsed.data.healthCaseId
      ? farmDb.animalHealthCase.findFirst({
          where: {
            id: parsed.data.healthCaseId,
            farmId: context.farm.id,
            resolvedAt: null,
            animalId: parsed.data.animalId || undefined,
            animalGroupId: parsed.data.animalGroupId || undefined,
          },
          select: { id: true },
        })
      : Promise.resolve(null),
    parsed.data.productId
      ? farmDb.animalHealthProduct.findFirst({
          where: { id: parsed.data.productId, farmId: context.farm.id, archivedAt: null },
          select: {
            id: true,
            type: true,
            dose: true,
            route: true,
            batch: true,
            expiresAt: true,
            costPerDose: true,
            withdrawalDays: true,
          },
        })
      : Promise.resolve(null),
    parsed.data.scheduleId
      ? farmDb.animalVaccinationSchedule.findFirst({
          where: { id: parsed.data.scheduleId, farmId: context.farm.id, archivedAt: null },
          select: { id: true, productId: true, species: true, breed: true, animalGroupId: true, firstDueAt: true },
        })
      : Promise.resolve(null),
  ]);
  if (parsed.data.animalId && !animal) return invalid("Choose an active tagged animal from this farm.");
  if (parsed.data.animalGroupId && !group) return invalid("Choose an active animal group from this farm.");
  if (parsed.data.healthCaseId && !healthCase) return invalid("Choose an open health case for the same animal or group.");
  if (parsed.data.productId && !product) return invalid("Choose an active vaccine or medicine from this farm.");
  if (parsed.data.scheduleId && !schedule) return invalid("Choose an active vaccination schedule from this farm.");
  if (product && product.expiresAt && product.expiresAt.getTime() < administeredAt.getTime()) {
    return invalid("This vaccine or medicine batch was expired on the recorded administration date.");
  }
  if (schedule) {
    const species = animal?.species ?? group?.species;
    if (
      parsed.data.type !== AnimalHealthRecordType.VACCINATION ||
      schedule.productId !== product?.id ||
      schedule.animalGroupId && schedule.animalGroupId !== group?.id ||
      species?.toLocaleLowerCase() !== schedule.species.toLocaleLowerCase() ||
      schedule.breed && schedule.breed.toLocaleLowerCase() !== animal?.breed?.toLocaleLowerCase() ||
      group && !schedule.firstDueAt
    ) {
      return invalid("The selected vaccination schedule does not match this record.");
    }
  }
  if (
    parsed.data.type === AnimalHealthRecordType.VACCINATION &&
    product?.type !== AnimalHealthProductType.VACCINE
  ) return invalid("Vaccination records require a vaccine product.");

  const withdrawalDays = product?.withdrawalDays ?? 0;
  const withdrawalUntil = withdrawalDays > 0
    ? new Date(administeredAt.getTime() + withdrawalDays * 86_400_000)
    : null;
  try {
    const created = await farmDb.$transaction(async (tx) => {
      if (parsed.data.offlineId && await tx.animalHealthRecord.findFirst({
        where: { farmId: context.farm.id, offlineId: parsed.data.offlineId },
        select: { id: true },
      })) return false;
      await tx.animalHealthRecord.create({
        data: {
          farmId: context.farm.id,
          animalId: animal?.id ?? null,
          animalGroupId: group?.id ?? null,
          healthCaseId: healthCase?.id ?? null,
          productId: product?.id ?? null,
          scheduleId: schedule?.id ?? null,
          type: parsed.data.type,
          administeredAt,
          dose: parsed.data.dose ?? product?.dose,
          route: parsed.data.route ?? product?.route,
          batch: parsed.data.batch ?? product?.batch,
          cost: parsed.data.cost ?? product?.costPerDose,
          withdrawalDays,
          withdrawalUntil,
          notes: parsed.data.notes,
          offlineId: parsed.data.offlineId ?? null,
        },
      });
      return true;
    });
    if (!created) return { message: "Animal health record already synced.", success: true };
  } catch (error) {
    if (
      parsed.data.offlineId &&
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002" &&
      await farmDb.animalHealthRecord.findFirst({
        where: { farmId: context.farm.id, offlineId: parsed.data.offlineId },
        select: { id: true },
      })
    ) return { message: "Animal health record already synced.", success: true };
    const databaseMessage = message(error);
    if (databaseMessage) return invalid(databaseMessage);
    throw error;
  }
  revalidatePath("/");
  return { message: "Animal health record saved.", success: true };
}

export async function recordAnimalHealthCaseAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const context = await signedInFarm();
  if (!context) return invalid("Your session expired. Sign in again.");
  const parsed = z.object({
    animalId: optionalText,
    animalGroupId: optionalText,
    symptoms: z.string().trim().min(2).max(2000),
    diagnosis: z.preprocess(
      (input) => (typeof input === "string" && input.trim() === "" ? undefined : input),
      z.string().trim().max(2000).optional(),
    ),
    diagnosedBy: optionalText,
    outcome: z.preprocess(
      (input) => (typeof input === "string" && input.trim() === "" ? undefined : input),
      z.string().trim().max(2000).optional(),
    ),
    openedAt: z.string().optional(),
    offlineId: optionalText,
  }).safeParse({
    animalId: value(formData, "animalId"),
    animalGroupId: value(formData, "animalGroupId"),
    symptoms: value(formData, "symptoms"),
    diagnosis: value(formData, "diagnosis"),
    diagnosedBy: value(formData, "diagnosedBy"),
    outcome: value(formData, "outcome"),
    openedAt: value(formData, "openedAt"),
    offlineId: value(formData, "offlineId"),
  });
  if (
    !parsed.success ||
    Boolean(parsed.data.animalId) === Boolean(parsed.data.animalGroupId) ||
    dateError(parsed.data.openedAt ?? "")
  ) return invalid("Choose one animal or group and enter symptoms and a valid date.");
  const farmDb = tenantDb(context.farm.id, context.user.id);
  if (parsed.data.offlineId && await farmDb.animalHealthCase.findFirst({
    where: { farmId: context.farm.id, offlineId: parsed.data.offlineId },
    select: { id: true },
  })) return { message: "Animal health case already synced.", success: true };
  const [animal, group] = await Promise.all([
    parsed.data.animalId
      ? farmDb.animal.findFirst({
          where: { id: parsed.data.animalId, farmId: context.farm.id, archivedAt: null, status: "ACTIVE" },
          select: { id: true },
        })
      : Promise.resolve(null),
    parsed.data.animalGroupId
      ? farmDb.animalGroup.findFirst({
          where: { id: parsed.data.animalGroupId, farmId: context.farm.id, archivedAt: null },
          select: { id: true },
        })
      : Promise.resolve(null),
  ]);
  if (parsed.data.animalId && !animal) return invalid("Choose an active tagged animal from this farm.");
  if (parsed.data.animalGroupId && !group) return invalid("Choose an active animal group from this farm.");
  const openedAt = optionalDate(parsed.data.openedAt ?? "") ?? new Date();
  if (openedAt.getTime() > Date.now()) return invalid("Health case date must not be in the future.");
  try {
    await farmDb.animalHealthCase.create({
      data: {
        farmId: context.farm.id,
        animalId: animal?.id ?? null,
        animalGroupId: group?.id ?? null,
        symptoms: parsed.data.symptoms,
        diagnosis: parsed.data.diagnosis,
        diagnosedBy: parsed.data.diagnosedBy,
        outcome: parsed.data.outcome,
        openedAt,
        offlineId: parsed.data.offlineId ?? null,
      },
    });
    revalidatePath("/");
    return { message: "Animal health case recorded.", success: true };
  } catch (error) {
    if (
      parsed.data.offlineId &&
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002" &&
      await farmDb.animalHealthCase.findFirst({
        where: { farmId: context.farm.id, offlineId: parsed.data.offlineId },
        select: { id: true },
      })
    ) return { message: "Animal health case already synced.", success: true };
    const databaseMessage = message(error);
    if (databaseMessage) return invalid(databaseMessage);
    throw error;
  }
}

export async function resolveAnimalHealthCaseAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const context = await signedInFarm();
  if (!context) return invalid("Your session expired. Sign in again.");
  const id = value(formData, "id");
  if (!id) return invalid("Choose a health case to resolve.");
  const farmDb = tenantDb(context.farm.id, context.user.id);
  const healthCase = await farmDb.animalHealthCase.findFirst({
    where: { id, farmId: context.farm.id, resolvedAt: null },
    select: { id: true },
  });
  if (!healthCase) return invalid("That open health case was not found in this farm.");
  try {
    await farmDb.animalHealthCase.update({
      where: { id: healthCase.id },
      data: { resolvedAt: new Date() },
    });
  } catch (error) {
    const databaseMessage = message(error);
    if (databaseMessage) return invalid(databaseMessage);
    throw error;
  }
  revalidatePath("/");
  return { message: "Animal health case resolved.", success: true };
}

export async function recordAnimalPerformanceAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const context = await signedInFarm();
  if (!context) return invalid("Your session expired. Sign in again.");
  const parsed = z.object({
    animalId: optionalText,
    animalGroupId: optionalText,
    type: z.nativeEnum(AnimalPerformanceType),
    quantity: positiveNumber,
    unit: z.string().trim().min(1).max(20),
    recordedAt: z.string().optional(),
    notes: optionalText,
    offlineId: optionalText,
  }).safeParse({
    animalId: value(formData, "animalId"),
    animalGroupId: value(formData, "animalGroupId"),
    type: value(formData, "type"),
    quantity: value(formData, "quantity"),
    unit: value(formData, "unit"),
    recordedAt: value(formData, "recordedAt"),
    notes: value(formData, "notes"),
    offlineId: value(formData, "offlineId"),
  });
  if (
    !parsed.success ||
    Boolean(parsed.data.animalId) === Boolean(parsed.data.animalGroupId) ||
    dateError(parsed.data.recordedAt ?? "")
  ) return invalid("Choose one animal or group and enter a positive measurement, unit, and date.");
  const farmDb = tenantDb(context.farm.id, context.user.id);
  if (parsed.data.offlineId && await farmDb.animalPerformanceRecord.findFirst({
    where: { farmId: context.farm.id, offlineId: parsed.data.offlineId },
    select: { id: true },
  })) return { message: "Animal performance record already synced.", success: true };
  const [animal, group] = await Promise.all([
    parsed.data.animalId
      ? farmDb.animal.findFirst({
          where: { id: parsed.data.animalId, farmId: context.farm.id, archivedAt: null, status: "ACTIVE" },
          select: { id: true },
        })
      : Promise.resolve(null),
    parsed.data.animalGroupId
      ? farmDb.animalGroup.findFirst({
          where: { id: parsed.data.animalGroupId, farmId: context.farm.id, archivedAt: null },
          select: { id: true },
        })
      : Promise.resolve(null),
  ]);
  if (parsed.data.animalId && !animal) return invalid("Choose an active tagged animal from this farm.");
  if (parsed.data.animalGroupId && !group) return invalid("Choose an active animal group from this farm.");
  const recordedAt = optionalDate(parsed.data.recordedAt ?? "") ?? new Date();
  if (recordedAt.getTime() > Date.now()) return invalid("Performance record date must not be in the future.");
  try {
    await farmDb.animalPerformanceRecord.create({
      data: {
        farmId: context.farm.id,
        animalId: animal?.id ?? null,
        animalGroupId: group?.id ?? null,
        type: parsed.data.type,
        quantity: parsed.data.quantity,
        unit: parsed.data.unit,
        recordedAt,
        notes: parsed.data.notes,
        offlineId: parsed.data.offlineId ?? null,
      },
    });
    revalidatePath("/");
    return { message: "Animal performance record saved.", success: true };
  } catch (error) {
    if (
      parsed.data.offlineId &&
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002" &&
      await farmDb.animalPerformanceRecord.findFirst({
        where: { farmId: context.farm.id, offlineId: parsed.data.offlineId },
        select: { id: true },
      })
    ) return { message: "Animal performance record already synced.", success: true };
    const databaseMessage = message(error);
    if (databaseMessage) return invalid(databaseMessage);
    throw error;
  }
}
