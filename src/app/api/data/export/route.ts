import { DataRequestType, DataRequestStatus, FarmRole, Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { getAppContext } from "@/lib/auth";
import { tenantDb } from "@/lib/tenant-db";

export async function GET() {
  const context = await getAppContext();
  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }
  if (context.role !== FarmRole.OWNER) {
    return NextResponse.json({ error: "Only a farm owner can export farm data." }, { status: 403 });
  }
  const db = tenantDb(context.farm.id, context.user.id);

  const request = await db.dataRequest.findFirst({
    where: {
      farmId: context.farm.id,
      userId: context.user.id,
      type: DataRequestType.EXPORT,
      status: DataRequestStatus.REQUESTED,
    },
    orderBy: { requestedAt: "desc" },
    select: { id: true },
  });
  if (!request) {
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
    cropCycles,
    nurseryBatches,
    nurseryChecks,
    transplants,
    tasks,
    activityLogs,
    workers,
    workEntries,
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
  ] = await Promise.all([
    db.farm.findUnique({ where: { id: farmId }, select: { id: true, name: true, region: true, district: true, currency: true, createdAt: true } }),
    db.farmMember.findMany({ where: { farmId }, select: { role: true, createdAt: true, user: { select: { id: true, name: true, email: true } } } }),
    db.landHolding.findMany({ where: { farmId } }),
    db.plot.findMany({ where: { farmId } }),
    db.cropType.findMany({ where: { farmId }, include: { stageTemplates: true, careTemplates: true } }),
    db.cropCycle.findMany({ where: { farmId } }),
    db.nurseryBatch.findMany({ where: { farmId } }),
    db.nurseryCheck.findMany({ where: { farmId } }),
    db.transplant.findMany({ where: { farmId } }),
    db.task.findMany({ where: { farmId } }),
    db.activityLog.findMany({ where: { farmId } }),
    db.worker.findMany({ where: { farmId } }),
    db.workEntry.findMany({ where: { farmId } }),
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
    db.fileAttachment.findMany({ where: { farmId } }),
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
  ]);

  const exportData = {
    exportedAt: new Date().toISOString(),
    farm,
    members,
    holdings,
    plots,
    cropTypes,
    cropCycles,
    nurseryBatches,
    nurseryChecks,
    transplants,
    tasks,
    activityLogs,
    workers,
    workEntries,
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
  };
  const body = JSON.stringify(
    exportData,
    (_key, value: unknown) => value instanceof Prisma.Decimal ? value.toNumber() : value,
    2,
  );
  await db.dataRequest.update({
    where: { id: request.id },
    data: { status: DataRequestStatus.COMPLETED, completedAt: new Date() },
  });

  return new NextResponse(body, {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Disposition": `attachment; filename="${context.farm.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-data.json"`,
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}
