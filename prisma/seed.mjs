import { PrismaClient, FarmRole } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

async function main() {
  const ownerPassword = process.env.DEMO_OWNER_PASSWORD;
  const managerPassword = process.env.DEMO_MANAGER_PASSWORD;
  if (!ownerPassword || !managerPassword) {
    throw new Error(
      "Set DEMO_OWNER_PASSWORD and DEMO_MANAGER_PASSWORD before running the demo seed.",
    );
  }
  if (ownerPassword.length < 10 || managerPassword.length < 10) {
    throw new Error("Demo passwords must contain at least 10 characters.");
  }

  const ownerEmail = (process.env.DEMO_OWNER_EMAIL ?? "owner@example.test").toLowerCase();
  const managerEmail = (process.env.DEMO_MANAGER_EMAIL ?? "manager@example.test").toLowerCase();
  if (ownerEmail === managerEmail) {
    throw new Error("DEMO_OWNER_EMAIL and DEMO_MANAGER_EMAIL must be different.");
  }
  const [ownerHash, managerHash] = await Promise.all([
    bcrypt.hash(ownerPassword, 12),
    bcrypt.hash(managerPassword, 12),
  ]);

  const owner = await db.user.upsert({
    where: { email: ownerEmail },
    update: { name: "Demo Farm Owner", passwordHash: ownerHash },
    create: {
      email: ownerEmail,
      name: "Demo Farm Owner",
      passwordHash: ownerHash,
      memberships: {
        create: {
          role: FarmRole.OWNER,
          farm: {
            create: {
              name: "Demo Farm",
              region: "Demo region (replace with your farm's region)",
              currency: "TZS",
              areaUnit: "acre",
              timezone: "Africa/Dar_es_Salaam",
            },
          },
        },
      },
    },
    select: { id: true },
  });
  let ownerMembership = await db.farmMember.findFirst({
    where: { userId: owner.id, role: FarmRole.OWNER },
    orderBy: { createdAt: "asc" },
    select: { farmId: true },
  });
  if (!ownerMembership) {
    const farm = await db.farm.create({
      data: {
        name: "Demo Farm",
        currency: "TZS",
        members: { create: { userId: owner.id, role: FarmRole.OWNER } },
      },
      select: { id: true },
    });
    ownerMembership = { farmId: farm.id };
  }

  const manager = await db.user.upsert({
    where: { email: managerEmail },
    update: { name: "Demo Farm Manager", passwordHash: managerHash },
    create: {
      email: managerEmail,
      name: "Demo Farm Manager",
      passwordHash: managerHash,
    },
    select: { id: true },
  });
  await db.farmMember.upsert({
    where: {
      farmId_userId: { farmId: ownerMembership.farmId, userId: manager.id },
    },
    update: { role: FarmRole.MANAGER },
    create: {
      farmId: ownerMembership.farmId,
      userId: manager.id,
      role: FarmRole.MANAGER,
    },
  });

  console.info(`Demo owner: ${ownerEmail}`);
  console.info(`Demo manager: ${managerEmail}`);
  console.info("Demo passwords are supplied through environment variables.");
}

main()
  .catch((error) => {
    console.error("Demo seed failed.", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
