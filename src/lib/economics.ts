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

export const variableCostCategories = ["HARVEST", "PACKAGING", "TRANSPORT"] as const;

export function isVariableCostCategory(category: string) {
  return variableCostCategories.some((variableCategory) => variableCategory === category);
}

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
  const fixedCost = plan.lines
    .filter((line) => !isVariableCostCategory(line.category))
    .reduce((sum, line) => sum + line.amount, 0);
  const variableCostPerUnit = plan.lines
    .filter((line) => isVariableCostCategory(line.category))
    .reduce((sum, line) => sum + line.amount, 0);
  const variableHarvestCost =
    projectedYield === null ? null : variableCostPerUnit * projectedYield;
  const totalCost =
    variableHarvestCost === null && variableCostPerUnit > 0
      ? null
      : fixedCost + (variableHarvestCost ?? 0);
  const projectedRevenue =
    projectedYield !== null && plan.farmgatePrice !== null
      ? projectedYield * plan.farmgatePrice
      : null;
  const projectedProfit =
    projectedRevenue !== null && totalCost !== null
      ? projectedRevenue - totalCost
      : null;
  const profitMargin =
    projectedProfit !== null && projectedRevenue !== null && projectedRevenue > 0
      ? projectedProfit / projectedRevenue
      : null;
  const returnOnCost =
    projectedProfit !== null && totalCost !== null && totalCost > 0
      ? projectedProfit / totalCost
      : null;

  return {
    totalSeeds,
    survivingSeedlings,
    intendedPlants,
    plantsForYield,
    projectedYield,
    totalCost,
    projectedRevenue,
    projectedProfit,
    profitMargin,
    returnOnCost,
    fixedCost,
    variableCostPerUnit,
    variableHarvestCost,
    costPerUnit:
      totalCost !== null && projectedYield !== null && projectedYield > 0
        ? totalCost / projectedYield
        : null,
    breakEvenPrice:
      totalCost !== null && projectedYield !== null && projectedYield > 0
        ? totalCost / projectedYield
        : null,
    breakEvenYield:
      totalCost !== null && plan.farmgatePrice !== null && plan.farmgatePrice > 0
        ? totalCost / plan.farmgatePrice
        : null,
  };
}

export function calculatePlannedCostsByCategory(plan: CropPlanNumbers) {
  const projectedYield = calculatePlan(plan).projectedYield ?? 0;
  const costs = new Map<string, number>();
  for (const line of plan.lines) {
    const amount = isVariableCostCategory(line.category)
      ? line.amount * projectedYield
      : line.amount;
    costs.set(line.category, (costs.get(line.category) ?? 0) + amount);
  }
  return costs;
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
  const soldQuantity = actuals.sales.reduce((sum, sale) => sum + sale.quantity, 0);

  return {
    costsByCategory,
    totalCost,
    harvestedQuantity,
    revenue,
    soldQuantity,
    profit: revenue - totalCost,
    costPerUnit:
      harvestedQuantity > 0 ? totalCost / harvestedQuantity : null,
  };
}

export function calculateProfitVarianceDriver(
  plan: CropPlanNumbers,
  actuals: ReturnType<typeof calculateActuals>,
) {
  const totals = calculatePlan(plan);
  if (
    totals.projectedYield === null ||
    totals.projectedProfit === null ||
    plan.farmgatePrice === null
  ) {
    return null;
  }

  const drivers = [
    {
      label: "Sales volume",
      impact: (actuals.soldQuantity - totals.projectedYield) * plan.farmgatePrice,
    },
    {
      label: "Sale price",
      impact: actuals.revenue - actuals.soldQuantity * plan.farmgatePrice,
    },
  ];
  const plannedCosts = calculatePlannedCostsByCategory(plan);
  const costCategories = new Set([...plannedCosts.keys(), ...actuals.costsByCategory.keys()]);
  for (const category of costCategories) {
    drivers.push({
      label: `Cost: ${category.replaceAll("_", " ").toLowerCase()}`,
      impact: (plannedCosts.get(category) ?? 0) - (actuals.costsByCategory.get(category) ?? 0),
    });
  }
  return drivers.reduce((largest, driver) =>
    Math.abs(driver.impact) > Math.abs(largest.impact) ? driver : largest,
  );
}

export function buildMonthlyCashFlow(
  plan: CropPlanNumbers,
  harvestMonth: number | null,
  cropName?: string,
) {
  const months = Array.from({ length: 12 }, (_, index) => ({
    month: index + 1,
    cost: 0,
    revenue: 0,
  }));
  const totals = calculatePlan(plan);
  for (const line of plan.lines) {
    if (isVariableCostCategory(line.category)) continue;
    if (
      line.timingMonth !== null &&
      Number.isInteger(line.timingMonth) &&
      line.timingMonth >= 1 &&
      line.timingMonth <= months.length
    ) {
      months[line.timingMonth - 1]!.cost += line.amount;
    }
  }
  const harvestCurve = Array<number>(months.length).fill(0);
  if (cropName?.toLowerCase().includes("bell pepper")) {
    for (let month = 4; month <= 9; month += 1) harvestCurve[month - 1] = 1 / 6;
  } else if (
    harvestMonth !== null &&
    Number.isInteger(harvestMonth) &&
    harvestMonth >= 1 &&
    harvestMonth <= months.length
  ) {
    harvestCurve[harvestMonth - 1] = 1;
  }
  harvestCurve.forEach((share, index) => {
    if (totals.projectedRevenue !== null) {
      months[index]!.revenue += totals.projectedRevenue * share;
    }
    if (totals.variableHarvestCost !== null) {
      months[index]!.cost += totals.variableHarvestCost * share;
    }
  });
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
  const monthly = buildMonthlyCashFlow(plan, harvestMonth, cropName);
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
    ["Planned cost", "Amount or unit rate", "Unit", "Cycle month"],
    ...plan.lines.map((line) => [
      line.category,
      line.amount,
      isVariableCostCategory(line.category) ? `${currency}/${yieldUnit}` : currency,
      line.timingMonth,
    ]),
    ["Total planned cost", totals.totalCost],
    [],
    ["Measure", "Plan", "Actual", "Variance"],
    ["Yield", totals.projectedYield, actuals.harvestedQuantity, totals.projectedYield === null ? null : actuals.harvestedQuantity - totals.projectedYield],
    ["Revenue", totals.projectedRevenue, actuals.revenue, totals.projectedRevenue === null ? null : actuals.revenue - totals.projectedRevenue],
    ["Cost", totals.totalCost, actuals.totalCost, totals.totalCost === null ? null : actuals.totalCost - totals.totalCost],
    ["Profit", totals.projectedProfit, actuals.profit, totals.projectedProfit === null ? null : actuals.profit - totals.projectedProfit],
    ["Largest profit variance driver", calculateProfitVarianceDriver(plan, actuals)?.label ?? "Not available"],
    ["Break-even price", totals.breakEvenPrice],
    [],
    ["Cycle month", "Cost", "Income", "Net"],
    ...monthly.map((month) => [month.month, month.cost, month.revenue, month.net]),
  ];

  return `\uFEFF${rows.map((row) => row.map(csvField).join(",")).join("\r\n")}`;
}
