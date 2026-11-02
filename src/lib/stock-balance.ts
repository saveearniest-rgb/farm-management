export type StockMovementInput = {
  type: "PURCHASE" | "USAGE" | "ADJUSTMENT";
  quantity: number;
  unitCost: number | null;
};

export function calculateStockBalance(movements: StockMovementInput[]) {
  let quantity = 0;
  let inventoryValue = 0;
  for (const movement of movements) {
    if (movement.type === "PURCHASE") {
      quantity += movement.quantity;
      inventoryValue += movement.quantity * (movement.unitCost ?? 0);
    } else if (movement.type === "USAGE") {
      if (quantity > 0) inventoryValue -= (inventoryValue / quantity) * movement.quantity;
      quantity -= movement.quantity;
    } else {
      const averageCost = quantity > 0 ? inventoryValue / quantity : 0;
      quantity += movement.quantity;
      inventoryValue += averageCost * movement.quantity;
    }
  }
  return {
    quantity,
    averageUnitCost: quantity > 0 ? inventoryValue / quantity : 0,
    inventoryValue,
  };
}
