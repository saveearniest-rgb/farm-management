import "server-only";

import { db } from "@/lib/db";

const tenantModels = new Set([
  "Farm",
  "FarmMember",
  "LandHolding",
  "Plot",
  "CropType",
  "CropReferenceItem",
  "StageTemplate",
  "CareTemplate",
  "CropCycle",
  "NurseryBatch",
  "NurseryCheck",
  "Transplant",
  "Task",
  "ActivityLog",
  "Worker",
  "WorkEntry",
  "Expense",
  "ExpenseAllocation",
  "MachineJob",
  "Asset",
  "AssetUsage",
  "AssetMaintenance",
  "StockItem",
  "Supplier",
  "StockMovement",
  "CropPlan",
  "CropPlanLine",
  "Harvest",
  "Sale",
  "ConsentRecord",
  "DataRequest",
  "AuditLog",
  "FarmInvitation",
  "TenureDispute",
  "FileAttachment",
  "WeatherLog",
  "ScoutingLog",
  "SprayRecord",
  "CropCycleStage",
  "SubsidyReceipt",
  "Animal",
  "AnimalGroup",
  "AnimalEvent",
  "AnimalDailyRecord",
  "FeedRation",
  "AnimalHealthProduct",
  "AnimalVaccinationSchedule",
  "AnimalHealthCase",
  "AnimalHealthRecord",
  "AnimalPerformanceRecord",
  "AnimalSpeciesProfile",
  "AnimalBreed",
  "AnimalBreedBenchmark",
  "AnimalTraitRecord",
  "AnimalBreedingRecord",
  "AnimalSale",
  "AnimalSalePayment",
  "AnimalSalesForecast",
]);

const readOperations = new Set([
  "findFirst",
  "findFirstOrThrow",
  "findMany",
  "findUnique",
  "findUniqueOrThrow",
  "count",
  "aggregate",
  "groupBy",
]);

const writeOperations = new Set([
  "create",
  "createMany",
  "createManyAndReturn",
  "update",
  "updateMany",
  "updateManyAndReturn",
  "upsert",
  "delete",
  "deleteMany",
]);

type TenantActor = {
  farmId: string;
  actorUserId: string;
};

function scopedArgs(
  input: Record<string, unknown>,
  model: string,
  operation: string,
  farmId: string,
) {
  const scope = model === "Farm" ? { id: farmId } : { farmId };
  const result = { ...input };

  if (readOperations.has(operation) || operation === "update" ||
      operation === "updateMany" || operation === "updateManyAndReturn" ||
      operation === "delete" || operation === "deleteMany") {
    result.where = { ...(input.where as object | undefined), ...scope };
  }

  if (model !== "Farm" && operation === "create") {
    result.data = { ...(input.data as object | undefined), farmId };
  } else if (model !== "Farm" &&
      (operation === "createMany" || operation === "createManyAndReturn")) {
    const data = input.data;
    result.data = Array.isArray(data)
      ? data.map((row) => ({ ...(row as object), farmId }))
      : { ...(data as object), farmId };
  } else if (model !== "Farm" && operation === "upsert") {
    result.create = { ...(input.create as object | undefined), farmId };
    result.update = { ...(input.update as object | undefined), farmId };
    result.where = { ...(input.where as object | undefined), ...scope };
  }

  return result;
}

function recordId(args: Record<string, unknown>, result: unknown) {
  if (typeof result === "object" && result !== null && "id" in result &&
      typeof result.id === "string") {
    return result.id;
  }
  const where = args.where;
  if (typeof where === "object" && where !== null && "id" in where &&
      typeof where.id === "string") {
    return where.id;
  }
  return null;
}

export async function writeAuditLog({
  farmId,
  actorUserId,
  action,
  entity,
  recordId: id,
}: TenantActor & {
  action: string;
  entity: string;
  recordId?: string | null;
}) {
  await db.auditLog.create({
    data: {
      farmId,
      actorUserId,
      action,
      entity,
      recordId: id ?? null,
    },
  });
}

export function tenantDb(farmId: string, actorUserId: string) {
  return db.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!model || !tenantModels.has(model)) return query(args);

          const baseArgs = args as Record<string, unknown>;
          const safeArgs = scopedArgs(baseArgs, model, operation, farmId);
          const result = await query(safeArgs as typeof args);

          if (model !== "AuditLog" && writeOperations.has(operation)) {
            await writeAuditLog({
              farmId,
              actorUserId,
              action: operation,
              entity: model,
              recordId: recordId(baseArgs, result),
            });
          }
          return result;
        },
      },
    },
  });
}

export type TenantPrisma = ReturnType<typeof tenantDb>;
