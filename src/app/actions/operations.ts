"use server";

import { CropMode, CropReferenceKind, DocumentStatus, ExpenseCategory, FarmRole, PaymentMethod, Prisma, ScoutingSeverity, TaskStatus, TenureType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAppContext } from "@/lib/auth";
import { db } from "@/lib/db";
import { tenantDb } from "@/lib/tenant-db";
import { parseExpenseAllocations } from "@/lib/expense-allocations";
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
    spentAt: z.string().optional(),
    notes: optionalText,
  }).safeParse({
    cycleId: value(formData, "cycleId") || undefined,
    category: value(formData, "category"),
    amount: value(formData, "amount"),
    offlineId: value(formData, "offlineId"),
    allocations: value(formData, "allocations"),
    spentAt,
    notes: value(formData, "notes"),
  });
  if (!parsed.success || dateError(parsed.data.spentAt ?? "")) return invalid("Enter a valid expense and date.");
  if (parsed.data.offlineId && await tenantDb(context.farm.id, context.user.id).expense.findFirst({
    where: { farmId: context.farm.id, offlineId: parsed.data.offlineId }, select: { id: true },
  })) return { message: "Expense already synced.", success: true };
  const allocationText = parsed.data.allocations?.trim() ?? "";
  let allocations: Array<{ cycleId?: string; plotId?: string; amount: number }> = [];
  if (allocationText) {
    const allocationResult = parseExpenseAllocations(allocationText, parsed.data.amount);
    if (!allocationResult.allocations) return invalid(allocationResult.error);
    allocations = allocationResult.allocations;
    const cycleIds = allocations.flatMap((allocation) => allocation.cycleId ? [allocation.cycleId] : []);
    const plotIds = allocations.flatMap((allocation) => allocation.plotId ? [allocation.plotId] : []);
    const [validCycles, validPlots] = await Promise.all([
      cycleIds.length ? tenantDb(context.farm.id, context.user.id).cropCycle.count({
        where: { farmId: context.farm.id, id: { in: cycleIds } },
      }) : 0,
      plotIds.length ? tenantDb(context.farm.id, context.user.id).plot.count({
        where: { farmId: context.farm.id, id: { in: plotIds } },
      }) : 0,
    ]);
    if (validCycles !== new Set(cycleIds).size || validPlots !== new Set(plotIds).size) {
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
