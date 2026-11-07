import { describe, expect, it } from "vitest";
import { parseMarketPricePage } from "./market-prices";

describe("parseMarketPricePage", () => {
  it("maps official daily price records and pagination details", () => {
    expect(parseMarketPricePage({
      data: {
        itemList: [{
          id: 12,
          date: "2026-11-07",
          product: "Mahindi",
          variety: null,
          minPrice: 500,
          maxPrice: 600,
          avgPrice: 550,
        }],
        totalPage: 1,
        totalElements: 1,
        hasNext: false,
      },
    })).toEqual({
      items: [{
        id: 12,
        date: "2026-11-07",
        product: "Mahindi",
        variety: null,
        minPrice: 500,
        maxPrice: 600,
        avgPrice: 550,
      }],
      totalPages: 1,
      totalElements: 1,
      hasNext: false,
    });
  });

  it("rejects malformed or incomplete provider responses", () => {
    expect(() => parseMarketPricePage({ data: { itemList: [] } })).toThrow(/pagination details/);
    expect(() => parseMarketPricePage({
      data: {
        itemList: [{ id: 1, date: "not-a-date", product: "Mahindi", minPrice: 1, maxPrice: 2, avgPrice: 1.5 }],
        totalPage: 1,
        totalElements: 1,
        hasNext: false,
      },
    })).toThrow(/invalid price record/);
  });
});
