export type CropPlanNumbers = {
  areaAcres: number;
  seedGrams: number | null;
  seedsPerGram: number | null;
  germinationRate: number | null;
  survivalRate: number | null;
  plantsPerAcre: number | null;
  yieldPerPlant: number | null;
  farmgatePrice: number | null;
  lines: Array<{ category: string; amount: number; timingMonth: number | null }>;
};

export function calculatePlan(plan: CropPlanNumbers) {
  const totalSeeds =
    plan.seedGrams !== null && plan.seedsPerGram !== null
      ? plan.seedGrams * plan.seedsPerGram
      : null;
  const survivingSeedlings =
    totalSeeds !== null &&
    plan.germinationRate !== null &&
    plan.survivalRate !== null
      ? totalSeeds * plan.germinationRate * plan.survivalRate
      : null;
  const intendedPlants =
    plan.plantsPerAcre !== null
      ? plan.plantsPerAcre * plan.areaAcres
      : null;
  const plantsForYield =
    intendedPlants !== null && survivingSeedlings !== null
      ? Math.min(intendedPlants, survivingSeedlings)
      : intendedPlants;
  const projectedYield =
    plantsForYield !== null && plan.yieldPerPlant !== null
      ? plantsForYield * plan.yieldPerPlant
      : null;
  const totalCost = plan.lines.reduce((sum, line) => sum + line.amount, 0);
  const projectedRevenue =
    projectedYield !== null && plan.farmgatePrice !== null
      ? projectedYield * plan.farmgatePrice
      : null;
  const projectedProfit =
    projectedRevenue !== null ? projectedRevenue - totalCost : null;

  return {
    totalSeeds,
    survivingSeedlings,
    intendedPlants,
    plantsForYield,
    projectedYield,
    totalCost,
    projectedRevenue,
    projectedProfit,
    costPerUnit:
      projectedYield !== null && projectedYield > 0
        ? totalCost / projectedYield
        : null,
    breakEvenPrice:
      projectedYield !== null && projectedYield > 0
        ? totalCost / projectedYield
        : null,
    breakEvenYield:
      plan.farmgatePrice !== null && plan.farmgatePrice > 0
        ? totalCost / plan.farmgatePrice
        : null,
  };
}

export type CycleActuals = {
  expenses: Array<{ category: string; amount: number }>;
  labour: Array<{ amount: number }>;
  stockUsage: Array<{
    category: string;
    quantity: number;
    unitCost: number | null;
  }>;
  harvests: Array<{ quantity: number }>;
  sales: Array<{ quantity: number; price: number }>;
};

export function calculateActuals(actuals: CycleActuals) {
  const costsByCategory = new Map<string, number>();
  for (const expense of actuals.expenses) {
    costsByCategory.set(
      expense.category,
      (costsByCategory.get(expense.category) ?? 0) + expense.amount,
    );
  }
  for (const entry of actuals.labour) {
    costsByCategory.set(
      "LABOUR",
      (costsByCategory.get("LABOUR") ?? 0) + entry.amount,
    );
  }
  for (const usage of actuals.stockUsage) {
    if (usage.unitCost === null) continue;
    costsByCategory.set(
      usage.category,
      (costsByCategory.get(usage.category) ?? 0) +
        usage.quantity * usage.unitCost,
    );
  }

  const totalCost = [...costsByCategory.values()].reduce(
    (sum, amount) => sum + amount,
    0,
  );
  const harvestedQuantity = actuals.harvests.reduce(
    (sum, harvest) => sum + harvest.quantity,
    0,
  );
  const revenue = actuals.sales.reduce(
    (sum, sale) => sum + sale.quantity * sale.price,
    0,
  );

  return {
    costsByCategory,
    totalCost,
    harvestedQuantity,
    revenue,
    profit: revenue - totalCost,
    costPerUnit:
      harvestedQuantity > 0 ? totalCost / harvestedQuantity : null,
  };
}

export function buildMonthlyCashFlow(
  plan: CropPlanNumbers,
  harvestMonth: number | null,
) {
  const months = Array.from({ length: 12 }, (_, index) => ({
    month: index + 1,
    cost: 0,
    revenue: 0,
  }));
  for (const line of plan.lines) {
    if (
      line.timingMonth !== null &&
      Number.isInteger(line.timingMonth) &&
      line.timingMonth >= 1 &&
      line.timingMonth <= months.length
    ) {
      months[line.timingMonth - 1]!.cost += line.amount;
    }
  }
  const totals = calculatePlan(plan);
  if (
    harvestMonth !== null &&
    Number.isInteger(harvestMonth) &&
    harvestMonth >= 1 &&
    harvestMonth <= months.length &&
    totals.projectedRevenue !== null
  ) {
    months[harvestMonth - 1]!.revenue += totals.projectedRevenue;
  }
  return months.map((month) => ({
    ...month,
    net: month.revenue - month.cost,
  }));
}

function csvField(value: string | number | null) {
  const text = value === null ? "" : String(value);
  const safeText = typeof value === "string" && /^[=+\-@\t\r]/.test(text)
    ? `'${text}`
    : text;
  return `"${safeText.replaceAll('"', '""')}"`;
}

export function buildPlanCsv({
  cropName,
  plotName,
  currency,
  yieldUnit,
  plan,
  harvestMonth,
  actuals,
}: {
  cropName: string;
  plotName: string;
  currency: string;
  yieldUnit: string;
  plan: CropPlanNumbers;
  harvestMonth: number | null;
  actuals: ReturnType<typeof calculateActuals>;
}) {
  const totals = calculatePlan(plan);
  const monthly = buildMonthlyCashFlow(plan, harvestMonth);
  const rows: Array<Array<string | number | null>> = [
    ["Crop plan vs actual"],
    ["Crop", cropName],
    ["Plot", plotName],
    ["Currency", currency],
    ["Yield unit", yieldUnit],
    ["Figure status", "Placeholder benchmark; verify before use"],
    [],
    ["Plan assumption", "Value"],
    ["Area (acres)", plan.areaAcres],
    ["Seed quantity (grams)", plan.seedGrams],
    ["Seeds per gram", plan.seedsPerGram],
    ["Germination rate", plan.germinationRate],
    ["Survival rate", plan.survivalRate],
    ["Plants per acre", plan.plantsPerAcre],
    ["Yield per plant", plan.yieldPerPlant],
    ["Farmgate price", plan.farmgatePrice],
    [],
    ["Planned cost", "Amount", "Cycle month"],
    ...plan.lines.map((line) => [line.category, line.amount, line.timingMonth]),
    ["Total planned cost", totals.totalCost],
    [],
    ["Measure", "Plan", "Actual", "Variance"],
    ["Yield", totals.projectedYield, actuals.harvestedQuantity, totals.projectedYield === null ? null : actuals.harvestedQuantity - totals.projectedYield],
    ["Revenue", totals.projectedRevenue, actuals.revenue, totals.projectedRevenue === null ? null : actuals.revenue - totals.projectedRevenue],
    ["Cost", totals.totalCost, actuals.totalCost, actuals.totalCost - totals.totalCost],
    ["Profit", totals.projectedProfit, actuals.profit, totals.projectedProfit === null ? null : actuals.profit - totals.projectedProfit],
    ["Break-even price", totals.breakEvenPrice],
    [],
    ["Cycle month", "Cost", "Income", "Net"],
    ...monthly.map((month) => [month.month, month.cost, month.revenue, month.net]),
  ];

  return `\uFEFF${rows.map((row) => row.map(csvField).join(",")).join("\r\n")}`;
}
