import { describe, expect, it } from "vitest";
import { areCloseRelatives, calculateExpectedBirthDate } from "./animal-breeding";

describe("animal breeding calculations", () => {
  it("calculates an expected birth date only from a configured gestation period", () => {
    const servedAt = new Date("2026-01-01T12:00:00.000Z");
    expect(calculateExpectedBirthDate(servedAt, 150)?.toISOString()).toBe("2026-05-31T12:00:00.000Z");
    expect(calculateExpectedBirthDate(servedAt, null)).toBeNull();
    expect(calculateExpectedBirthDate(servedAt, 0)).toBeNull();
  });

  it("flags parent-offspring, sibling and grandparent matings", () => {
    const animals = [
      { id: "dam", damId: "grand-dam", sireId: "grand-sire" },
      { id: "sire", damId: "grand-dam", sireId: "other-sire" },
      { id: "grand-dam", damId: null, sireId: null },
      { id: "grand-sire", damId: null, sireId: null },
      { id: "other-sire", damId: null, sireId: null },
      { id: "offspring", damId: "dam", sireId: "sire" },
    ];
    expect(areCloseRelatives("dam", "sire", animals)).toBe(true);
    expect(areCloseRelatives("dam", "offspring", animals)).toBe(true);
    expect(areCloseRelatives("grand-dam", "offspring", animals)).toBe(true);
  });

  it("does not flag unrelated animals or shared ancestors beyond the configured depth", () => {
    const animals = [
      { id: "dam", damId: "a1", sireId: "a2" },
      { id: "sire", damId: "b1", sireId: "b2" },
      { id: "a1", damId: "common-a", sireId: null },
      { id: "b1", damId: "common-b", sireId: null },
      { id: "common-a", damId: "root", sireId: null },
      { id: "common-b", damId: "root", sireId: null },
      { id: "root", damId: null, sireId: null },
      { id: "a2", damId: null, sireId: null },
      { id: "b2", damId: null, sireId: null },
    ];
    expect(areCloseRelatives("dam", "sire", animals)).toBe(false);
  });
});
