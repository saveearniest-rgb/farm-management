import { afterAll, beforeAll, describe, expect, it } from "vitest";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
process.env.DATABASE_URL ??= testDatabaseUrl ??
  "postgresql://invalid:invalid@127.0.0.1:1/tenant_scope_test";
if (testDatabaseUrl) process.env.DATABASE_URL = testDatabaseUrl;

const { db } = await import("@/lib/db");
const { tenantDb } = await import("@/lib/tenant-db");

const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
let farmAId = "";
let farmBId = "";
let userAId = "";
let userBId = "";
let farmBPlotId = "";
let farmBAnimalGroupId = "";
let farmBAnimalId = "";
let farmBHealthProductId = "";
let farmBPerformanceRecordId = "";

describe.skipIf(!testDatabaseUrl)("farm tenant isolation", () => {
  beforeAll(async () => {
    const [userA, userB] = await Promise.all([
      db.user.create({
        data: {
          email: `tenant-a-${suffix}@example.test`,
          name: "Tenant A",
          passwordHash: "test-only",
        },
        select: { id: true },
      }),
      db.user.create({
        data: {
          email: `tenant-b-${suffix}@example.test`,
          name: "Tenant B",
          passwordHash: "test-only",
        },
        select: { id: true },
      }),
    ]);
    userAId = userA.id;
    userBId = userB.id;
    const [farmA, farmB] = await Promise.all([
      db.farm.create({
        data: {
          name: `Tenant A ${suffix}`,
          members: { create: { userId: userA.id, role: "OWNER" } },
        },
        select: { id: true },
      }),
      db.farm.create({
        data: {
          name: `Tenant B ${suffix}`,
          members: { create: { userId: userB.id, role: "OWNER" } },
        },
        select: { id: true },
      }),
    ]);
    farmAId = farmA.id;
    farmBId = farmB.id;
    const holdingB = await tenantDb(farmB.id, userB.id).landHolding.create({
      data: {
        farmId: farmB.id,
        name: `Farm B holding ${suffix}`,
      },
      select: { id: true },
    });
    const plotB = await tenantDb(farmB.id, userB.id).plot.create({
      data: {
        farmId: farmB.id,
        holdingId: holdingB.id,
        name: `Farm B plot ${suffix}`,
        areaValue: 1,
        areaUnit: "acre",
      },
      select: { id: true },
    });
    farmBPlotId = plotB.id;
    const groupB = await tenantDb(farmB.id, userB.id).animalGroup.create({
      data: {
        farmId: farmB.id,
        name: `Farm B animals ${suffix}`,
        species: "test species",
        startingCount: 2,
      },
      select: { id: true },
    });
    farmBAnimalGroupId = groupB.id;
    const animalB = await tenantDb(farmB.id, userB.id).animal.create({
      data: {
        farmId: farmB.id,
        tagNumber: `tag-${suffix}`,
        species: "test species",
        groupId: groupB.id,
      },
      select: { id: true },
    });
    farmBAnimalId = animalB.id;
    const healthProductB = await tenantDb(farmB.id, userB.id).animalHealthProduct.create({
      data: {
        farmId: farmB.id,
        name: `Farm B vaccine ${suffix}`,
        type: "VACCINE",
        withdrawalDays: 0,
      },
      select: { id: true },
    });
    farmBHealthProductId = healthProductB.id;
    const performanceRecordB = await tenantDb(farmB.id, userB.id).animalPerformanceRecord.create({
      data: {
        farmId: farmB.id,
        animalId: animalB.id,
        type: "WEIGHT",
        quantity: 20,
        unit: "kg",
      },
      select: { id: true },
    });
    farmBPerformanceRecordId = performanceRecordB.id;
  }, 60_000);

  afterAll(async () => {
    if (farmAId || farmBId) {
      await db.farm.deleteMany({ where: { id: { in: [farmAId, farmBId].filter(Boolean) } } });
    }
    if (userAId || userBId) {
      await db.user.deleteMany({ where: { id: { in: [userAId, userBId].filter(Boolean) } } });
    }
    await db.$disconnect();
  });

  it("blocks cross-farm reads and writes and stamps writes with the session farm", async () => {
    const farmA = tenantDb(farmAId, userAId);
    const hiddenPlot = await farmA.plot.findFirst({
      where: { id: farmBPlotId, farmId: farmBId },
    });
    const changedPlots = await farmA.plot.updateMany({
      where: { id: farmBPlotId, farmId: farmBId },
      data: { name: "cross-tenant overwrite" },
    });
    const hiddenAnimalGroup = await farmA.animalGroup.findFirst({
      where: { id: farmBAnimalGroupId, farmId: farmBId },
    });
    const changedAnimalGroups = await farmA.animalGroup.updateMany({
      where: { id: farmBAnimalGroupId, farmId: farmBId },
      data: { name: "cross-tenant overwrite" },
    });
    const hiddenAnimal = await farmA.animal.findFirst({
      where: { id: farmBAnimalId, farmId: farmBId },
    });
    const changedAnimals = await farmA.animal.updateMany({
      where: { id: farmBAnimalId, farmId: farmBId },
      data: { status: "DEAD" },
    });
    const hiddenHealthProduct = await farmA.animalHealthProduct.findFirst({
      where: { id: farmBHealthProductId, farmId: farmBId },
    });
    const changedHealthProducts = await farmA.animalHealthProduct.updateMany({
      where: { id: farmBHealthProductId, farmId: farmBId },
      data: { name: "cross-tenant overwrite" },
    });
    const hiddenPerformanceRecord = await farmA.animalPerformanceRecord.findFirst({
      where: { id: farmBPerformanceRecordId, farmId: farmBId },
    });
    const changedPerformanceRecords = await farmA.animalPerformanceRecord.updateMany({
      where: { id: farmBPerformanceRecordId, farmId: farmBId },
      data: { quantity: 999 },
    });
    const stampedHolding = await farmA.landHolding.create({
      data: {
        farmId: farmBId,
        name: `Attempted cross-tenant create ${suffix}`,
      },
      select: { farmId: true, id: true },
    });

    expect(hiddenPlot).toBeNull();
    expect(changedPlots.count).toBe(0);
    expect(hiddenAnimalGroup).toBeNull();
    expect(changedAnimalGroups.count).toBe(0);
    expect(hiddenAnimal).toBeNull();
    expect(changedAnimals.count).toBe(0);
    expect(hiddenHealthProduct).toBeNull();
    expect(changedHealthProducts.count).toBe(0);
    expect(hiddenPerformanceRecord).toBeNull();
    expect(changedPerformanceRecords.count).toBe(0);
    expect(stampedHolding.farmId).toBe(farmAId);

    const originalPlot = await db.plot.findUnique({
      where: { id: farmBPlotId },
      select: { name: true },
    });
    expect(originalPlot?.name).toBe(`Farm B plot ${suffix}`);
    const audit = await farmA.auditLog.findFirst({
      where: { entity: "LandHolding", action: "create", recordId: stampedHolding.id },
      select: { farmId: true, actorUserId: true },
    });
    expect(audit).toEqual({ farmId: farmAId, actorUserId: userAId });
  }, 60_000);
});
