import { describe, expect, it } from "vitest";
import {
  calculateAverageDailyWeightGain,
  isWithinWithdrawalPeriod,
} from "./animal-health";

describe("animal health and performance calculations", () => {
  it("flags milk or eggs recorded during an active withdrawal period", () => {
    expect(isWithinWithdrawalPeriod(
      "2026-01-01T10:00:00.000Z",
      "2026-01-04T10:00:00.000Z",
      "2026-01-03T08:00:00.000Z",
    )).toBe(true);
    expect(isWithinWithdrawalPeriod(
      "2026-01-01T10:00:00.000Z",
      "2026-01-04T10:00:00.000Z",
      "2026-01-04T10:00:00.000Z",
    )).toBe(false);
  });

  it("calculates average daily gain from consecutive same-animal, same-unit weights", () => {
    expect(calculateAverageDailyWeightGain([
      { animalId: "a1", type: "WEIGHT", quantity: 20, unit: "kg", recordedAt: "2026-01-01T00:00:00.000Z" },
      { animalId: "a1", type: "WEIGHT", quantity: 26, unit: "kg", recordedAt: "2026-01-04T00:00:00.000Z" },
      { animalId: "a2", type: "WEIGHT", quantity: 10, unit: "kg", recordedAt: "2026-01-01T00:00:00.000Z" },
      { animalId: "a2", type: "WEIGHT", quantity: 16, unit: "kg", recordedAt: "2026-01-04T00:00:00.000Z" },
    ])).toBe(2);
  });

  it("does not compare group measurements or incompatible units as individual weight gain", () => {
    expect(calculateAverageDailyWeightGain([
      { animalId: null, type: "WEIGHT", quantity: 20, unit: "kg", recordedAt: "2026-01-01T00:00:00.000Z" },
      { animalId: null, type: "WEIGHT", quantity: 26, unit: "kg", recordedAt: "2026-01-04T00:00:00.000Z" },
      { animalId: "a1", type: "WEIGHT", quantity: 20, unit: "kg", recordedAt: "2026-01-01T00:00:00.000Z" },
      { animalId: "a1", type: "WEIGHT", quantity: 26, unit: "lb", recordedAt: "2026-01-04T00:00:00.000Z" },
    ])).toBeNull();
  });
});
