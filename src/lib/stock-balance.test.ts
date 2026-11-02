import { describe, expect, it } from "vitest";
import { calculateStockBalance } from "./stock-balance";

describe("weighted-average stock balance", () => {
  it("calculates unit cost from recorded purchases", () => {
    expect(calculateStockBalance([
      { type: "PURCHASE", quantity: 10, unitCost: 100 },
      { type: "PURCHASE", quantity: 5, unitCost: 200 },
    ])).toEqual({
      quantity: 15,
      averageUnitCost: 2000 / 15,
      inventoryValue: 2000,
    });
  });

  it("preserves average cost across usage and stock adjustments", () => {
    expect(calculateStockBalance([
      { type: "PURCHASE", quantity: 10, unitCost: 100 },
      { type: "USAGE", quantity: 2, unitCost: 100 },
      { type: "ADJUSTMENT", quantity: 5, unitCost: null },
    ])).toEqual({
      quantity: 13,
      averageUnitCost: 100,
      inventoryValue: 1300,
    });
  });
});
