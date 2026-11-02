import { DataRequestType, DataRequestStatus, FarmRole, Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { getAppContext } from "@/lib/auth";
import { tenantDb } from "@/lib/tenant-db";

export async function GET(request: Request) {
  const context = await getAppContext();
  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }
  if (context.role !== FarmRole.OWNER) {
    return NextResponse.json({ error: "Only a farm owner can export farm data." }, { status: 403 });
  }
  const format = new URL(request.url).searchParams.get("format") ?? "json";
  if (format !== "json" && format !== "csv") {
    return NextResponse.json({ error: "Choose json or csv export format." }, { status: 400 });
  }
  const db = tenantDb(context.farm.id, context.user.id);

  const exportRequest = await db.dataRequest.findFirst({
    where: {
      farmId: context.farm.id,
      userId: context.user.id,
      type: DataRequestType.EXPORT,
      status: DataRequestStatus.REQUESTED,
    },
    orderBy: { requestedAt: "desc" },
    select: { id: true },
  });
  if (!exportRequest) {
    return NextResponse.json(
      { error: "Record an export request in farm settings first." },
      { status: 409 },
    );
  }
  const farmId = context.farm.id;
  const [
    farm,
    members,
    holdings,
    plots,
    cropTypes,
    cropReferences,
    cropCycles,
    nurseryBatches,
    nurseryChecks,
    transplants,
    tasks,
    activityLogs,
    workers,
    workEntries,
    machineJobs,
    assets,
    assetUsages,
    assetMaintenances,
    expenses,
    expenseAllocations,
    stockItems,
    suppliers,
    stockMovements,
    plans,
    harvests,
    sales,
    consents,
    dataRequests,
    tenureDisputes,
    attachments,
    weatherLogs,
    scoutingLogs,
    sprayRecords,
    cycleStages,
    subsidies,
    auditLog,
    invitations,
    animals,
    animalGroups,
    animalEvents,
    animalDailyRecords,
    feedRations,
    animalHealthProducts,
    animalVaccinationSchedules,
    animalHealthCases,
    animalHealthRecords,
    animalPerformanceRecords,
    animalSpeciesProfiles,
    animalBreeds,
    animalBreedBenchmarks,
    animalTraitRecords,
    animalBreedingRecords,
  ] = await Promise.all([
    db.farm.findUnique({ where: { id: farmId } }),
    db.farmMember.findMany({ where: { farmId }, include: { user: { select: { id: true, name: true, email: true, locale: true, createdAt: true } } } }),
    db.landHolding.findMany({ where: { farmId } }),
    db.plot.findMany({ where: { farmId } }),
    db.cropType.findMany({ where: { farmId }, include: { stageTemplates: true, careTemplates: true } }),
    db.cropReferenceItem.findMany({ where: { farmId } }),
    db.cropCycle.findMany({ where: { farmId } }),
    db.nurseryBatch.findMany({ where: { farmId } }),
    db.nurseryCheck.findMany({ where: { farmId } }),
    db.transplant.findMany({ where: { farmId } }),
    db.task.findMany({ where: { farmId } }),
    db.activityLog.findMany({ where: { farmId } }),
    db.worker.findMany({ where: { farmId } }),
    db.workEntry.findMany({ where: { farmId } }),
    db.machineJob.findMany({ where: { farmId } }),
    db.asset.findMany({ where: { farmId } }),
    db.assetUsage.findMany({ where: { farmId } }),
    db.assetMaintenance.findMany({ where: { farmId } }),
    db.expense.findMany({ where: { farmId } }),
    db.expenseAllocation.findMany({ where: { farmId } }),
    db.stockItem.findMany({ where: { farmId } }),
    db.supplier.findMany({ where: { farmId } }),
    db.stockMovement.findMany({ where: { farmId } }),
    db.cropPlan.findMany({ where: { farmId }, include: { lines: true } }),
    db.harvest.findMany({ where: { farmId } }),
    db.sale.findMany({ where: { farmId } }),
    db.consentRecord.findMany({ where: { farmId } }),
    db.dataRequest.findMany({ where: { farmId } }),
    db.tenureDispute.findMany({ where: { farmId } }),
    db.fileAttachment.findMany({
      where: { farmId },
      select: {
        id: true,
        farmId: true,
        landHoldingId: true,
        plotId: true,
        cropTypeId: true,
        cycleId: true,
        taskId: true,
        filename: true,
        mimeType: true,
        sizeBytes: true,
        createdById: true,
        createdAt: true,
      },
    }),
    db.weatherLog.findMany({ where: { farmId } }),
    db.scoutingLog.findMany({ where: { farmId } }),
    db.sprayRecord.findMany({ where: { farmId } }),
    db.cropCycleStage.findMany({ where: { farmId } }),
    db.subsidyReceipt.findMany({ where: { farmId } }),
    db.auditLog.findMany({ where: { farmId } }),
    db.farmInvitation.findMany({
      where: { farmId },
      select: {
        id: true,
        farmId: true,
        invitedEmail: true,
        createdById: true,
        expiresAt: true,
        acceptedAt: true,
        createdAt: true,
      },
    }),
    db.animal.findMany({ where: { farmId } }),
    db.animalGroup.findMany({ where: { farmId } }),
    db.animalEvent.findMany({ where: { farmId } }),
    db.animalDailyRecord.findMany({ where: { farmId } }),
    db.feedRation.findMany({ where: { farmId } }),
    db.animalHealthProduct.findMany({ where: { farmId } }),
    db.animalVaccinationSchedule.findMany({ where: { farmId } }),
    db.animalHealthCase.findMany({ where: { farmId } }),
    db.animalHealthRecord.findMany({ where: { farmId } }),
    db.animalPerformanceRecord.findMany({ where: { farmId } }),
    db.animalSpeciesProfile.findMany({ where: { farmId } }),
    db.animalBreed.findMany({ where: { farmId } }),
    db.animalBreedBenchmark.findMany({ where: { farmId } }),
    db.animalTraitRecord.findMany({ where: { farmId } }),
    db.animalBreedingRecord.findMany({ where: { farmId } }),
  ]);

  const exportData = {
    exportedAt: new Date().toISOString(),
    farm,
    members,
    holdings,
    plots,
    cropTypes,
    cropReferences,
    cropCycles,
    nurseryBatches,
    nurseryChecks,
    transplants,
    tasks,
    activityLogs,
    workers,
    workEntries,
    machineJobs,
    assets,
    assetUsages,
    assetMaintenances,
    expenses,
    expenseAllocations,
    stockItems,
    suppliers,
    stockMovements,
    plans,
    harvests,
    sales,
    consents,
    dataRequests,
    tenureDisputes,
    attachments,
    weatherLogs,
    scoutingLogs,
    sprayRecords,
    cycleStages,
    subsidies,
    auditLog,
    invitations,
    animals,
    animalGroups,
    animalEvents,
    animalDailyRecords,
    feedRations,
    animalHealthProducts,
    animalVaccinationSchedules,
    animalHealthCases,
    animalHealthRecords,
    animalPerformanceRecords,
    animalSpeciesProfiles,
    animalBreeds,
    animalBreedBenchmarks,
    animalTraitRecords,
    animalBreedingRecords,
  };
  const body = JSON.stringify(
    exportData,
    (_key, value: unknown) => value instanceof Prisma.Decimal ? value.toString() : value,
    2,
  );
  await db.dataRequest.update({
    where: { id: exportRequest.id },
    data: { status: DataRequestStatus.COMPLETED, completedAt: new Date() },
  });

  const filename = context.farm.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  if (format === "csv") {
    const escape = (cell: string) => `"${cell.replace(/"/g, '""')}"`;
    const csv = [
      "table,record_json",
      ...Object.entries(exportData).flatMap(([table, rows]) => {
        if (!Array.isArray(rows)) return [[escape(table), escape(JSON.stringify(rows))].join(",")];
        return rows.map((row) => [escape(table), escape(JSON.stringify(row))].join(","));
      }),
    ].join("\r\n");
    return new NextResponse(`\uFEFF${csv}`, {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition": `attachment; filename="${filename}-data.csv"`,
        "Content-Type": "text/csv; charset=utf-8",
      },
    });
  }
  return new NextResponse(body, {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Disposition": `attachment; filename="${filename}-data.json"`,
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}
