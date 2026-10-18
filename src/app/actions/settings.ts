"use server";

import { DataRequestType, FarmRole, Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAppContext, switchWorkspace } from "@/lib/auth";
import { db } from "@/lib/db";
import type { FormState } from "@/lib/form-state";

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

export async function createWorkspaceAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const context = await getAppContext();
  if (!context) return invalid("Your session expired. Sign in again.");
  const parsed = z.object({
    name: z.string().trim().min(2).max(100),
    region: z.string().trim().max(100).optional(),
    district: z.string().trim().max(100).optional(),
    currency: z.enum(["TZS", "USD"]),
  }).safeParse({
    name: value(formData, "name"),
    region: value(formData, "region"),
    district: value(formData, "district"),
    currency: value(formData, "currency"),
  });
  if (!parsed.success) return invalid("Enter a farm name and choose a currency.");

  try {
    const farm = await db.farm.create({
      data: {
        name: parsed.data.name,
        region: parsed.data.region || null,
        district: parsed.data.district || null,
        currency: parsed.data.currency,
        members: { create: { userId: context.user.id, role: FarmRole.OWNER } },
      },
      select: { id: true },
    });
    const switched = await switchWorkspace(farm.id);
    if (!switched) return invalid("Workspace was created, but your membership could not be selected.");
  } catch (error) {
    const setupMessage = databaseSetupMessage(error);
    if (setupMessage) return invalid(setupMessage);
    throw error;
  }
  revalidatePath("/");
  return { message: "Farm workspace created and selected.", success: true };
}

export async function addFarmMemberAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const context = await getAppContext();
  if (!context) return invalid("Your session expired. Sign in again.");
  if (context.role !== FarmRole.OWNER) {
    return invalid("Only the farm owner can add a farm manager.");
  }

  const parsed = z.email().trim().toLowerCase().safeParse(value(formData, "email"));
  if (!parsed.success) return invalid("Enter a valid email address.");

  try {
    const user = await db.user.findUnique({
      where: { email: parsed.data },
      select: { id: true },
    });
    if (!user) return invalid("That user needs to create an account before joining this farm.");

    const existingMembership = await db.farmMember.findUnique({
      where: { farmId_userId: { farmId: context.farm.id, userId: user.id } },
      select: { id: true },
    });
    if (existingMembership) return invalid("That user is already a member of this farm.");

    await db.farmMember.create({
      data: {
        farmId: context.farm.id,
        userId: user.id,
        role: FarmRole.MANAGER,
      },
    });
  } catch (error) {
    const setupMessage = databaseSetupMessage(error);
    if (setupMessage) return invalid(setupMessage);
    throw error;
  }

  revalidatePath("/");
  return { message: "Farm manager added.", success: true };
}

export async function updateFarmSettingsAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const context = await getAppContext();
  if (!context) return invalid("Your session expired. Sign in again.");
  if (context.role !== FarmRole.OWNER) return invalid("Only the farm owner can change farm settings.");
  const parsed = z.object({
    name: z.string().trim().min(2).max(100),
    region: z.string().trim().max(100).optional(),
    district: z.string().trim().max(100).optional(),
    currency: z.enum(["TZS", "USD"]),
  }).safeParse({
    name: value(formData, "name"),
    region: value(formData, "region"),
    district: value(formData, "district"),
    currency: value(formData, "currency"),
  });
  if (!parsed.success) return invalid("Enter a farm name and choose TZS or USD.");

  await db.farm.update({
    where: { id: context.farm.id },
    data: {
      name: parsed.data.name,
      region: parsed.data.region || null,
      district: parsed.data.district || null,
      currency: parsed.data.currency,
    },
  });
  revalidatePath("/");
  return { message: "Farm settings updated.", success: true };
}

export async function recordBenchmarkConsentAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const context = await getAppContext();
  if (!context) return invalid("Your session expired. Sign in again.");
  const choice = value(formData, "choice");
  if (choice !== "grant" && choice !== "withdraw") {
    return invalid("Choose whether to allow anonymised benchmark use.");
  }

  try {
    await db.consentRecord.create({
      data: {
        farmId: context.farm.id,
        userId: context.user.id,
        purpose: "anonymised_farm_benchmarks",
        policyVersion: "benchmark-sharing-v1",
        granted: choice === "grant",
        withdrawnAt: choice === "withdraw" ? new Date() : null,
      },
    });
  } catch (error) {
    const setupMessage = databaseSetupMessage(error);
    if (setupMessage) return invalid(setupMessage);
    throw error;
  }
  revalidatePath("/");
  return {
    message: choice === "grant"
      ? "Your optional benchmark-sharing choice was recorded."
      : "Your benchmark-sharing choice was withdrawn.",
    success: true,
  };
}

export async function requestDataAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const context = await getAppContext();
  if (!context) return invalid("Your session expired. Sign in again.");
  const type = value(formData, "type");
  if (type !== DataRequestType.EXPORT && type !== DataRequestType.DELETION) {
    return invalid("Choose an export or deletion request.");
  }

  try {
    await db.dataRequest.create({
      data: {
        farmId: context.farm.id,
        userId: context.user.id,
        type,
      },
    });
  } catch (error) {
    const setupMessage = databaseSetupMessage(error);
    if (setupMessage) return invalid(setupMessage);
    throw error;
  }
  revalidatePath("/");
  return {
    message: type === DataRequestType.EXPORT
      ? "Export request recorded. Your farm export is available from the settings page."
      : "Deletion request recorded. Data will not be removed automatically; the request needs review.",
    success: true,
  };
}
