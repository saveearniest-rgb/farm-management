import ExcelJS from "exceljs";
import {
  calculatePlan,
  isVariableCostCategory,
  variableCostCategories,
  type CropPlanNumbers,
} from "./economics";

export type PlanWorkbookData = {
  cropName: string;
  plotName: string;
  scenario: string;
  currency: string;
  yieldUnit: string;
  harvestMonth: number | null;
  figureLabel: string;
  plan: CropPlanNumbers;
  lines: Array<{
    category: string;
    amount: number;
    timingMonth: number | null;
    figureLabel: string;
  }>;
};

function formula(cell: ExcelJS.Cell, expression: string, result: number) {
  cell.value = { formula: expression, result };
}

function sourceLabel(label: string) {
  return label.replaceAll("_", " ");
}

export async function buildPlanWorkbook(data: PlanWorkbookData) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Shamba";
  workbook.subject = `${data.cropName} plan`;
  workbook.calcProperties.fullCalcOnLoad = true;

  const totals = calculatePlan(data.plan);
  const variableHarvestCost = totals.variableHarvestCost ?? 0;
  const variableCostPerUnit = totals.variableCostPerUnit;
  const establishmentCost = totals.fixedCost;
  const lineStart = 24;
  const lineEnd = lineStart + Math.max(data.lines.length, 1) - 1;
  const totalCostRow = lineEnd + 1;
  const variableCostRow = totalCostRow + 1;
  const variableRateRow = totalCostRow + 2;
  const establishmentRow = totalCostRow + 3;
  const assumptions = workbook.addWorksheet("Assumptions");
  assumptions.columns = [
    { width: 36 },
    { width: 18 },
    { width: 22 },
    { width: 30 },
    { width: 20 },
  ];
  assumptions.mergeCells("A1:E1");
  assumptions.getCell("A1").value = `${data.cropName} crop plan`;
  assumptions.getCell("A2").value = "Plot";
  assumptions.getCell("B2").value = data.plotName;
  assumptions.getCell("A3").value = "Scenario";
  assumptions.getCell("B3").value = data.scenario.replaceAll("_", " ");
  assumptions.getRow(5).values = ["Assumption", "Value", "Unit", "Source"];
  const inputs: Array<[string, number | null, string, string]> = [
    ["Area", data.plan.areaAcres, "acres", data.figureLabel],
    ["Seed quantity", data.plan.seedGrams, "g", data.figureLabel],
    ["Seeds per gram", data.plan.seedsPerGram, "seeds/g", data.figureLabel],
    ["Germination rate", data.plan.germinationRate, "fraction", data.figureLabel],
    ["Nursery survival rate", data.plan.survivalRate, "fraction", data.figureLabel],
    ["Plants per acre", data.plan.plantsPerAcre, "plants/acre", data.figureLabel],
    ["Yield per plant", data.plan.yieldPerPlant, data.yieldUnit, data.figureLabel],
    ["Farmgate price", data.plan.farmgatePrice, `${data.currency}/${data.yieldUnit}`, data.figureLabel],
    ["First harvest month", data.harvestMonth, "cycle month", data.figureLabel],
  ];
  inputs.forEach(([label, value, unit, source], index) => {
    const row = index + 6;
    assumptions.getRow(row).values = [label, value, unit, sourceLabel(source)];
  });
  formula(assumptions.getCell("B16"), "B7*B8", totals.totalSeeds ?? 0);
  assumptions.getCell("A16").value = "Total seeds";
  assumptions.getCell("C16").value = "seeds";
  assumptions.getCell("D16").value = "Calculated";
  formula(
    assumptions.getCell("B17"),
    "B16*B9*B10",
    totals.survivingSeedlings ?? 0,
  );
  assumptions.getCell("A17").value = "Surviving seedlings";
  assumptions.getCell("C17").value = "plants";
  assumptions.getCell("D17").value = "Calculated";
  formula(assumptions.getCell("B18"), "B6*B11", totals.intendedPlants ?? 0);
  assumptions.getCell("A18").value = "Intended plants";
  assumptions.getCell("C18").value = "plants";
  assumptions.getCell("D18").value = "Calculated";
  formula(assumptions.getCell("B19"), "MIN(B17,B18)", totals.plantsForYield ?? 0);
  assumptions.getCell("A19").value = "Plants for yield";
  assumptions.getCell("C19").value = "plants";
  assumptions.getCell("D19").value = "Calculated";
  formula(
    assumptions.getCell("B20"),
    "B19*B12",
    totals.projectedYield ?? 0,
  );
  assumptions.getCell("A20").value = "Projected yield";
  assumptions.getCell("C20").value = data.yieldUnit;
  assumptions.getCell("D20").value = "Calculated";
  formula(
    assumptions.getCell("B21"),
    "B20*B13",
    totals.projectedRevenue ?? 0,
  );
  assumptions.getCell("A21").value = "Projected revenue";
  assumptions.getCell("C21").value = data.currency;
  assumptions.getCell("D21").value = "Calculated";
  assumptions.getCell("B9").numFmt = "0.00%";
  assumptions.getCell("B10").numFmt = "0.00%";

  assumptions.getRow(23).values = ["Planned cost", "Amount or unit rate", "Cycle month", "Source", "Unit"];
  data.lines.forEach((line, index) => {
    assumptions.getRow(lineStart + index).values = [
      line.category.replaceAll("_", " "),
      line.amount,
      line.timingMonth,
      sourceLabel(line.figureLabel),
      isVariableCostCategory(line.category)
        ? `${data.currency}/${data.yieldUnit}`
        : data.currency,
    ];
  });
  const amountRange = data.lines.length
    ? `B${lineStart}:B${lineEnd}`
    : "B24:B24";
  const categoryRange = data.lines.length
    ? `A${lineStart}:A${lineEnd}`
    : "A24:A24";
  if (data.lines.length) {
    formula(
      assumptions.getCell(`B${totalCostRow}`),
      `SUMIFS(${amountRange},${categoryRange},"<>HARVEST",${categoryRange},"<>PACKAGING",${categoryRange},"<>TRANSPORT")+B${variableRateRow}*B20`,
      totals.totalCost ?? 0,
    );
  } else {
    assumptions.getCell(`B${totalCostRow}`).value = 0;
  }
  assumptions.getCell(`A${totalCostRow}`).value = "Total planned cost";
  assumptions.getCell(`C${totalCostRow}`).value = data.currency;
  assumptions.getCell(`D${totalCostRow}`).value = "Calculated";
  const variableFormula = variableCostCategories
    .map((category) => `SUMIF(${categoryRange},"${category.replaceAll("_", " ")}",${amountRange})`)
    .join("+");
  formula(assumptions.getCell(`B${variableCostRow}`), `B${variableRateRow}*B20`, variableHarvestCost);
  assumptions.getCell(`A${variableCostRow}`).value = "Variable harvest costs";
  assumptions.getCell(`C${variableCostRow}`).value = data.currency;
  assumptions.getCell(`D${variableCostRow}`).value = "Calculated";
  formula(
    assumptions.getCell(`B${variableRateRow}`),
    variableFormula || "0",
    variableCostPerUnit,
  );
  assumptions.getCell(`A${variableRateRow}`).value = "Variable cost per unit";
  assumptions.getCell(`C${variableRateRow}`).value = `${data.currency}/${data.yieldUnit}`;
  assumptions.getCell(`D${variableRateRow}`).value = "Calculated";
  formula(
    assumptions.getCell(`B${establishmentRow}`),
    `B${totalCostRow}-B${variableCostRow}`,
    establishmentCost,
  );
  assumptions.getCell(`A${establishmentRow}`).value = "Establishment and management cost";
  assumptions.getCell(`C${establishmentRow}`).value = data.currency;
  assumptions.getCell(`D${establishmentRow}`).value = "Calculated";
  assumptions.getColumn(2).numFmt = "#,##0.00";

  const bellPepper = data.cropName.toLowerCase().includes("bell pepper");
  const monthCount = bellPepper ? 9 : 12;
  const curve = Array<number>(monthCount).fill(0);
  if (bellPepper) {
    for (let month = 4; month <= 9; month += 1) curve[month - 1] = 1 / 6;
  } else if (
    data.harvestMonth !== null &&
    data.harvestMonth >= 1 &&
    data.harvestMonth <= monthCount
  ) {
    curve[data.harvestMonth - 1] = 1;
  }
  const monthly = Array.from({ length: monthCount }, (_, index) => {
    const month = index + 1;
    const fixedCost = data.lines
      .filter((line) => line.timingMonth === month && !isVariableCostCategory(line.category))
      .reduce((sum, line) => sum + line.amount, 0);
    const cost = fixedCost + variableHarvestCost * curve[index]!;
    const revenue = (totals.projectedRevenue ?? 0) * curve[index]!;
    return { month, cost, share: curve[index]!, revenue, net: revenue - cost };
  });
  let cumulative = 0;
  const cashFlow = workbook.addWorksheet("Monthly Cash Flow");
  cashFlow.columns = [
    { width: 14 },
    { width: 22 },
    { width: 22 },
    { width: 24 },
    { width: 22 },
    { width: 22 },
    { width: 24 },
  ];
  cashFlow.mergeCells("A1:G1");
  cashFlow.getCell("A1").value = "Monthly cash flow";
  cashFlow.getRow(3).values = [
    "Cycle month",
    "Planned costs",
    "Harvest share (editable)",
    `Harvest (${data.yieldUnit})`,
    `Revenue (${data.currency})`,
    `Net (${data.currency})`,
    `Cumulative (${data.currency})`,
  ];
  monthly.forEach((month, index) => {
    const row = index + 4;
    const lineMonthRange = data.lines.length
      ? `Assumptions!$C$${lineStart}:$C$${lineEnd}`
      : "Assumptions!$C$24:$C$24";
    const lineAmountRange = data.lines.length
      ? `Assumptions!$B$${lineStart}:$B$${lineEnd}`
      : "Assumptions!$B$24:$B$24";
    const lineCategoryRange = data.lines.length
      ? `Assumptions!$A$${lineStart}:$A$${lineEnd}`
      : "Assumptions!$A$24:$A$24";
    cashFlow.getCell(`A${row}`).value = month.month;
    formula(
      cashFlow.getCell(`B${row}`),
      `SUMIFS(${lineAmountRange},${lineMonthRange},A${row},${lineCategoryRange},"<>HARVEST",${lineCategoryRange},"<>PACKAGING",${lineCategoryRange},"<>TRANSPORT")+Assumptions!$B$${variableRateRow}*D${row}`,
      month.cost,
    );
    cashFlow.getCell(`C${row}`).value = month.share;
    cashFlow.getCell(`C${row}`).numFmt = "0.00%";
    formula(
      cashFlow.getCell(`D${row}`),
      `Assumptions!$B$20*C${row}`,
      (totals.projectedYield ?? 0) * month.share,
    );
    formula(
      cashFlow.getCell(`E${row}`),
      `D${row}*Assumptions!$B$13`,
      month.revenue,
    );
    formula(cashFlow.getCell(`F${row}`), `E${row}-B${row}`, month.net);
    cumulative += month.net;
    formula(
      cashFlow.getCell(`G${row}`),
      index === 0 ? `F${row}` : `G${row - 1}+F${row}`,
      cumulative,
    );
    cashFlow.getCell(`C${row}`).dataValidation = {
      type: "decimal",
      operator: "between",
      formulae: [0, 1],
      allowBlank: false,
    };
  });
  const harvestShareTotalRow = monthCount + 4;
  cashFlow.getCell(`A${harvestShareTotalRow}`).value = "Harvest-share total (target 100%)";
  formula(
    cashFlow.getCell(`C${harvestShareTotalRow}`),
    `SUM(C4:C${monthCount + 3})`,
    curve.reduce((sum, share) => sum + share, 0),
  );
  cashFlow.getCell(`C${harvestShareTotalRow}`).numFmt = "0.00%";
  cashFlow.getCell(`D${harvestShareTotalRow}`).value = "Edit the monthly shares to reshape the harvest curve.";

  const summary = workbook.addWorksheet("Income Summary");
  summary.columns = [{ width: 38 }, { width: 22 }, { width: 30 }, { width: 22 }];
  summary.mergeCells("A1:C1");
  summary.getCell("A1").value = `${data.cropName} income summary`;
  summary.getRow(3).values = ["Measure", "Value", "Unit", "Source"];
  const summaryRows: Array<[string, string, string, number, string]> = [
    ["Total seeds", `Assumptions!B16`, "seeds", totals.totalSeeds ?? 0, "Calculated"],
    ["Plants for transplant", "Assumptions!B19", "plants", totals.plantsForYield ?? 0, "Calculated"],
    ["Total yield", "Assumptions!B20", data.yieldUnit, totals.projectedYield ?? 0, "Calculated"],
    ["Establishment and management cost", `Assumptions!B${establishmentRow}`, data.currency, establishmentCost, "Calculated"],
    ["Variable cost per unit", `Assumptions!B${variableRateRow}`, `${data.currency}/${data.yieldUnit}`, variableCostPerUnit, "Calculated"],
    ["Variable harvest cost", `Assumptions!B${variableCostRow}`, data.currency, variableHarvestCost, "Calculated"],
    ["Revenue", "Assumptions!B21", data.currency, totals.projectedRevenue ?? 0, "Calculated"],
    ["Total cost", `Assumptions!B${totalCostRow}`, data.currency, totals.totalCost ?? 0, "Calculated"],
    ["Profit", `B10-B11`, data.currency, (totals.projectedProfit ?? 0), "Calculated"],
    ["Profit margin", "IFERROR(B12/B10,0)", "fraction", totals.projectedRevenue ? (totals.projectedProfit ?? 0) / totals.projectedRevenue : 0, "Calculated"],
    ["Cost per unit", "IFERROR(B11/B6,0)", `${data.currency}/${data.yieldUnit}`, totals.costPerUnit ?? 0, "Calculated"],
    ["Profit per unit", "Assumptions!B13-B14", `${data.currency}/${data.yieldUnit}`, (data.plan.farmgatePrice ?? 0) - (totals.costPerUnit ?? 0), "Calculated"],
    ["Break-even price", "B14", `${data.currency}/${data.yieldUnit}`, totals.breakEvenPrice ?? 0, "Calculated"],
    ["Break-even yield", `IFERROR(B11*1/Assumptions!B13,0)`, data.yieldUnit, totals.breakEvenYield ?? 0, "Calculated"],
    ["Return on planned cost", "IFERROR(B12/B11,0)", "fraction", totals.totalCost ? (totals.projectedProfit ?? 0) / totals.totalCost : 0, "Calculated"],
  ];
  summaryRows.forEach(([label, ref, unit, result, source], index) => {
    const row = index + 4;
    summary.getCell(`A${row}`).value = label;
    formula(summary.getCell(`B${row}`), ref, result);
    summary.getCell(`C${row}`).value = unit;
    summary.getCell(`D${row}`).value = source;
  });
  summary.getColumn(2).numFmt = "#,##0.00";
  summary.getCell("B13").numFmt = "0.00%";
  summary.getCell("B18").numFmt = "0.00%";
  summary.getCell("A20").value = `Source label on assumptions: ${sourceLabel(data.figureLabel)}. Review all inputs before use.`;
  return Buffer.from(await workbook.xlsx.writeBuffer());
}
