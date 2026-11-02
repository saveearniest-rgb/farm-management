export type AnimalLineage = {
  id: string;
  damId: string | null;
  sireId: string | null;
};

export function calculateExpectedBirthDate(servedAt: Date, gestationDays: number | null) {
  if (gestationDays === null || !Number.isInteger(gestationDays) || gestationDays <= 0) return null;
  return new Date(servedAt.getTime() + gestationDays * 86_400_000);
}

function ancestors(animalId: string, animals: AnimalLineage[], maxDepth: number) {
  const byId = new Map(animals.map((animal) => [animal.id, animal]));
  const result = new Map<string, number>();
  const queue: Array<{ id: string; depth: number }> = [{ id: animalId, depth: 0 }];
  while (queue.length) {
    const current = queue.shift()!;
    if (current.depth >= maxDepth) continue;
    const animal = byId.get(current.id);
    if (!animal) continue;
    for (const parentId of [animal.damId, animal.sireId]) {
      if (!parentId) continue;
      const depth = current.depth + 1;
      if ((result.get(parentId) ?? Number.POSITIVE_INFINITY) <= depth) continue;
      result.set(parentId, depth);
      queue.push({ id: parentId, depth });
    }
  }
  return result;
}

export function areCloseRelatives(
  damId: string,
  sireId: string,
  animals: AnimalLineage[],
  maxDepth = 2,
) {
  if (damId === sireId) return true;
  const damAncestors = ancestors(damId, animals, maxDepth);
  const sireAncestors = ancestors(sireId, animals, maxDepth);
  if (damAncestors.has(sireId) || sireAncestors.has(damId)) return true;
  return [...damAncestors.keys()].some((ancestorId) => sireAncestors.has(ancestorId));
}
