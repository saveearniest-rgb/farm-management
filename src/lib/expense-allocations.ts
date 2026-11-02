export type ParsedExpenseAllocation = {
  cycleId?: string;
  plotId?: string;
  animalId?: string;
  animalGroupId?: string;
  animalProductLine?: "MILK" | "MEAT" | "EGGS" | "LIVE_ANIMAL" | "MANURE" | "HIDES" | "BREEDING_SERVICE" | "OTHER";
  amount: number;
};

const productLines = [
  "MILK",
  "MEAT",
  "EGGS",
  "LIVE_ANIMAL",
  "MANURE",
  "HIDES",
  "BREEDING_SERVICE",
  "OTHER",
] as const;

export function parseExpenseAllocations(
  text: string,
  totalAmount: number,
): { allocations: ParsedExpenseAllocation[]; error: null } | { allocations: null; error: string } {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (!lines.length) return { allocations: [], error: null };

  const allocations: ParsedExpenseAllocation[] = [];
  for (const line of lines) {
    const match = /^(cycle|plot|animal|group|product):([^|]+)\|\s*(\d+(?:\.\d{1,2})?)$/.exec(line);
    const targetId = match?.[2]?.trim();
    const productLine = productLines.find((line) => line.toLowerCase() === targetId?.toLowerCase());
    if (!match || !targetId || (match[1] === "product" && !productLine)) {
      return { allocations: null, error: "Use one allocation per line: cycle:<id>, plot:<id>, animal:<id>, group:<id> or product:<line> | amount." };
    }
    allocations.push({
      ...(match[1] === "cycle" ? { cycleId: targetId } : {}),
      ...(match[1] === "plot" ? { plotId: targetId } : {}),
      ...(match[1] === "animal" ? { animalId: targetId } : {}),
      ...(match[1] === "group" ? { animalGroupId: targetId } : {}),
      ...(match[1] === "product" && productLine ? { animalProductLine: productLine } : {}),
      amount: Number(match[3]),
    });
  }

  if (allocations.some((allocation) => allocation.amount <= 0) ||
      allocations.reduce((sum, allocation) => sum + Math.round(allocation.amount * 100), 0) !==
        Math.round(totalAmount * 100)) {
    return { allocations: null, error: "Split allocations must be positive and add up exactly to the expense amount." };
  }
  return { allocations, error: null };
}
