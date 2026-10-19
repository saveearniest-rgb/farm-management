import "server-only";

import { cookies } from "next/headers";
import { auth } from "@/auth";
import { db } from "@/lib/db";

const FARM_COOKIE = "farm_workspace";

export async function getAppContext() {
  const cookieStore = await cookies();
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return null;

  const user = await db.user.findUnique({
    where: { id: userId },
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
              areaUnit: true,
              totalAreaValue: true,
              totalAreaUnit: true,
              timezone: true,
              nationalFarmerId: true,
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

  const farmData = {
    ...membership.farm,
    totalAreaValue: membership.farm.totalAreaValue?.toNumber() ?? null,
  };

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      locale: user.locale,
    },
    farm: farmData,
    role: membership.role,
    memberships: user.memberships.map((item) => ({
      ...item,
      farm: {
        ...item.farm,
        totalAreaValue: item.farm.totalAreaValue?.toNumber() ?? null,
      },
    })),
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
