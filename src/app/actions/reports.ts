"use server";

import { ExpenseCategory, FarmRole, PlanScenario, Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAppContext } from "@/lib/auth";
import { tenantDb } from "@/lib/tenant-db";
import type { FormState } from "@/lib/form-state";

const optionalNumber = z.preprocess(
  (value) => (value === "" || value === null || value === undefined ? undefined : value),
  z.coerce.number().finite().optional(),
);

function value(formData: FormData, key: string) {
  const field = formData.get(key);
  return typeof field === "string" ? field.trim() : "";
}

function invalid(message: string): FormState {
  return { message };
}

function databaseSetupMessage(error: unknown) {
  if (
    error instanceof Prisma.PrismaClientInitializationError ||
    (error instanceof Prisma.PrismaClientKnownRequestError &&
      ["P1001", "P1003", "P1010", "P2021", "P2022"].includes(error.code))
  ) {
    return "Database setup is incomplete. Configure PostgreSQL and run npm run db:migrate.";
  }
  return null;
}

export async function savePlanAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const context = await getAppContext();
  if (!context) return invalid("Your session expired. Sign in again.");
  if (context.role !== FarmRole.OWNER) return invalid("Only a farm owner can manage crop economics plans.");
  const parsed = z.object({
    cycleId: z.string().min(1),
    scenario: z.nativeEnum(PlanScenario),
    areaAcres: z.coerce.number().finite().positive(),
    seedGrams: optionalNumber,
    seedsPerGram: optionalNumber,
    germinationRate: optionalNumber,
    survivalRate: optionalNumber,
    plantsPerAcre: optionalNumber,
    yieldPerPlant: optionalNumber,
    yieldUnit: z.string().trim().min(1).max(20),
    farmgatePrice: optionalNumber,
    harvestMonth: optionalNumber,
    costLines: z.string().max(5000),
    notes: z.string().trim().max(2000).optional(),
  }).safeParse({
    cycleId: value(formData, "cycleId"),
    scenario: value(formData, "scenario"),
    areaAcres: value(formData, "areaAcres"),
    seedGrams: value(formData, "seedGrams"),
    seedsPerGram: value(formData, "seedsPerGram"),
    germinationRate: value(formData, "germinationRate"),
    survivalRate: value(formData, "survivalRate"),
    plantsPerAcre: value(formData, "plantsPerAcre"),
    yieldPerPlant: value(formData, "yieldPerPlant"),
    yieldUnit: value(formData, "yieldUnit") || "kg",
    farmgatePrice: value(formData, "farmgatePrice"),
    harvestMonth: value(formData, "harvestMonth"),
    costLines: value(formData, "costLines"),
    notes: value(formData, "notes"),
  });
  if (!parsed.success) {
    return invalid("Enter a cycle, positive area, and valid plan assumptions.");
  }
  const rates = [parsed.data.germinationRate, parsed.data.survivalRate];
  if (
    rates.some((rate) => rate !== undefined && (rate < 0 || rate > 1)) ||
    [parsed.data.seedGrams, parsed.data.seedsPerGram, parsed.data.plantsPerAcre,
      parsed.data.yieldPerPlant, parsed.data.farmgatePrice].some(
      (number) => number !== undefined && number < 0,
    ) ||
    (parsed.data.harvestMonth !== undefined &&
      (!Number.isInteger(parsed.data.harvestMonth) ||
        parsed.data.harvestMonth < 1 ||
        parsed.data.harvestMonth > 12))
  ) {
    return invalid("Rates must be 0–1, amounts cannot be negative, and months must be 1–12.");
  }

  const lines: Array<{
    category: ExpenseCategory;
    amount: number;
    currency: string;
    timingMonth: number | null;
    figureLabel: "PLACEHOLDER_BENCHMARK";
  }> = [];
  for (const line of parsed.data.costLines.split(/\r?\n/).filter(Boolean)) {
    const [category, amountText, monthText] = line.split("|").map((part) => part.trim());
    const amount = Number(amountText);
    const month = monthText ? Number(monthText) : null;
    if (
      !Object.values(ExpenseCategory).includes(category as ExpenseCategory) ||
      !Number.isFinite(amount) ||
      amount < 0 ||
      (month !== null && (!Number.isInteger(month) || month < 1 || month > 12))
    ) {
      return invalid("Check plan costs: use CATEGORY | amount | month (1–12).");
    }
    lines.push({
      category: category as ExpenseCategory,
      amount,
      currency: context.farm.currency,
      timingMonth: month,
      figureLabel: "PLACEHOLDER_BENCHMARK",
    });
  }

  const cycle = await tenantDb(context.farm.id, context.user.id).cropCycle.findFirst({
    where: { id: parsed.data.cycleId, farmId: context.farm.id },
    select: { id: true },
  });
  if (!cycle) return invalid("Choose a crop cycle from this farm.");

  try {
    await tenantDb(context.farm.id, context.user.id).$transaction(async (tx) => {
      const plan = await tx.cropPlan.upsert({
        where: {
          cycleId_scenario: {
            cycleId: parsed.data.cycleId,
            scenario: parsed.data.scenario,
          },
        },
        create: {
          farmId: context.farm.id,
          cycleId: parsed.data.cycleId,
          scenario: parsed.data.scenario,
          areaAcres: parsed.data.areaAcres,
          seedGrams: parsed.data.seedGrams,
          seedsPerGram: parsed.data.seedsPerGram,
          germinationRate: parsed.data.germinationRate,
          survivalRate: parsed.data.survivalRate,
          plantsPerAcre: parsed.data.plantsPerAcre,
          yieldPerPlant: parsed.data.yieldPerPlant,
          yieldUnit: parsed.data.yieldUnit,
          farmgatePrice: parsed.data.farmgatePrice,
          harvestMonth: parsed.data.harvestMonth,
          currency: context.farm.currency,
          figureLabel: "PLACEHOLDER_BENCHMARK",
          notes: parsed.data.notes || null,
        },
        update: {
          areaAcres: parsed.data.areaAcres,
          seedGrams: parsed.data.seedGrams,
          seedsPerGram: parsed.data.seedsPerGram,
          germinationRate: parsed.data.germinationRate,
          survivalRate: parsed.data.survivalRate,
          plantsPerAcre: parsed.data.plantsPerAcre,
          yieldPerPlant: parsed.data.yieldPerPlant,
          yieldUnit: parsed.data.yieldUnit,
          farmgatePrice: parsed.data.farmgatePrice,
          harvestMonth: parsed.data.harvestMonth,
          currency: context.farm.currency,
          figureLabel: "PLACEHOLDER_BENCHMARK",
          notes: parsed.data.notes || null,
        },
        select: { id: true },
      });
      await tx.cropPlanLine.deleteMany({
        where: { planId: plan.id, farmId: context.farm.id },
      });
      if (lines.length > 0) {
        await tx.cropPlanLine.createMany({
          data: lines.map((line) => ({ ...line, planId: plan.id, farmId: context.farm.id })),
        });
      }
    });
  } catch (error) {
    const setupMessage = databaseSetupMessage(error);
    if (setupMessage) return invalid(setupMessage);
    throw error;
  }
  revalidatePath("/");
  return { message: "Plan assumptions saved. All figures are marked as placeholders until verified.", success: true };
}

export async function recordHarvestAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const context = await getAppContext();
  if (!context) return invalid("Your session expired. Sign in again.");
  if (context.role !== FarmRole.OWNER) return invalid("Only a farm owner can record harvest quantities.");
  const harvestedAt = value(formData, "harvestedAt");
  const parsed = z.object({
    cycleId: z.string().min(1),
    quantity: z.coerce.number().finite().positive(),
    unit: z.string().trim().min(1).max(20),
    grade: z.string().trim().max(80).optional(),
    lossQty: optionalNumber,
    notes: z.string().trim().max(1000).optional(),
    harvestedAt: z.string().optional(),
  }).safeParse({
    cycleId: value(formData, "cycleId"),
    quantity: value(formData, "quantity"),
    unit: value(formData, "unit") || "kg",
    grade: value(formData, "grade"),
    lossQty: value(formData, "lossQty"),
    notes: value(formData, "notes"),
    harvestedAt,
  });
  if (!parsed.success || (parsed.data.lossQty !== undefined && parsed.data.lossQty < 0)) {
    return invalid("Enter a valid harvested quantity and loss.");
  }
  const cycle = await tenantDb(context.farm.id, context.user.id).cropCycle.findFirst({
    where: { id: parsed.data.cycleId, farmId: context.farm.id },
    select: { id: true, yieldUnit: true },
  });
  if (!cycle) return invalid("Choose a crop cycle from this farm.");
  if (cycle.yieldUnit !== parsed.data.unit) {
    return invalid(`Use the crop cycle's yield unit (${cycle.yieldUnit}) for harvest entries.`);
  }
  const date = harvestedAt ? new Date(`${harvestedAt}T12:00:00`) : new Date();
  if (Number.isNaN(date.getTime())) return invalid("Enter a valid harvest date.");

  try {
    await tenantDb(context.farm.id, context.user.id).$transaction(async (tx) => {
      await tx.harvest.create({
        data: {
          farmId: context.farm.id,
          cycleId: cycle.id,
          quantity: parsed.data.quantity,
          unit: parsed.data.unit,
          grade: parsed.data.grade || null,
          lossQty: parsed.data.lossQty,
          notes: parsed.data.notes || null,
          harvestedAt: date,
        },
      });
      const total = await tx.harvest.aggregate({
        where: { farmId: context.farm.id, cycleId: cycle.id },
        _sum: { quantity: true },
      });
      await tx.cropCycle.update({
        where: { id: cycle.id },
        data: { actualYield: total._sum.quantity },
      });
    });
  } catch (error) {
    const setupMessage = databaseSetupMessage(error);
    if (setupMessage) return invalid(setupMessage);
    throw error;
  }
  revalidatePath("/");
  return { message: "Harvest recorded and actual yield updated.", success: true };
}

export async function recordSaleAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const context = await getAppContext();
  if (!context) return invalid("Your session expired. Sign in again.");
  if (context.role !== FarmRole.OWNER) return invalid("Only a farm owner can record sale prices.");
  const soldAt = value(formData, "soldAt");
  const parsed = z.object({
    cycleId: z.string().min(1),
    quantity: z.coerce.number().finite().positive(),
    unit: z.string().trim().min(1).max(20),
    price: z.coerce.number().finite().nonnegative(),
    buyer: z.string().trim().max(120).optional(),
    notes: z.string().trim().max(1000).optional(),
    soldAt: z.string().optional(),
  }).safeParse({
    cycleId: value(formData, "cycleId"),
    quantity: value(formData, "quantity"),
    unit: value(formData, "unit") || "kg",
    price: value(formData, "price"),
    buyer: value(formData, "buyer"),
    notes: value(formData, "notes"),
    soldAt,
  });
  if (!parsed.success) return invalid("Enter a valid sold quantity and price.");
  const cycle = await tenantDb(context.farm.id, context.user.id).cropCycle.findFirst({
    where: { id: parsed.data.cycleId, farmId: context.farm.id },
    select: { id: true, yieldUnit: true },
  });
  if (!cycle) return invalid("Choose a crop cycle from this farm.");
  if (cycle.yieldUnit !== parsed.data.unit) {
    return invalid(`Use the crop cycle's yield unit (${cycle.yieldUnit}) for sales.`);
  }
  const date = soldAt ? new Date(`${soldAt}T12:00:00`) : new Date();
  if (Number.isNaN(date.getTime())) return invalid("Enter a valid sale date.");

  try {
    await tenantDb(context.farm.id, context.user.id).sale.create({
      data: {
        farmId: context.farm.id,
        cycleId: cycle.id,
        quantity: parsed.data.quantity,
        unit: parsed.data.unit,
        price: parsed.data.price,
        currency: context.farm.currency,
        buyer: parsed.data.buyer || null,
        notes: parsed.data.notes || null,
        soldAt: date,
      },
    });
  } catch (error) {
    const setupMessage = databaseSetupMessage(error);
    if (setupMessage) return invalid(setupMessage);
    throw error;
  }
  revalidatePath("/");
  return { message: "Sale recorded.", success: true };
}
