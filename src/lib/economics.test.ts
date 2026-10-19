import { describe, expect, it } from "vitest";
import {
  buildMonthlyCashFlow,
  buildPlanCsv,
  calculateActuals,
  calculateProfitVarianceDriver,
  calculatePlan,
  type CropPlanNumbers,
} from "./economics";

const basePlan: CropPlanNumbers = {
  areaAcres: 2,
  seedGrams: 10,
  seedsPerGram: 100,
  germinationRate: 0.8,
  survivalRate: 0.5,
  plantsPerAcre: 300,
  yieldPerPlant: 2,
  farmgatePrice: 500,
  lines: [
    { category: "SEED", amount: 1000, timingMonth: 1 },
    { category: "FERTILIZER", amount: 3000, timingMonth: 3 },
  ],
};

describe("calculatePlan", () => {
  it("caps surviving seedlings at the intended planting count and calculates economics", () => {
    expect(calculatePlan(basePlan)).toEqual({
      totalSeeds: 1000,
      survivingSeedlings: 400,
      intendedPlants: 600,
      plantsForYield: 400,
      projectedYield: 800,
      totalCost: 4000,
      projectedRevenue: 400000,
      projectedProfit: 396000,
      profitMargin: 0.99,
      returnOnCost: 99,
      fixedCost: 4000,
      variableCostPerUnit: 0,
      variableHarvestCost: 0,
      costPerUnit: 5,
      breakEvenPrice: 5,
      breakEvenYield: 8,
    });
  });

  it("leaves projections unavailable when required assumptions are missing", () => {
    const plan = calculatePlan({ ...basePlan, yieldPerPlant: null, farmgatePrice: null });

    expect(plan.projectedYield).toBeNull();
    expect(plan.projectedRevenue).toBeNull();
    expect(plan.projectedProfit).toBeNull();
    expect(plan.breakEvenYield).toBeNull();
    expect(plan.totalCost).toBe(4000);
  });

  it("matches the founder's bell pepper benchmark economics", () => {
    const plan: CropPlanNumbers = {
      areaAcres: 1,
      seedGrams: 100,
      seedsPerGram: 160,
      germinationRate: 0.85,
      survivalRate: 1,
      plantsPerAcre: 13600,
      yieldPerPlant: 3.5,
      farmgatePrice: 1627,
      lines: [
        { category: "SEED", amount: 120000, timingMonth: 1 },
        { category: "LAND_PREP", amount: 217000, timingMonth: 1 },
        { category: "NURSERY", amount: 271000, timingMonth: 1 },
        { category: "TRANSPLANTING", amount: 271000, timingMonth: 2 },
        { category: "IRRIGATION", amount: 633000, timingMonth: 2 },
        { category: "FERTILIZER", amount: 226000, timingMonth: 2 },
        { category: "FERTILIZER", amount: 226000, timingMonth: 3 },
        { category: "WEEDING", amount: 542000, timingMonth: 3 },
        { category: "HARVEST", amount: 54, timingMonth: null },
        { category: "PACKAGING", amount: 36, timingMonth: null },
        { category: "TRANSPORT", amount: 54, timingMonth: null },
      ],
    };
    const totals = calculatePlan(plan);

    expect(totals.totalSeeds).toBe(16000);
    expect(totals.plantsForYield).toBe(13600);
    expect(totals.projectedYield).toBe(47600);
    expect(totals.fixedCost).toBe(2506000);
    expect(totals.variableCostPerUnit).toBe(144);
    expect(totals.variableHarvestCost).toBe(6854400);
    expect(totals.projectedRevenue).toBe(77445200);
    expect(totals.totalCost).toBe(9360400);
    expect(totals.projectedProfit).toBe(68084800);
    expect(totals.profitMargin).toBeCloseTo(0.8791, 4);
    expect(totals.returnOnCost).toBeCloseTo(7.2737, 4);
    expect(totals.costPerUnit).toBeCloseTo(196.65, 2);
    expect(totals.breakEvenPrice).toBeCloseTo(196.65, 2);
    expect(totals.breakEvenYield).toBeCloseTo(5753.17, 2);

    const monthlyPlan = {
      ...plan,
      lines: [
        ...plan.lines.filter((line) => line.category !== "WEEDING"),
        ...Array.from({ length: 6 }, (_, index) => ({
          category: "WEEDING",
          amount: 542000 / 6,
          timingMonth: index + 3,
        })),
      ],
    };
    const cashFlow = buildMonthlyCashFlow(monthlyPlan, 4, "Bell Pepper");
    expect(cashFlow[0]?.cost).toBeCloseTo(608000, 2);
    expect(cashFlow[1]?.cost).toBeCloseTo(1130000, 2);
    expect(cashFlow[2]?.cost).toBeCloseTo(316333.33, 2);
    expect(cashFlow[3]?.cost).toBeCloseTo(1232733.33, 2);
    expect(cashFlow[3]?.revenue).toBeCloseTo(12907533.33, 2);
    expect(cashFlow[3]?.net).toBeCloseTo(11674800, 2);
    expect(cashFlow[8]?.net).toBeCloseTo(11765133.33, 2);
  });
});

describe("calculateActuals", () => {
  it("aggregates expenses, labour and costed stock use against harvest and sales", () => {
    const actuals = calculateActuals({
      expenses: [
        { category: "FERTILIZER", amount: 300 },
        { category: "FERTILIZER", amount: 200 },
      ],
      labour: [{ amount: 400 }],
      stockUsage: [
        { category: "SEED", quantity: 2, unitCost: 150 },
        { category: "CHEMICAL", quantity: 1, unitCost: null },
      ],
      harvests: [{ quantity: 8 }, { quantity: 12 }],
      sales: [{ quantity: 10, price: 100 }, { quantity: 5, price: 120 }],
    });

    expect(actuals.costsByCategory).toEqual(
      new Map([["FERTILIZER", 500], ["LABOUR", 400], ["SEED", 300]]),
    );
    expect(actuals.totalCost).toBe(1200);
    expect(actuals.harvestedQuantity).toBe(20);
    expect(actuals.revenue).toBe(1600);
    expect(actuals.profit).toBe(400);
    expect(actuals.costPerUnit).toBe(60);
    expect(actuals.soldQuantity).toBe(15);
  });

  it("identifies the largest plan-to-actual profit driver", () => {
    const plan = { ...basePlan, farmgatePrice: 500 };
    const actuals = calculateActuals({
      expenses: [{ category: "FERTILIZER", amount: 5000 }],
      labour: [],
      stockUsage: [],
      harvests: [{ quantity: 900 }],
      sales: [{ quantity: 900, price: 350 }],
    });

    expect(calculateProfitVarianceDriver(plan, actuals)).toEqual({
      label: "Sale price",
      impact: -135000,
    });
  });
});

describe("buildMonthlyCashFlow", () => {
  it("assigns costs and revenue to cycle-relative months", () => {
    const cashFlow = buildMonthlyCashFlow(basePlan, 4);

    expect(cashFlow).toHaveLength(12);
    expect(cashFlow[0]).toEqual({ month: 1, cost: 1000, revenue: 0, net: -1000 });
    expect(cashFlow[2]).toEqual({ month: 3, cost: 3000, revenue: 0, net: -3000 });
    expect(cashFlow[3]).toEqual({ month: 4, cost: 0, revenue: 400000, net: 400000 });
    expect(cashFlow.reduce((sum, month) => sum + month.cost, 0)).toBe(4000);
    expect(cashFlow.reduce((sum, month) => sum + month.revenue, 0)).toBe(400000);
  });

  it("ignores invalid month indexes instead of throwing", () => {
    const plan = {
      ...basePlan,
      lines: [{ category: "SEED", amount: 500, timingMonth: 13 }],
    };

    expect(buildMonthlyCashFlow(plan, 0)).toHaveLength(12);
    expect(buildMonthlyCashFlow(plan, 0).every((month) => month.cost === 0 && month.revenue === 0)).toBe(true);
  });
});

describe("buildPlanCsv", () => {
  it("exports assumptions, plan-versus-actual totals and cycle-month cash flow safely", () => {
    const actuals = calculateActuals({
      expenses: [],
      labour: [],
      stockUsage: [],
      harvests: [{ quantity: 700 }],
      sales: [{ quantity: 700, price: 450 }],
    });
    const csv = buildPlanCsv({
      cropName: '=SUM("attack")',
      plotName: "Plot B",
      currency: "TZS",
      yieldUnit: "kg",
      plan: basePlan,
      harvestMonth: 4,
      actuals,
    });

    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain(`"Crop","'=SUM(""attack"")"`);
    expect(csv).toContain(`"Yield","800","700","-100"`);
    expect(csv).toContain(`"Cycle month","Cost","Income","Net"`);
    expect(csv).toContain(`"4","0","400000","400000"`);
  });
});
