export type AnimalCountEvent = {
  type: "BIRTH" | "PURCHASE" | "SALE" | "DEATH" | "CULLED" | "WEANING" | "MOVE" | "OTHER";
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
