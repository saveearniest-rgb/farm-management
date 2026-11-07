import { describe, expect, it } from "vitest";
import {
  calculateAnimalGroupCount,
  calculateCurrentAnimalCount,
  calculateFeedPlan,
  calculateFeedNutrientIntake,
} from "./animal-management";

describe("animal group and feed calculations", () => {
  it("calculates a group's current count from events", () => {
    expect(calculateAnimalGroupCount(12, [
      { type: "BIRTH", quantity: 3 },
      { type: "PURCHASE", quantity: 2 },
      { type: "DEATH", quantity: 1 },
      { type: "SALE", quantity: 4 },
    ])).toBe(12);
  });

  it("uses active tagged animals for individually tracked groups", () => {
    expect(calculateCurrentAnimalCount({
      trackingMode: "INDIVIDUAL",
      startingCount: 0,
      events: [{ type: "BIRTH", quantity: 99 }],
      activeTaggedCount: 4,
    })).toBe(4);
  });

  it("calculates feed demand, stock shortfall and days remaining", () => {
    expect(calculateFeedPlan({
      groupCount: 20,
      quantityPerHead: 0.25,
      days: 10,
      stock: 30,
    })).toEqual({
      plannedQuantity: 50,
      stock: 30,
      shortfall: 20,
      daysRemaining: 6,
    });
  });

  it("reports no feed shortfall when stock covers the plan", () => {
    expect(calculateFeedPlan({
      groupCount: 5,
      quantityPerHead: 1,
      days: 2,
      stock: 20,
    }).shortfall).toBe(0);
  });

  it("calculates feed and recorded nutrient intake in kilograms", () => {
    expect(calculateFeedNutrientIntake({
      groupCount: 20,
      quantityPerHead: 0.25,
      unit: "kg",
      days: 10,
      crudeProteinPct: 16,
      crudeFiberPct: 12,
    })).toEqual({
      dailyFeedPerHeadKg: 0.25,
      dailyFeedGroupKg: 5,
      plannedFeedKg: 50,
      dailyCrudeProteinGroupKg: 0.8,
      plannedCrudeProteinKg: 8,
      dailyCrudeFiberGroupKg: 0.6,
      plannedCrudeFiberKg: 6,
    });
  });

  it("does not infer nutrient mass for unknown feed units", () => {
    expect(calculateFeedNutrientIntake({
      groupCount: 4,
      quantityPerHead: 2,
      unit: "bag",
      days: 30,
      crudeProteinPct: 16,
      crudeFiberPct: null,
    })).toBeNull();
  });
});
