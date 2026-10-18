"use server";

import { randomBytes } from "node:crypto";
import { DataRequestType, FarmRole, Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getAppContext, switchWorkspace } from "@/lib/auth";
import { db } from "@/lib/db";
import { hashInvitationToken } from "@/lib/invitations";
import { tenantDb } from "@/lib/tenant-db";
import type { FormState } from "@/lib/form-state";

function value(formData: FormData, key: string) {
  const field = formData.get(key);
  return typeof field === "string" ? field.trim() : "";
}

function invalid(message: string): FormState {
  return { message };
}

class InvitationAlreadyClaimedError extends Error {}

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
    areaUnit: z.enum(["acre", "hectare", "square metre"]),
    timezone: z.string().trim().min(1).max(80),
  }).safeParse({
    name: value(formData, "name"),
    region: value(formData, "region"),
    district: value(formData, "district"),
    currency: value(formData, "currency"),
    areaUnit: value(formData, "areaUnit") || "acre",
    timezone: value(formData, "timezone") || "Africa/Dar_es_Salaam",
  });
  if (!parsed.success) return invalid("Enter a farm name and choose a currency.");

  try {
    const farm = await db.$transaction(async (tx) => {
      const createdFarm = await tx.farm.create({
        data: {
          name: parsed.data.name,
          region: parsed.data.region || null,
          district: parsed.data.district || null,
          currency: parsed.data.currency,
          areaUnit: parsed.data.areaUnit,
          timezone: parsed.data.timezone,
          members: { create: { userId: context.user.id, role: FarmRole.OWNER } },
        },
        select: { id: true },
      });
      await tx.auditLog.create({
        data: {
          farmId: createdFarm.id,
          actorUserId: context.user.id,
          action: "create",
          entity: "Farm",
          recordId: createdFarm.id,
        },
      });
      return createdFarm;
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

    const existingMembership = await tenantDb(context.farm.id, context.user.id).farmMember.findUnique({
      where: { farmId_userId: { farmId: context.farm.id, userId: user.id } },
      select: { id: true },
    });
    if (existingMembership) return invalid("That user is already a member of this farm.");

    await tenantDb(context.farm.id, context.user.id).farmMember.create({
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

export async function createManagerInviteAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const context = await getAppContext();
  if (!context) return invalid("Your session expired. Sign in again.");
  if (context.role !== FarmRole.OWNER) {
    return invalid("Only the farm owner can invite a farm manager.");
  }
  const parsedEmail = z.email().trim().toLowerCase().safeParse(value(formData, "email"));
  if (!parsedEmail.success) return invalid("Enter a valid email address.");
  if (parsedEmail.data === context.user.email.toLowerCase()) {
    return invalid("You are already a member of this farm.");
  }
  if (process.env.NODE_ENV === "production" && !process.env.APP_URL) {
    throw new Error("APP_URL must be configured before creating invitation links.");
  }

  const rawToken = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  try {
    await tenantDb(context.farm.id, context.user.id).farmInvitation.create({
      data: {
        farmId: context.farm.id,
        invitedEmail: parsedEmail.data,
        tokenHash: hashInvitationToken(rawToken),
        createdById: context.user.id,
        expiresAt,
      },
    });
  } catch (error) {
    const setupMessage = databaseSetupMessage(error);
    if (setupMessage) return invalid(setupMessage);
    throw error;
  }

  const invitationUrl = new URL(
    `/invite/${rawToken}`,
    process.env.APP_URL ?? "http://localhost:3000",
  ).toString();
  revalidatePath("/");
  return {
    message: "Manager invitation created. Share this one-time link with the invited email address.",
    success: true,
    invitationUrl,
  };
}

export async function acceptFarmInviteAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const context = await getAppContext();
  if (!context) return invalid("Sign in with the email address that received the invitation.");
  const token = value(formData, "token");
  if (!/^[A-Za-z0-9_-]{32,80}$/.test(token)) {
    return invalid("This invitation link is invalid.");
  }
  const invitation = await db.farmInvitation.findUnique({
    where: { tokenHash: hashInvitationToken(token) },
    select: {
      id: true,
      farmId: true,
      invitedEmail: true,
      expiresAt: true,
      acceptedAt: true,
    },
  });
  if (!invitation || invitation.acceptedAt || invitation.expiresAt <= new Date()) {
    return invalid("This invitation has expired or has already been used.");
  }
  if (invitation.invitedEmail !== context.user.email.toLowerCase()) {
    return invalid(`Sign in with ${invitation.invitedEmail} to accept this invitation.`);
  }

  try {
    await tenantDb(invitation.farmId, context.user.id).$transaction(async (tx) => {
      const claimed = await tx.farmInvitation.updateMany({
        where: {
          id: invitation.id,
          invitedEmail: context.user.email.toLowerCase(),
          acceptedAt: null,
          expiresAt: { gt: new Date() },
        },
        data: { acceptedAt: new Date() },
      });
      if (claimed.count !== 1) throw new InvitationAlreadyClaimedError();

      await tx.farmMember.upsert({
        where: {
          farmId_userId: { farmId: invitation.farmId, userId: context.user.id },
        },
        update: { role: FarmRole.MANAGER },
        create: {
          farmId: invitation.farmId,
          userId: context.user.id,
          role: FarmRole.MANAGER,
        },
      });
    });
  } catch (error) {
    if (error instanceof InvitationAlreadyClaimedError) {
      return invalid("This invitation has already been used or expired.");
    }
    const setupMessage = databaseSetupMessage(error);
    if (setupMessage) return invalid(setupMessage);
    throw error;
  }

  const switched = await switchWorkspace(invitation.farmId);
  if (!switched) throw new Error("Invitation was accepted, but the farm workspace could not be selected.");
  revalidatePath("/");
  redirect("/");
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
    areaUnit: z.enum(["acre", "hectare", "square metre"]),
    timezone: z.string().trim().min(1).max(80),
    nationalFarmerId: z.string().trim().max(100).optional(),
  }).safeParse({
    name: value(formData, "name"),
    region: value(formData, "region"),
    district: value(formData, "district"),
    currency: value(formData, "currency"),
    areaUnit: value(formData, "areaUnit"),
    timezone: value(formData, "timezone"),
    nationalFarmerId: value(formData, "nationalFarmerId"),
  });
  if (!parsed.success) return invalid("Enter a farm name and choose TZS or USD.");

  await tenantDb(context.farm.id, context.user.id).farm.update({
    where: { id: context.farm.id },
    data: {
      name: parsed.data.name,
      region: parsed.data.region || null,
      district: parsed.data.district || null,
      currency: parsed.data.currency,
      areaUnit: parsed.data.areaUnit,
      timezone: parsed.data.timezone,
      nationalFarmerId: parsed.data.nationalFarmerId || null,
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
    await tenantDb(context.farm.id, context.user.id).consentRecord.create({
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
    await tenantDb(context.farm.id, context.user.id).dataRequest.create({
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
