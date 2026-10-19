"use server";

import { AuthError } from "next-auth";
import { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { signIn, signOut } from "@/auth";
import { getAppContext, switchWorkspace } from "@/lib/auth";
import { db } from "@/lib/db";
import type { FormState } from "@/lib/form-state";

const signupSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.email().trim().toLowerCase(),
  password: z.string().min(10).max(72),
  farmName: z.string().trim().min(2).max(100),
  region: z.string().trim().max(100).optional(),
  totalAreaValue: z.preprocess(
    (value) => (value === "" || value === null || value === undefined ? undefined : value),
    z.coerce.number().finite().positive().optional(),
  ),
  totalAreaUnit: z.enum(["acre", "hectare"]),
  locale: z.enum(["en", "sw"]),
  redirectTo: z.string().optional(),
});

const loginSchema = z.object({
  email: z.email().trim().toLowerCase(),
  password: z.string().min(1).max(72),
  redirectTo: z.string().optional(),
});

function safeRedirectTo(value: string | undefined) {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/";
}

function databaseSetupMessage(error: unknown) {
  if (
    error instanceof Prisma.PrismaClientInitializationError ||
    (error instanceof Prisma.PrismaClientKnownRequestError &&
      ["P1001", "P1003", "P1010", "P2021", "P2022"].includes(error.code))
  ) {
    return "Database setup is incomplete. Set DATABASE_URL, create the PostgreSQL database, then run npm run db:migrate.";
  }
  return null;
}

export async function signupAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = signupSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    farmName: formData.get("farmName"),
    region: formData.get("region") || undefined,
    totalAreaValue: formData.get("totalAreaValue"),
    totalAreaUnit: formData.get("totalAreaUnit") || "acre",
    locale: formData.get("locale"),
    redirectTo: formData.get("redirectTo") || undefined,
  });
  if (!parsed.success) {
    return { message: "Check your details and use a password of at least 10 characters." };
  }

  try {
    const passwordHash = await bcrypt.hash(parsed.data.password, 12);
    await db.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name: parsed.data.name,
          email: parsed.data.email,
          passwordHash,
          locale: parsed.data.locale,
          memberships: {
            create: {
              role: "OWNER",
              farm: {
                create: {
                  name: parsed.data.farmName,
                  region: parsed.data.region || null,
                  currency: "TZS",
                  totalAreaValue: parsed.data.totalAreaValue,
                  totalAreaUnit: parsed.data.totalAreaUnit,
                },
              },
            },
          },
        },
        select: { id: true, memberships: { select: { farmId: true } } },
      });
      const farmId = user.memberships[0]?.farmId;
      if (!farmId) {
        throw new Error("The farm workspace could not be created for this account.");
      }
      await tx.auditLog.create({
        data: {
          farmId,
          actorUserId: user.id,
          action: "create",
          entity: "Farm",
          recordId: farmId,
        },
      });
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return { message: "An account with this email already exists." };
    }
    const setupMessage = databaseSetupMessage(error);
    if (setupMessage) return { message: setupMessage };
    throw error;
  }

  try {
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirectTo: safeRedirectTo(parsed.data.redirectTo),
    });
  } catch (error) {
    if (error instanceof AuthError) {
      const setupMessage = databaseSetupMessage(error.cause?.err);
      if (setupMessage) return { message: setupMessage };
      return { message: "Your account was created. Sign in to continue." };
    }
    throw error;
  }
  revalidatePath("/");
  return { message: "", success: true };
}

export async function loginAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    redirectTo: formData.get("redirectTo") || undefined,
  });
  if (!parsed.success) {
    return { message: "Enter a valid email and password." };
  }

  try {
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirectTo: safeRedirectTo(parsed.data.redirectTo),
    });
  } catch (error) {
    if (error instanceof AuthError) {
      const setupMessage = databaseSetupMessage(error.cause?.err);
      if (setupMessage) return { message: setupMessage };
      return { message: "Email or password is incorrect." };
    }
    const setupMessage = databaseSetupMessage(error);
    if (setupMessage) return { message: setupMessage };
    throw error;
  }
  revalidatePath("/");
  return { message: "", success: true };
}

export async function logoutAction() {
  await signOut({ redirectTo: "/" });
}

export async function switchWorkspaceAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const farmId = formData.get("farmId");
  if (typeof farmId !== "string" || !(await switchWorkspace(farmId))) {
    return { message: "You do not have access to that farm workspace." };
  }

  revalidatePath("/");
  return { message: "", success: true };
}

export async function changeLocaleAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const context = await getAppContext();
  const locale = formData.get("locale");
  if (!context) return { message: "Your session expired. Sign in again." };
  if (locale !== "en" && locale !== "sw") {
    return { message: "Choose English or Kiswahili." };
  }

  await db.user.update({
    where: { id: context.user.id },
    data: { locale },
  });
  revalidatePath("/");
  return { message: "", success: true };
}
