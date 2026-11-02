export type AnimalWeightRecord = {
  animalId: string | null;
  type: string;
  quantity: number;
  unit: string;
  recordedAt: string | null;
};

export function isWithinWithdrawalPeriod(
  administeredAt: string | null,
  withdrawalUntil: string | null,
  collectedAt: string | null,
) {
  if (!administeredAt || !withdrawalUntil || !collectedAt) return false;
  const administered = new Date(administeredAt).getTime();
  const collected = new Date(collectedAt).getTime();
  const ends = new Date(withdrawalUntil).getTime();
  return Number.isFinite(administered) &&
    Number.isFinite(collected) &&
    Number.isFinite(ends) &&
    collected >= administered &&
    collected < ends;
}

export function calculateAverageDailyWeightGain(records: AnimalWeightRecord[]) {
  const weights = records.filter(
    (record) => record.type === "WEIGHT" && record.animalId && record.recordedAt,
  );
  if (new Set(weights.map((record) => record.unit)).size > 1) return null;
  const byAnimal = new Map<string, AnimalWeightRecord[]>();
  for (const record of weights) {
    if (!record.animalId) continue;
    const animalRecords = byAnimal.get(record.animalId) ?? [];
    animalRecords.push(record);
    byAnimal.set(record.animalId, animalRecords);
  }
  const dailyGains: number[] = [];

  for (const animalRecords of byAnimal.values()) {
    animalRecords.sort((a, b) =>
      new Date(a.recordedAt ?? 0).getTime() - new Date(b.recordedAt ?? 0).getTime(),
    );
    for (let index = 1; index < animalRecords.length; index += 1) {
      const previous = animalRecords[index - 1]!;
      const current = animalRecords[index]!;
      const elapsedDays = (
        new Date(current.recordedAt ?? 0).getTime() - new Date(previous.recordedAt ?? 0).getTime()
      ) / 86_400_000;
      if (elapsedDays <= 0) continue;
      dailyGains.push((current.quantity - previous.quantity) / elapsedDays);
    }
  }

  return dailyGains.length
    ? dailyGains.reduce((total, gain) => total + gain, 0) / dailyGains.length
    : null;
}
