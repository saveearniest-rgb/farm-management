import { NextResponse } from "next/server";
import { getAppContext } from "@/lib/auth";
import { parseMarketPricePage, type MarketPrice } from "@/lib/market-prices";

const API_URL = "https://ekilimo.kilimo.go.tz/gateway/ikmis-crop-management-service/api/v1/average-price-bullet/min-max-avg/daily/data";
const CURRENCY_UUID = "79c6f748-13ff-4890-8824-a22dd543788c";
const PAGE_SIZE = 100;
const MAX_PAGES = 25;
const MAX_RANGE_DAYS = 90;

function isIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

async function fetchPage(startDate: string, endDate: string, pageNo: number, forceRefresh: boolean) {
  const params = new URLSearchParams({
    pageNo: String(pageNo),
    pageSize: String(PAGE_SIZE),
    startDate,
    endDate,
    currencyUuid: CURRENCY_UUID,
  });
  const response = await fetch(`${API_URL}?${params}`, forceRefresh
    ? { cache: "no-store", signal: AbortSignal.timeout(12_000) }
    : { next: { revalidate: 900 }, signal: AbortSignal.timeout(12_000) });
  if (!response.ok) {
    throw new Error(`Market price provider responded with HTTP ${response.status}.`);
  }
  return parseMarketPricePage(await response.json());
}

export async function GET(request: Request) {
  const context = await getAppContext();
  if (!context) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const params = new URL(request.url).searchParams;
  const startDate = params.get("startDate") ?? "";
  const endDate = params.get("endDate") ?? "";
  const forceRefresh = params.has("refresh");
  if (!isIsoDate(startDate) || !isIsoDate(endDate) || startDate > endDate) {
    return NextResponse.json({ error: "Choose a valid market price date range." }, { status: 400 });
  }
  const rangeDays = (Date.parse(`${endDate}T00:00:00.000Z`) - Date.parse(`${startDate}T00:00:00.000Z`)) / 86_400_000 + 1;
  if (rangeDays > MAX_RANGE_DAYS) {
    return NextResponse.json({ error: "Market price history is limited to 90 days per request." }, { status: 400 });
  }

  try {
    const firstPage = await fetchPage(startDate, endDate, 0, forceRefresh);
    const pageCount = Math.min(Math.max(firstPage.totalPages, 1), MAX_PAGES);
    const additionalPages = await Promise.all(
      Array.from({ length: pageCount - 1 }, (_, index) => fetchPage(startDate, endDate, index + 1, forceRefresh)),
    );
    const records: MarketPrice[] = [firstPage, ...additionalPages]
      .flatMap((page) => page.items)
      .sort((left, right) => right.date.localeCompare(left.date) || left.product.localeCompare(right.product));

    return NextResponse.json({
      records,
      totalElements: firstPage.totalElements,
      isTruncated: firstPage.totalPages > MAX_PAGES || additionalPages.some((page) => page.hasNext),
      source: "e-Kilimo",
      currency: "TZS",
      fetchedAt: new Date().toISOString(),
    }, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Market price provider request failed.";
    console.error("Market price fetch failed:", error);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
