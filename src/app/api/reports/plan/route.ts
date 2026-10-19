import { FarmRole, PlanScenario } from "@prisma/client";
import { NextResponse } from "next/server";
import { getAppContext } from "@/lib/auth";
import { buildPlanWorkbook } from "@/lib/plan-workbook";
import { tenantDb } from "@/lib/tenant-db";

export async function GET(request: Request) {
  const context = await getAppContext();
  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }
  if (context.role !== FarmRole.OWNER) {
    return NextResponse.json({ error: "Only a farm owner can export crop plans." }, { status: 403 });
  }

  const params = new URL(request.url).searchParams;
  const cycleId = params.get("cycleId") ?? "";
  const scenario = params.get("scenario") ?? PlanScenario.EXPECTED;
  if (!cycleId || !Object.values(PlanScenario).includes(scenario as PlanScenario)) {
    return NextResponse.json({ error: "Choose a valid crop cycle and plan scenario." }, { status: 400 });
  }

  const plan = await tenantDb(context.farm.id, context.user.id).cropPlan.findFirst({
    where: { farmId: context.farm.id, cycleId, scenario: scenario as PlanScenario },
    include: {
      lines: { where: { farmId: context.farm.id }, orderBy: { id: "asc" } },
      cycle: {
        include: {
          cropType: { select: { name: true } },
          plot: { select: { name: true } },
        },
      },
    },
  });
  if (!plan) {
    return NextResponse.json({ error: "No saved plan exists for that cycle and scenario." }, { status: 404 });
  }

  const workbook = await buildPlanWorkbook({
    cropName: plan.cycle.cropType.name,
    plotName: plan.cycle.plot.name,
    scenario: plan.scenario,
    currency: plan.currency,
    yieldUnit: plan.yieldUnit,
    harvestMonth: plan.harvestMonth,
    figureLabel: plan.figureLabel,
    plan: {
      areaAcres: plan.areaAcres.toNumber(),
      seedGrams: plan.seedGrams?.toNumber() ?? null,
      seedsPerGram: plan.seedsPerGram?.toNumber() ?? null,
      germinationRate: plan.germinationRate?.toNumber() ?? null,
      survivalRate: plan.survivalRate?.toNumber() ?? null,
      plantsPerAcre: plan.plantsPerAcre?.toNumber() ?? null,
      yieldPerPlant: plan.yieldPerPlant?.toNumber() ?? null,
      farmgatePrice: plan.farmgatePrice?.toNumber() ?? null,
      lines: plan.lines.map((line) => ({
        category: line.category,
        amount: line.amount.toNumber(),
        timingMonth: line.timingMonth,
      })),
    },
    lines: plan.lines.map((line) => ({
      category: line.category,
      amount: line.amount.toNumber(),
      timingMonth: line.timingMonth,
      figureLabel: line.figureLabel,
    })),
  });
  const filename = `${plan.cycle.cropType.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-${plan.scenario.toLowerCase()}-plan.xlsx`;
  return new Response(workbook, {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(workbook.byteLength),
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
