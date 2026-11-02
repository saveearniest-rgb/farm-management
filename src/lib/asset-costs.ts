export type AssetCostAsset = {
  id: string;
  name: string;
  type: string;
  currency: string;
};

export type AssetCostUsage = {
  assetId: string;
  hours: number | null;
  distance: number | null;
  distanceUnit: string | null;
  fuelCost: number | null;
};

export type AssetCostMaintenance = {
  assetId: string;
  cost: number | null;
};

export function summarizeAssetCosts(
  assets: AssetCostAsset[],
  usages: AssetCostUsage[],
  maintenance: AssetCostMaintenance[],
) {
  return assets.map((asset) => {
    const assetUsages = usages.filter((usage) => usage.assetId === asset.id);
    const assetMaintenance = maintenance.filter((entry) => entry.assetId === asset.id);
    return {
      asset,
      hours: assetUsages.reduce((total, usage) => total + (usage.hours ?? 0), 0),
      distance: assetUsages.reduce((total, usage) => total + (usage.distance ?? 0), 0),
      distanceUnit: assetUsages.find((usage) => usage.distanceUnit)?.distanceUnit ?? "",
      fuelCost: assetUsages.reduce((total, usage) => total + (usage.fuelCost ?? 0), 0),
      maintenanceCost: assetMaintenance.reduce((total, entry) => total + (entry.cost ?? 0), 0),
    };
  });
}
