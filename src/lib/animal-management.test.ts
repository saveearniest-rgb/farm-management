import { describe, expect, it } from "vitest";
import {
  calculateAnimalGroupCount,
  calculateCurrentAnimalCount,
  calculateFeedPlan,
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
});
