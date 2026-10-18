import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { db } from "@/lib/db";

const SESSION_COOKIE = "farm_session";
const FARM_COOKIE = "farm_workspace";
const SESSION_LIFETIME_SECONDS = 60 * 60 * 24 * 30;

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: string, farmId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(
    Date.now() + SESSION_LIFETIME_SECONDS * 1000,
  );

  await db.session.create({
    data: {
      tokenHash: hashToken(token),
      userId,
      expiresAt,
    },
  });

  const cookieStore = await cookies();
  const secure = process.env.NODE_ENV === "production";
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
  cookieStore.set(FARM_COOKIE, farmId, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (token) {
    await db.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  }

  cookieStore.delete(SESSION_COOKIE);
  cookieStore.delete(FARM_COOKIE);
}

export async function getAppContext() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await db.session.findFirst({
    where: { tokenHash: hashToken(token), expiresAt: { gt: new Date() } },
    select: { userId: true },
  });
  if (!session) return null;

  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      name: true,
      email: true,
      locale: true,
      memberships: {
        orderBy: { createdAt: "asc" },
        select: {
          role: true,
          farm: {
            select: {
              id: true,
              name: true,
              region: true,
              district: true,
              currency: true,
            },
          },
        },
      },
    },
  });
  if (!user || user.memberships.length === 0) return null;

  const selectedFarmId = cookieStore.get(FARM_COOKIE)?.value;
  const membership =
    user.memberships.find((item) => item.farm.id === selectedFarmId) ??
    user.memberships[0];
  if (!membership) return null;

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      locale: user.locale,
    },
    farm: membership.farm,
    role: membership.role,
    memberships: user.memberships,
  };
}

export async function switchWorkspace(farmId: string) {
  const context = await getAppContext();
  if (!context) return false;

  const membership = context.memberships.find(
    (item) => item.farm.id === farmId,
  );
  if (!membership) return false;

  const cookieStore = await cookies();
  cookieStore.set(FARM_COOKIE, farmId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });
  return true;
}
