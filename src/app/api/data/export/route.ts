import { DataRequestType, DataRequestStatus, FarmRole, Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { getAppContext } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  const context = await getAppContext();
  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }
  if (context.role !== FarmRole.OWNER) {
    return NextResponse.json({ error: "Only a farm owner can export farm data." }, { status: 403 });
  }

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
    stockItems,
    suppliers,
    stockMovements,
    plans,
    harvests,
    sales,
    consents,
    dataRequests,
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
    db.stockItem.findMany({ where: { farmId } }),
    db.supplier.findMany({ where: { farmId } }),
    db.stockMovement.findMany({ where: { farmId } }),
    db.cropPlan.findMany({ where: { farmId }, include: { lines: true } }),
    db.harvest.findMany({ where: { farmId } }),
    db.sale.findMany({ where: { farmId } }),
    db.consentRecord.findMany({ where: { farmId, userId: context.user.id } }),
    db.dataRequest.findMany({ where: { farmId, userId: context.user.id } }),
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
    stockItems,
    suppliers,
    stockMovements,
    plans,
    harvests,
    sales,
    consents,
    dataRequests,
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
