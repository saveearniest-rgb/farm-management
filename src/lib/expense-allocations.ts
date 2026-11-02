export type ParsedExpenseAllocation = {
  cycleId?: string;
  plotId?: string;
  animalId?: string;
  animalGroupId?: string;
  amount: number;
};

export function parseExpenseAllocations(
  text: string,
  totalAmount: number,
): { allocations: ParsedExpenseAllocation[]; error: null } | { allocations: null; error: string } {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (!lines.length) return { allocations: [], error: null };

  const allocations: ParsedExpenseAllocation[] = [];
  for (const line of lines) {
    const match = /^(cycle|plot|animal|group):([^|]+)\|\s*(\d+(?:\.\d{1,2})?)$/.exec(line);
    const targetId = match?.[2]?.trim();
    if (!match || !targetId) {
      return { allocations: null, error: "Use one allocation per line: cycle:<id>, plot:<id>, animal:<id> or group:<id> | amount." };
    }
    allocations.push({
      ...(match[1] === "cycle" ? { cycleId: targetId } : {}),
      ...(match[1] === "plot" ? { plotId: targetId } : {}),
      ...(match[1] === "animal" ? { animalId: targetId } : {}),
      ...(match[1] === "group" ? { animalGroupId: targetId } : {}),
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
