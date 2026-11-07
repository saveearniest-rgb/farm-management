export type AnimalCountEvent = {
  type: "BIRTH" | "PURCHASE" | "SALE" | "DEATH" | "CULLED" | "WEANING" | "MOVE" | "BREEDING" | "OTHER";
  quantity: number | null;
};

export function calculateAnimalGroupCount(
  startingCount: number,
  events: AnimalCountEvent[],
) {
  return events.reduce((count, event) => {
    const quantity = event.quantity ?? 0;
    if (event.type === "BIRTH" || event.type === "PURCHASE") return count + quantity;
    if (event.type === "SALE" || event.type === "DEATH" || event.type === "CULLED") {
      return count - quantity;
    }
    return count;
  }, startingCount);
}

export function calculateCurrentAnimalCount({
  trackingMode,
  startingCount,
  events,
  activeTaggedCount,
}: {
  trackingMode: "INDIVIDUAL" | "HEAD_COUNT";
  startingCount: number;
  events: AnimalCountEvent[];
  activeTaggedCount: number;
}) {
  return trackingMode === "INDIVIDUAL"
    ? activeTaggedCount
    : calculateAnimalGroupCount(startingCount, events);
}

export function calculateFeedPlan({
  groupCount,
  quantityPerHead,
  days,
  stock,
}: {
  groupCount: number;
  quantityPerHead: number;
  days: number;
  stock: number;
}) {
  const plannedQuantity = groupCount * quantityPerHead * days;
  return {
    plannedQuantity,
    stock,
    shortfall: Math.max(0, plannedQuantity - stock),
    daysRemaining:
      groupCount > 0 && quantityPerHead > 0 ? stock / (groupCount * quantityPerHead) : null,
  };
}

export function calculateFeedNutrientIntake({
  groupCount,
  quantityPerHead,
  unit,
  days,
  crudeProteinPct,
  crudeFiberPct,
}: {
  groupCount: number;
  quantityPerHead: number;
  unit: string;
  days: number;
  crudeProteinPct: number | null;
  crudeFiberPct: number | null;
}) {
  const kilogramsPerUnit: Record<string, number> = {
    kg: 1,
    kilogram: 1,
    kilograms: 1,
    g: 0.001,
    gram: 0.001,
    grams: 0.001,
    t: 1000,
    tonne: 1000,
    tonnes: 1000,
  };
  const factor = kilogramsPerUnit[unit.trim().toLocaleLowerCase()];
  if (factor === undefined) return null;

  const dailyFeedPerHeadKg = quantityPerHead * factor;
  const dailyFeedGroupKg = groupCount * dailyFeedPerHeadKg;
  return {
    dailyFeedPerHeadKg,
    dailyFeedGroupKg,
    plannedFeedKg: dailyFeedGroupKg * days,
    dailyCrudeProteinGroupKg: crudeProteinPct === null
      ? null
      : dailyFeedGroupKg * crudeProteinPct / 100,
    plannedCrudeProteinKg: crudeProteinPct === null
      ? null
      : dailyFeedGroupKg * days * crudeProteinPct / 100,
    dailyCrudeFiberGroupKg: crudeFiberPct === null
      ? null
      : dailyFeedGroupKg * crudeFiberPct / 100,
    plannedCrudeFiberKg: crudeFiberPct === null
      ? null
      : dailyFeedGroupKg * days * crudeFiberPct / 100,
  };
}
