import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { buildPlanWorkbook } from "./plan-workbook";

async function loadWorkbook(buffer: Buffer) {
  const arrayBuffer = new ArrayBuffer(buffer.byteLength);
  new Uint8Array(arrayBuffer).set(buffer);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(arrayBuffer);
  return workbook;
}

const workbookData = {
  cropName: "Bell Pepper",
  plotName: "Plot A",
  scenario: "EXPECTED",
  currency: "TZS",
  yieldUnit: "kg",
  harvestMonth: 4,
  figureLabel: "PLACEHOLDER_BENCHMARK",
  plan: {
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
      ...Array.from({ length: 6 }, (_, index) => ({
        category: "WEEDING",
        amount: 542000 / 6,
        timingMonth: index + 3,
      })),
      { category: "HARVEST", amount: 54, timingMonth: null },
      { category: "PACKAGING", amount: 36, timingMonth: null },
      { category: "TRANSPORT", amount: 54, timingMonth: null },
    ],
  },
  lines: [
    ...[
      ["SEED", 120000, 1, "LOCAL_QUOTE"],
      ["LAND_PREP", 217000, 1, "PLACEHOLDER_BENCHMARK"],
      ["NURSERY", 271000, 1, "PLACEHOLDER_BENCHMARK"],
      ["TRANSPLANTING", 271000, 2, "PLACEHOLDER_BENCHMARK"],
      ["IRRIGATION", 633000, 2, "PLACEHOLDER_BENCHMARK"],
      ["FERTILIZER", 226000, 2, "PLACEHOLDER_BENCHMARK"],
      ["FERTILIZER", 226000, 3, "PLACEHOLDER_BENCHMARK"],
      ...Array.from({ length: 6 }, (_, index) => [
        "WEEDING",
        542000 / 6,
        index + 3,
        "PLACEHOLDER_BENCHMARK",
      ]),
      ["HARVEST", 54, null, "PLACEHOLDER_BENCHMARK"],
      ["PACKAGING", 36, null, "PLACEHOLDER_BENCHMARK"],
      ["TRANSPORT", 54, null, "PLACEHOLDER_BENCHMARK"],
    ].map(([category, amount, timingMonth, figureLabel]) => ({
      category: String(category),
      amount: Number(amount),
      timingMonth: timingMonth === null ? null : Number(timingMonth),
      figureLabel: String(figureLabel),
    })),
  ],
};

describe("buildPlanWorkbook", () => {
  it("exports the saved assumptions, cash flow, and linked economics formulas", async () => {
    const workbook = await loadWorkbook(await buildPlanWorkbook(workbookData));

    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual([
      "Assumptions",
      "Monthly Cash Flow",
      "Income Summary",
    ]);

    const assumptions = workbook.getWorksheet("Assumptions")!;
    const cashFlow = workbook.getWorksheet("Monthly Cash Flow")!;
    const summary = workbook.getWorksheet("Income Summary")!;
    expect(assumptions.getCell("B40").value).toMatchObject({
      formula: 'SUMIFS(B24:B39,A24:A39,"<>HARVEST",A24:A39,"<>PACKAGING",A24:A39,"<>TRANSPORT")+B42*B20',
    });
    expect((assumptions.getCell("B40").value as ExcelJS.CellFormulaValue).result).toBeCloseTo(9360400, 2);
    expect(assumptions.getCell("D24").value).toBe("LOCAL QUOTE");
    expect(assumptions.getCell("E39").value).toBe("TZS/kg");
    expect(summary.getCell("B4").value).toMatchObject({ formula: "Assumptions!B16", result: 16000 });
    expect(summary.getCell("B5").value).toMatchObject({ formula: "Assumptions!B19", result: 13600 });
    expect(summary.getCell("B6").value).toMatchObject({ formula: "Assumptions!B20", result: 47600 });
    expect(summary.getCell("B7").value).toMatchObject({ formula: "Assumptions!B43" });
    expect((summary.getCell("B7").value as ExcelJS.CellFormulaValue).result).toBeCloseTo(2506000, 2);
    expect(summary.getCell("B8").value).toMatchObject({ formula: "Assumptions!B42", result: 144 });
    expect(summary.getCell("B9").value).toMatchObject({ formula: "Assumptions!B41", result: 6854400 });
    expect(summary.getCell("B10").value).toMatchObject({ formula: "Assumptions!B21", result: 77445200 });
    expect(summary.getCell("B11").value).toMatchObject({ formula: "Assumptions!B40" });
    expect((summary.getCell("B11").value as ExcelJS.CellFormulaValue).result).toBeCloseTo(9360400, 2);
    expect(summary.getCell("B12").value).toMatchObject({ formula: "B10-B11" });
    expect((summary.getCell("B12").value as ExcelJS.CellFormulaValue).result).toBeCloseTo(68084800, 2);
    expect(summary.getCell("B13").value).toMatchObject({ formula: "IFERROR(B12/B10,0)" });
    expect((summary.getCell("B13").value as ExcelJS.CellFormulaValue).result).toBeCloseTo(0.8791, 4);
    expect(summary.getCell("B14").value).toMatchObject({ formula: "IFERROR(B11/B6,0)" });
    expect((summary.getCell("B14").value as ExcelJS.CellFormulaValue).result).toBeCloseTo(9360400 / 47600, 2);
    expect(summary.getCell("B15").value).toMatchObject({ formula: "Assumptions!B13-B14" });
    expect((summary.getCell("B15").value as ExcelJS.CellFormulaValue).result).toBeCloseTo(1627 - 9360400 / 47600, 2);
    expect(summary.getCell("B16").value).toMatchObject({ formula: "B14" });
    expect((summary.getCell("B16").value as ExcelJS.CellFormulaValue).result).toBeCloseTo(9360400 / 47600, 2);
    expect(summary.getCell("B17").value).toMatchObject({ formula: "IFERROR(B11*1/Assumptions!B13,0)" });
    expect((summary.getCell("B17").value as ExcelJS.CellFormulaValue).result).toBeCloseTo(9360400 / 1627, 2);
    expect(summary.getCell("B18").value).toMatchObject({ formula: "IFERROR(B12/B11,0)" });
    expect((summary.getCell("B18").value as ExcelJS.CellFormulaValue).result).toBeCloseTo(7.2737, 4);
    expect(cashFlow.getCell("B4").value).toMatchObject({ formula: expect.stringContaining("SUMIFS"), result: 608000 });
    expect(cashFlow.getCell("B5").value).toMatchObject({ result: 1130000 });
    expect(cashFlow.getCell("D7").value).toMatchObject({ formula: "Assumptions!$B$20*C7" });
    expect(cashFlow.getCell("E7").value).toMatchObject({ formula: "D7*Assumptions!$B$13" });
    expect(cashFlow.getCell("C7").dataValidation).toMatchObject({
      type: "decimal",
      operator: "between",
      formulae: [0, 1],
    });
    expect((cashFlow.getCell("F7").value as ExcelJS.CellFormulaValue).result).toBeCloseTo(11674800, 2);
    expect((cashFlow.getCell("F12").value as ExcelJS.CellFormulaValue).result).toBeCloseTo(11765133.333333334);
    expect(cashFlow.getCell("A13").value).toBe("Harvest-share total (target 100%)");
    expect((cashFlow.getCell("C13").value as ExcelJS.CellFormulaValue).result).toBeCloseTo(1, 8);
  });

  it("keeps the total-cost formula outside the blank cost-line row", async () => {
    const data = {
      ...workbookData,
      plan: { ...workbookData.plan, lines: [] },
      lines: [],
    };
    const workbook = await loadWorkbook(await buildPlanWorkbook(data));

    const assumptions = workbook.getWorksheet("Assumptions")!;
    expect(assumptions.getCell("B25").value).toBe(0);
    expect(assumptions.getCell("B24").value).toBeNull();
  });
});
