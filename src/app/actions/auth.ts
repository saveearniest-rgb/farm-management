"use server";

import { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createSession, destroySession, getAppContext, switchWorkspace } from "@/lib/auth";
import { db } from "@/lib/db";
import type { FormState } from "@/lib/form-state";

const signupSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.email().trim().toLowerCase(),
  password: z.string().min(10).max(72),
  farmName: z.string().trim().min(2).max(100),
  region: z.string().trim().max(100).optional(),
  locale: z.enum(["en", "sw"]),
});

const loginSchema = z.object({
  email: z.email().trim().toLowerCase(),
  password: z.string().min(1).max(72),
});

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
    locale: formData.get("locale"),
  });
  if (!parsed.success) {
    return { message: "Check your details and use a password of at least 10 characters." };
  }

  try {
    const passwordHash = await bcrypt.hash(parsed.data.password, 12);
    const user = await db.user.create({
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

    await createSession(user.id, farmId);
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

  revalidatePath("/");
  redirect("/");
}

export async function loginAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { message: "Enter a valid email and password." };
  }

  try {
    const user = await db.user.findUnique({
      where: { email: parsed.data.email },
      select: {
        id: true,
        passwordHash: true,
        memberships: {
          orderBy: { createdAt: "asc" },
          select: { farmId: true },
        },
      },
    });
    const passwordMatches =
      user && (await bcrypt.compare(parsed.data.password, user.passwordHash));
    const farmId = user?.memberships[0]?.farmId;

    if (!user || !passwordMatches || !farmId) {
      return { message: "Email or password is incorrect." };
    }

    await createSession(user.id, farmId);
  } catch (error) {
    const setupMessage = databaseSetupMessage(error);
    if (setupMessage) return { message: setupMessage };
    throw error;
  }

  revalidatePath("/");
  redirect("/");
}

export async function logoutAction() {
  await destroySession();
  revalidatePath("/");
  redirect("/");
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
