import { describe, expect, it } from "vitest";
import { parseExpenseAllocations } from "./expense-allocations";

describe("parseExpenseAllocations", () => {
  it("accepts cycle and plot splits that exactly equal the expense", () => {
    expect(parseExpenseAllocations("cycle:cycle-a | 12.50\nplot:plot-b | 7.50", 20)).toEqual({
      allocations: [
        { cycleId: "cycle-a", amount: 12.5 },
        { plotId: "plot-b", amount: 7.5 },
      ],
      error: null,
    });

  });

  it("accepts animal and group allocations", () => {
    expect(parseExpenseAllocations("animal:animal-a | 8\ngroup:group-b | 12", 20)).toEqual({
      allocations: [
        { animalId: "animal-a", amount: 8 },
        { animalGroupId: "group-b", amount: 12 },
      ],
      error: null,
    });
  });

  it("rejects malformed, non-positive and unequal allocations", () => {
    expect(parseExpenseAllocations("cycle:c-1 | 9.99", 10).error).toContain("add up exactly");
    expect(parseExpenseAllocations("cycle:c-1 | 0", 10).error).toContain("positive");
    expect(parseExpenseAllocations("cycle:c-1 - 10", 10).error).toContain("Use one allocation");
    expect(parseExpenseAllocations("cycle:c-1 | 1.001", 1).error).toContain("Use one allocation");
  });
});
