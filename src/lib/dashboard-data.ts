import "server-only";

import { tenantDb } from "@/lib/tenant-db";

type Context = NonNullable<Awaited<ReturnType<typeof import("@/lib/auth").getAppContext>>>;

const numeric = (value: { toNumber(): number } | null | undefined) =>
  value?.toNumber() ?? null;
const iso = (value: Date | null | undefined) => value?.toISOString() ?? null;

export async function getDashboardData(context: Context) {
  const farmId = context.farm.id;
  const db = tenantDb(farmId, context.user.id);
  const isOwner = context.role === "OWNER";
  const lastSevenDays = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [
    holdings,
    plots,
    cropTypes,
    rawCycles,
    rawTasks,
    rawLogs,
    rawWorkers,
    rawWorkEntries,
    rawWeeklyWorkEntries,
    rawExpenses,
    rawStockItems,
    rawStockMovements,
    suppliers,
    members,
    consents,
    dataRequests,
    tenureDisputes,
    rawWeatherLogs,
    rawScoutingLogs,
    rawSprayRecords,
    auditEntries,
    rawSubsidies,
    rawMachineJobs,
    rawAssets,
    rawAssetUsages,
    rawAssetMaintenances,
    rawAttachments,
  ] = await Promise.all([
    db.landHolding.findMany({
      where: { farmId, archivedAt: null },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        owned: true,
        costOrRent: isOwner,
        currency: true,
        leaseStart: true,
        leaseEnd: true,
        ownerName: true,
        notes: true,
        archivedAt: true,
      },
    }),
    db.plot.findMany({
      where: { farmId, archivedAt: null },
      orderBy: { createdAt: "desc" },
      include: { holding: { select: { name: true, owned: true } } },
    }),
    db.cropType.findMany({
      where: { farmId, archivedAt: null },
      orderBy: { name: "asc" },
      include: {
        stageTemplates: { orderBy: { sortOrder: "asc" } },
        careTemplates: true,
        references: { orderBy: [{ kind: "asc" }, { name: "asc" }] },
      },
    }),
    db.cropCycle.findMany({
      where: { farmId, archivedAt: null },
      orderBy: { createdAt: "desc" },
      include: {
        plot: { select: { name: true } },
        cropType: {
          select: {
            name: true,
            mode: true,
            figureLabel: true,
            stageTemplates: { orderBy: { sortOrder: "asc" } },
          },
        },
        batches: {
          orderBy: { createdAt: "desc" },
          include: {
            checks: { orderBy: { checkedAt: "desc" } },
            plants: { orderBy: { movedAt: "desc" } },
          },
        },
        plans: { include: { lines: true } },
        harvests: { orderBy: { harvestedAt: "desc" } },
        sales: { orderBy: { soldAt: "desc" } },
        stockMovements: {
          where: { farmId, type: "USAGE" },
          include: { item: { select: { category: true } } },
        },
      },
    }),
    db.task.findMany({
      where: { farmId, archivedAt: null },
      orderBy: [{ status: "asc" }, { dueAt: "asc" }],
      include: { cycle: { include: { cropType: { select: { name: true } }, plot: { select: { name: true } } } } },
    }),
    db.activityLog.findMany({
      where: { farmId },
      orderBy: { loggedAt: "desc" },
      take: 40,
      include: { cycle: { include: { cropType: { select: { name: true } } } } },
    }),
    db.worker.findMany({
      where: { farmId, active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, hourlyRate: true, currency: true, active: true },
    }),
    db.workEntry.findMany({
      where: { farmId },
      orderBy: { startedAt: "desc" },
      take: 100,
      include: { worker: { select: { name: true } }, cycle: { include: { cropType: { select: { name: true } } } } },
    }),
    db.workEntry.findMany({
      where: { farmId, startedAt: { gte: lastSevenDays } },
      orderBy: { startedAt: "desc" },
      include: { worker: { select: { name: true } }, cycle: { include: { cropType: { select: { name: true } } } } },
    }),
    isOwner
      ? db.expense.findMany({
          where: { farmId },
          orderBy: { spentAt: "desc" },
          take: 150,
          include: {
            cycle: { include: { cropType: { select: { name: true } } } },
            allocations: { where: { farmId }, select: { cycleId: true, amount: true } },
          },
        })
      : Promise.resolve([]),
    db.stockItem.findMany({
      where: { farmId },
      orderBy: { name: "asc" },
      include: { movements: { where: { farmId }, orderBy: { movedAt: "asc" } } },
    }),
    db.stockMovement.findMany({
      where: { farmId },
      orderBy: { movedAt: "desc" },
      take: 100,
      include: {
        item: { select: { name: true, unit: true, category: true } },
        supplier: { select: { name: true } },
        cycle: { include: { cropType: { select: { name: true } } } },
        task: { select: { titleEn: true, titleSw: true } },
      },
    }),
    db.supplier.findMany({
      where: { farmId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    isOwner
      ? db.farmMember.findMany({
          where: { farmId },
          orderBy: { createdAt: "asc" },
          include: { user: { select: { id: true, name: true, email: true } } },
        })
      : Promise.resolve([]),
    db.consentRecord.findMany({
      where: { farmId, userId: context.user.id },
      orderBy: { recordedAt: "desc" },
      select: { purpose: true, policyVersion: true, granted: true, recordedAt: true, withdrawnAt: true },
    }),
    db.dataRequest.findMany({
      where: { farmId, userId: context.user.id },
      orderBy: { requestedAt: "desc" },
      include: { subject: { select: { name: true, email: true } } },
    }),
    db.tenureDispute.findMany({
      where: { farmId },
      orderBy: { occurredAt: "desc" },
      include: {
        plot: { select: { name: true } },
        holding: { select: { name: true } },
      },
    }),
    db.weatherLog.findMany({
      where: { farmId },
      orderBy: { observedAt: "desc" },
      take: 40,
      include: {
        plot: { select: { name: true } },
        cycle: { include: { cropType: { select: { name: true } } } },
      },
    }),
    db.scoutingLog.findMany({
      where: { farmId },
      orderBy: { observedAt: "desc" },
      take: 40,
      include: {
        plot: { select: { name: true } },
        cycle: { include: { cropType: { select: { name: true } } } },
      },
    }),
    db.sprayRecord.findMany({
      where: { farmId },
      orderBy: { appliedAt: "desc" },
      take: 40,
      include: {
        plot: { select: { name: true } },
        cycle: {
          include: {
            cropType: { select: { name: true, cycleLengthDays: true } },
            harvests: { select: { harvestedAt: true } },
          },
        },
      },
    }),
    isOwner
      ? db.auditLog.findMany({
          where: { farmId },
          orderBy: { occurredAt: "desc" },
          take: 100,
          include: { actor: { select: { name: true, email: true } } },
        })
      : Promise.resolve([]),
    isOwner
      ? db.subsidyReceipt.findMany({
          where: { farmId },
          orderBy: { receivedAt: "desc" },
          take: 50,
        })
      : Promise.resolve([]),
    isOwner
        ? db.machineJob.findMany({
            where: { farmId },
            orderBy: { performedAt: "desc" },
            take: 150,
            include: { cycle: { include: { cropType: { select: { name: true } } } }, plot: { select: { name: true } } },
          })
        : Promise.resolve([]),
    db.asset.findMany({
      where: { farmId, archivedAt: null },
      orderBy: [{ status: "asc" }, { name: "asc" }],
    }),
    db.assetUsage.findMany({
      where: { farmId },
      orderBy: { usedAt: "desc" },
      take: 150,
      include: {
        asset: { select: { name: true } },
        cycle: { include: { cropType: { select: { name: true } } } },
        plot: { select: { name: true } },
      },
    }),
    db.assetMaintenance.findMany({
      where: { farmId },
      orderBy: { performedAt: "desc" },
      take: 100,
      include: {
        asset: { select: { name: true } },
        cycle: { include: { cropType: { select: { name: true } } } },
      },
    }),
    db.fileAttachment.findMany({
        where: { farmId },
        orderBy: { createdAt: "desc" },
        take: 100,
    }),
  ]);

  const mapWorkEntry = (entry: (typeof rawWorkEntries)[number]) => ({
    id: entry.id,
    workerName: entry.worker.name,
    taskLabel: entry.taskLabel,
    cycleId: entry.cycleId,
    cropName: entry.cycle?.cropType.name ?? null,
    startedAt: iso(entry.startedAt),
    endedAt: iso(entry.endedAt),
    hours: Number(((entry.endedAt.getTime() - entry.startedAt.getTime()) / 3_600_000).toFixed(2)),
    amount: isOwner ? numeric(entry.amount) : null,
    hourlyRate: isOwner ? numeric(entry.hourlyRate) : null,
    currency: entry.currency,
    paid: entry.paid,
    paymentMethod: isOwner ? entry.paymentMethod : null,
    paymentReference: isOwner ? entry.paymentReference : null,
  });

  return {
    generatedAt: Date.now(),
    user: context.user,
    farm: context.farm,
    role: context.role,
    memberships: context.memberships.map((member) => ({
      farm: member.farm,
      role: member.role,
    })),
    holdings: holdings.map((holding) => ({
      id: holding.id,
      name: holding.name,
      owned: holding.owned,
      costOrRent: numeric(holding.costOrRent),
      currency: holding.currency,
      leaseStart: iso(holding.leaseStart),
      leaseEnd: iso(holding.leaseEnd),
      ownerName: holding.ownerName,
      notes: holding.notes,
      archivedAt: iso(holding.archivedAt),
    })),
    plots: plots.map((plot) => ({
      id: plot.id,
      holdingId: plot.holdingId,
      holdingName: plot.holding.name,
      name: plot.name,
      areaValue: numeric(plot.areaValue) ?? 0,
      areaUnit: plot.areaUnit,
      soilType: plot.soilType,
      waterSource: plot.waterSource,
      gpsLat: numeric(plot.gpsLat),
      gpsLng: numeric(plot.gpsLng),
      tenureType: plot.tenureType,
      documentStatus: plot.documentStatus,
      renewalDate: iso(plot.renewalDate),
      notes: plot.notes,
      archivedAt: iso(plot.archivedAt),
    })),
    cropTypes: cropTypes.map((crop) => ({
      id: crop.id,
      name: crop.name,
      varietyDefault: crop.varietyDefault,
      mode: crop.mode,
      cycleLengthDays: crop.cycleLengthDays,
      spacingNote: crop.spacingNote,
      plantsPerAcre: numeric(crop.plantsPerAcre),
      yieldPerPlant: numeric(crop.yieldPerPlant),
      yieldUnit: crop.yieldUnit,
      figureLabel: crop.figureLabel,
      stageTemplates: crop.stageTemplates.map((stage) => ({
        id: stage.id,
        key: stage.key,
        nameEn: stage.nameEn,
        nameSw: stage.nameSw,
        sortOrder: stage.sortOrder,
        dayOffset: stage.dayOffset,
      })),
      careTemplates: crop.careTemplates.map((template) => ({
        id: template.id,
        taskType: template.taskType,
        afterStageKey: template.afterStageKey,
        intervalDays: template.intervalDays,
        nameEn: template.nameEn,
        nameSw: template.nameSw,
      })),
      references: crop.references.map((reference) => ({
        id: reference.id,
        kind: reference.kind,
        name: reference.name,
        activeIngredient: reference.activeIngredient,
        notes: reference.notes,
      })),
    })),
    cycles: rawCycles.map((cycle) => ({
      id: cycle.id,
      plotId: cycle.plotId,
      plotName: cycle.plot.name,
      cropTypeId: cycle.cropTypeId,
      cropName: cycle.cropType.name,
      mode: cycle.cropType.mode,
      variety: cycle.variety,
      areaValue: numeric(cycle.areaValue) ?? 0,
      areaUnit: cycle.areaUnit,
      plantingAt: iso(cycle.plantingAt),
      expectedHarvestAt: iso(cycle.expectedHarvestAt),
      stageTimeline: cycle.cropType.stageTemplates.map((stage) => ({
        id: stage.id,
        nameEn: stage.nameEn,
        nameSw: stage.nameSw,
        dayOffset: stage.dayOffset,
        expectedAt: cycle.plantingAt && stage.dayOffset !== null
          ? iso(new Date(cycle.plantingAt.getTime() + stage.dayOffset * 86_400_000))
          : null,
      })),
      status: cycle.status,
      expectedYield: numeric(cycle.expectedYield),
      actualYield: numeric(cycle.actualYield),
      yieldUnit: cycle.yieldUnit,
      figureLabel: cycle.figureLabel,
      batches: cycle.batches.map((batch) => ({
        id: batch.id,
        seedLot: batch.seedLot,
        variety: batch.variety,
        supplier: batch.supplier,
        quantity: numeric(batch.quantity) ?? 0,
        quantityUnit: batch.quantityUnit,
        costAmount: isOwner ? numeric(batch.costAmount) : null,
        sownAt: iso(batch.sownAt),
        checks: batch.checks.map((check) => ({
          checkedAt: iso(check.checkedAt),
          germinated: check.germinated,
          surviving: check.surviving,
          condition: check.condition,
          notes: check.notes,
        })),
        transplants: batch.plants.map((plant) => ({
          movedAt: iso(plant.movedAt),
          quantityMoved: plant.quantityMoved,
          quantityDiscarded: plant.quantityDiscarded,
          reason: plant.reason,
        })),
      })),
      plans: cycle.plans.map((plan) => ({
        id: plan.id,
        scenario: plan.scenario,
        areaAcres: numeric(plan.areaAcres) ?? 0,
        seedGrams: numeric(plan.seedGrams),
        seedsPerGram: numeric(plan.seedsPerGram),
        germinationRate: numeric(plan.germinationRate),
        survivalRate: numeric(plan.survivalRate),
        plantsPerAcre: numeric(plan.plantsPerAcre),
        yieldPerPlant: numeric(plan.yieldPerPlant),
        yieldUnit: plan.yieldUnit,
        farmgatePrice: numeric(plan.farmgatePrice),
        harvestMonth: plan.harvestMonth,
        currency: plan.currency,
        figureLabel: plan.figureLabel,
        notes: plan.notes,
        lines: plan.lines.map((line) => ({
          category: line.category,
          amount: numeric(line.amount) ?? 0,
          currency: line.currency,
          timingMonth: line.timingMonth,
          figureLabel: line.figureLabel,
        })),
      })),
      harvests: cycle.harvests.map((harvest) => ({
        id: harvest.id,
        harvestedAt: iso(harvest.harvestedAt),
        quantity: numeric(harvest.quantity) ?? 0,
        unit: harvest.unit,
        grade: harvest.grade,
        lossQty: numeric(harvest.lossQty),
        notes: harvest.notes,
      })),
      sales: cycle.sales.map((sale) => ({
        id: sale.id,
        soldAt: iso(sale.soldAt),
        quantity: numeric(sale.quantity) ?? 0,
        unit: sale.unit,
        price: numeric(sale.price) ?? 0,
        currency: sale.currency,
        buyer: sale.buyer,
      })),
      stockUsage: cycle.stockMovements.map((movement) => ({
        quantity: numeric(movement.quantity) ?? 0,
        unit: movement.unit,
        unitCost: isOwner ? numeric(movement.unitCost) : null,
        category: movement.item.category,
      })),
    })),
    tasks: rawTasks.map((task) => ({
      id: task.id,
      titleEn: task.titleEn,
      titleSw: task.titleSw,
      taskType: task.taskType,
      dueAt: iso(task.dueAt),
      status: task.status,
      notes: task.notes,
      cropName: task.cycle.cropType.name,
      plotName: task.cycle.plot.name,
      cycleId: task.cycleId,
    })),
    logs: rawLogs.map((log) => ({
      id: log.id,
      loggedAt: iso(log.loggedAt),
      body: log.body,
      weather: log.weather,
      whoWorked: log.whoWorked,
      cropName: log.cycle?.cropType.name ?? null,
      synced: log.synced,
    })),
    workers: rawWorkers.map((worker) => ({
      id: worker.id,
      name: worker.name,
      active: worker.active,
      hourlyRate: "hourlyRate" in worker ? numeric(worker.hourlyRate) : null,
      currency: "currency" in worker ? worker.currency : context.farm.currency,
    })),
    workEntries: rawWorkEntries.map(mapWorkEntry),
    weeklyWorkEntries: rawWeeklyWorkEntries.map(mapWorkEntry),
    expenses: rawExpenses.map((expense) => ({
      id: expense.id,
      category: expense.category,
      amount: numeric(expense.amount) ?? 0,
      currency: expense.currency,
      spentAt: iso(expense.spentAt),
      notes: expense.notes,
      cycleId: expense.cycleId,
      cropName: expense.cycle?.cropType.name ?? null,
      allocations: expense.allocations.map((allocation) => ({
        cycleId: allocation.cycleId,
        amount: numeric(allocation.amount) ?? 0,
      })),
    })),
    machineJobs: rawMachineJobs.map((job) => ({
      id: job.id,
      description: job.description,
      cycleId: job.cycleId,
      cropName: job.cycle?.cropType.name ?? null,
      plotName: job.plot?.name ?? null,
      hours: numeric(job.hours) ?? 0,
      fuelCost: numeric(job.fuelCost) ?? 0,
      hireCost: numeric(job.hireCost) ?? 0,
      maintenanceCost: numeric(job.maintenanceCost) ?? 0,
      currency: job.currency,
      performedAt: iso(job.performedAt),
    })),
    assets: rawAssets.map((asset) => ({
      id: asset.id,
      name: asset.name,
      type: asset.type,
      purchasedAt: iso(asset.purchasedAt),
      purchaseCost: isOwner ? numeric(asset.purchaseCost) : null,
      currency: asset.currency,
      expectedLifeMonths: asset.expectedLifeMonths,
      status: asset.status,
      notes: asset.notes,
    })),
    assetUsages: rawAssetUsages.map((usage) => ({
      id: usage.id,
      assetId: usage.assetId,
      assetName: usage.asset.name,
      cycleId: usage.cycleId,
      cropName: usage.cycle?.cropType.name ?? null,
      plotName: usage.plot?.name ?? null,
      usedAt: iso(usage.usedAt),
      hours: numeric(usage.hours),
      distance: numeric(usage.distance),
      distanceUnit: usage.distanceUnit,
      operator: usage.operator,
      fuelCost: isOwner ? numeric(usage.fuelCost) : null,
      currency: usage.currency,
      notes: usage.notes,
    })),
    assetMaintenances: rawAssetMaintenances.map((maintenance) => ({
      id: maintenance.id,
      assetId: maintenance.assetId,
      assetName: maintenance.asset.name,
      cycleId: maintenance.cycleId,
      cropName: maintenance.cycle?.cropType.name ?? null,
      performedAt: iso(maintenance.performedAt),
      description: maintenance.description,
      cost: isOwner ? numeric(maintenance.cost) : null,
      currency: maintenance.currency,
      nextServiceAt: iso(maintenance.nextServiceAt),
      notes: maintenance.notes,
    })),
    attachments: rawAttachments.map((attachment) => {
      const recordType = attachment.landHoldingId ? "holding"
        : attachment.plotId ? "plot"
          : attachment.cropTypeId ? "crop type"
            : attachment.cycleId ? "crop cycle"
              : "task";
      const recordId = attachment.landHoldingId ?? attachment.plotId ??
        attachment.cropTypeId ?? attachment.cycleId ?? attachment.taskId ?? "";
      return {
        id: attachment.id,
        filename: attachment.filename,
        mimeType: attachment.mimeType,
        sizeBytes: attachment.sizeBytes,
        createdAt: iso(attachment.createdAt) ?? "",
        recordType,
        recordId,
      };
    }),
    stockItems: rawStockItems.map((item) => {
      const balance = item.movements.reduce((quantity, movement) => {
        const amount = numeric(movement.quantity) ?? 0;
        if (movement.type === "PURCHASE") return quantity + amount;
        if (movement.type === "USAGE") return quantity - amount;
        return quantity + amount;
      }, 0);
      return {
        id: item.id,
        name: item.name,
        category: item.category,
        unit: item.unit,
        balance,
        lowStockThreshold: numeric(item.lowStockThreshold),
      };
    }),
    stockMovements: rawStockMovements.map((movement) => ({
      id: movement.id,
      type: movement.type,
      quantity: numeric(movement.quantity) ?? 0,
      unit: movement.unit,
      unitCost: isOwner ? numeric(movement.unitCost) : null,
      currency: movement.currency,
      lotReference: movement.lotReference,
      movedAt: iso(movement.movedAt),
      itemName: movement.item.name,
      category: movement.item.category,
      supplierName: movement.supplier?.name ?? null,
      cropName: movement.cycle?.cropType.name ?? null,
      taskName: movement.task?.titleEn ?? null,
    })),
    suppliers: suppliers,
    members: members.map((member) => ({
      id: member.id,
      userId: member.user.id,
      name: member.user.name,
      email: member.user.email,
      role: member.role,
    })),
    consents: consents.map((consent) => ({
      ...consent,
      recordedAt: iso(consent.recordedAt),
      withdrawnAt: iso(consent.withdrawnAt),
    })),
    dataRequests: dataRequests.map((request) => ({
      id: request.id,
      type: request.type,
      scope: request.scope,
      status: request.status,
      subject: request.subject ? `${request.subject.name} · ${request.subject.email}` : null,
      requestedAt: iso(request.requestedAt),
      completedAt: iso(request.completedAt),
    })),
    tenureDisputes: tenureDisputes.map((dispute) => ({
      id: dispute.id,
      subject: dispute.plot?.name ?? dispute.holding?.name ?? "",
      occurredAt: iso(dispute.occurredAt),
      description: dispute.description,
      status: dispute.status,
      resolution: dispute.resolution,
    })),
    weatherLogs: rawWeatherLogs.map((log) => ({
      id: log.id,
      plotName: log.plot.name,
      cropName: log.cycle?.cropType.name ?? null,
      observedAt: iso(log.observedAt),
      rainfallMm: numeric(log.rainfallMm),
      temperatureC: numeric(log.temperatureC),
      notes: log.notes,
    })),
    scoutingLogs: rawScoutingLogs.map((log) => ({
      id: log.id,
      plotName: log.plot.name,
      cropName: log.cycle?.cropType.name ?? null,
      observedAt: iso(log.observedAt),
      issue: log.issue,
      severity: log.severity,
      notes: log.notes,
    })),
    sprayRecords: rawSprayRecords.map((record) => {
      const intervalEnd = record.preHarvestIntervalDays === null
        ? null
        : new Date(record.appliedAt.getTime() + record.preHarvestIntervalDays * 86_400_000);
      const expectedHarvest = record.cycle?.expectedHarvestAt ??
        (record.cycle?.plantingAt && record.cycle.cropType.cycleLengthDays
          ? new Date(record.cycle.plantingAt.getTime() + record.cycle.cropType.cycleLengthDays * 86_400_000)
          : null);
      const harvestDates = [
        ...record.cycle?.harvests.map((harvest) => harvest.harvestedAt) ?? [],
        ...(expectedHarvest ? [expectedHarvest] : []),
      ];
      return {
        id: record.id,
        plotName: record.plot.name,
        cropName: record.cycle?.cropType.name ?? null,
        product: record.product,
        activeIngredient: record.activeIngredient,
        batch: record.batch,
        dose: record.dose,
        appliedAt: iso(record.appliedAt),
        preHarvestIntervalDays: record.preHarvestIntervalDays,
        warning: intervalEnd !== null && harvestDates.some(
          (harvestAt) => harvestAt >= record.appliedAt && harvestAt <= intervalEnd,
        ),
        notes: record.notes,
      };
    }),
    auditLog: auditEntries.map((entry) => ({
      id: entry.id,
      actorName: entry.actor?.name ?? entry.actor?.email ?? "Unknown user",
      action: entry.action,
      entity: entry.entity,
      recordId: entry.recordId,
      occurredAt: iso(entry.occurredAt),
    })),
    subsidies: rawSubsidies.map((receipt) => ({
      id: receipt.id,
      input: receipt.input,
      quantity: numeric(receipt.quantity) ?? 0,
      unit: receipt.unit,
      price: numeric(receipt.price),
      currency: receipt.currency,
      receivedAt: iso(receipt.receivedAt),
      source: receipt.source,
      notes: receipt.notes,
    })),
  };
}

export type DashboardData = Awaited<ReturnType<typeof getDashboardData>>;
