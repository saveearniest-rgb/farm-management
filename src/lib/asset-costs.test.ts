import { describe, expect, it } from "vitest";
import { summarizeAssetCosts } from "./asset-costs";

describe("summarizeAssetCosts", () => {
  it("totals usage and maintenance costs without treating purchase price as running cost", () => {
    const result = summarizeAssetCosts(
      [
        { id: "pump", name: "Pump", type: "Irrigation", currency: "TZS" },
        { id: "tractor", name: "Tractor", type: "Equipment", currency: "TZS" },
      ],
      [
        { assetId: "pump", hours: 2, distance: null, distanceUnit: null, fuelCost: 1500 },
        { assetId: "pump", hours: 1.5, distance: null, distanceUnit: null, fuelCost: 750 },
        { assetId: "tractor", hours: null, distance: 4, distanceUnit: "km", fuelCost: null },
      ],
      [
        { assetId: "pump", cost: 800 },
        { assetId: "pump", cost: null },
      ],
    );

    expect(result).toEqual([
      {
        asset: { id: "pump", name: "Pump", type: "Irrigation", currency: "TZS" },
        hours: 3.5,
        distance: 0,
        distanceUnit: "",
        fuelCost: 2250,
        maintenanceCost: 800,
      },
      {
        asset: { id: "tractor", name: "Tractor", type: "Equipment", currency: "TZS" },
        hours: 0,
        distance: 4,
        distanceUnit: "km",
        fuelCost: 0,
        maintenanceCost: 0,
      },
    ]);
  });
});
