export type MarketPrice = {
  id: number;
  date: string;
  product: string;
  variety: string | null;
  minPrice: number;
  maxPrice: number;
  avgPrice: number;
};

export type MarketPricePage = {
  items: MarketPrice[];
  totalPages: number;
  totalElements: number;
  hasNext: boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parsePrice(value: unknown, field: string) {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`Market price response contains an invalid ${field}.`);
  }
  return parsed;
}

export function parseMarketPricePage(payload: unknown): MarketPricePage {
  if (!isRecord(payload) || !isRecord(payload.data) || !Array.isArray(payload.data.itemList)) {
    throw new Error("Market price provider returned an unexpected response.");
  }

  const { itemList, totalPage, totalElements, hasNext } = payload.data;
  const items = itemList.map((item): MarketPrice => {
    if (
      !isRecord(item) ||
      typeof item.id !== "number" ||
      !Number.isInteger(item.id) ||
      typeof item.product !== "string" ||
      !item.product.trim() ||
      typeof item.date !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(item.date)
    ) {
      throw new Error("Market price provider returned an invalid price record.");
    }

    return {
      id: item.id,
      date: item.date,
      product: item.product.trim(),
      variety: typeof item.variety === "string" && item.variety.trim() ? item.variety.trim() : null,
      minPrice: parsePrice(item.minPrice, "minimum price"),
      maxPrice: parsePrice(item.maxPrice, "maximum price"),
      avgPrice: parsePrice(item.avgPrice, "average price"),
    };
  });

  if (
    typeof totalPage !== "number" ||
    !Number.isInteger(totalPage) ||
    totalPage < 0 ||
    typeof totalElements !== "number" ||
    !Number.isInteger(totalElements) ||
    totalElements < 0 ||
    typeof hasNext !== "boolean"
  ) {
    throw new Error("Market price provider returned invalid pagination details.");
  }

  return { items, totalPages: totalPage, totalElements, hasNext };
}
