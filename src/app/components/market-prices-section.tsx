"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowDownRight, ArrowUpRight, Download, ExternalLink, RefreshCw, TrendingUp } from "lucide-react";
import type { Locale } from "@/lib/i18n";
import type { MarketPrice } from "@/lib/market-prices";

type PriceResponse = {
  records: MarketPrice[];
  totalElements: number;
  isTruncated: boolean;
  fetchedAt: string;
};

function tanzaniaDate(offsetDays: number) {
  const date = new Date(Date.now() + 3 * 60 * 60 * 1000 + offsetDays * 86_400_000);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function escapeCsv(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

function PriceTrendChart({ records, locale }: { records: MarketPrice[]; locale: Locale }) {
  const sorted = [...records].sort((left, right) => left.date.localeCompare(right.date));
  if (!sorted.length) return null;

  const width = 800;
  const height = 270;
  const left = 64;
  const right = 18;
  const top = 18;
  const bottom = 38;
  const values = sorted.flatMap((record) => [record.minPrice, record.maxPrice]);
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const padding = rawMax === rawMin ? Math.max(rawMax * 0.05, 1) : (rawMax - rawMin) * 0.12;
  const min = Math.max(0, rawMin - padding);
  const max = rawMax + padding;
  const x = (index: number) => sorted.length === 1
    ? (left + width - right) / 2
    : left + index / (sorted.length - 1) * (width - left - right);
  const y = (price: number) => top + (max - price) / (max - min) * (height - top - bottom);
  const averageLine = sorted.map((record, index) => `${index ? "L" : "M"}${x(index)},${y(record.avgPrice)}`).join(" ");
  const rangeArea = [
    ...sorted.map((record, index) => `${index ? "L" : "M"}${x(index)},${y(record.maxPrice)}`),
    ...[...sorted].reverse().map((record, reversedIndex) => {
      const index = sorted.length - 1 - reversedIndex;
      return `L${x(index)},${y(record.minPrice)}`;
    }),
    "Z",
  ].join(" ");
  const formatter = new Intl.NumberFormat(locale === "sw" ? "sw-TZ" : "en-TZ", { maximumFractionDigits: 0 });
  const dateFormatter = new Intl.DateTimeFormat(locale === "sw" ? "sw-TZ" : "en-TZ", { day: "numeric", month: "short", timeZone: "UTC" });

  return (
    <div className="market-chart-wrap">
      <svg aria-label={locale === "sw" ? "Chati ya mwenendo wa wastani wa bei na kiwango cha bei ya chini na ya juu" : "Chart of average price trend and minimum-to-maximum price range"} className="market-price-chart" role="img" viewBox={`0 0 ${width} ${height}`}>
        {[0, 1, 2, 3].map((step) => {
          const value = min + (max - min) * step / 3;
          const lineY = y(value);
          return (
            <g key={step}>
              <line className="market-chart-grid" x1={left} x2={width - right} y1={lineY} y2={lineY} />
              <text className="market-chart-label" textAnchor="end" x={left - 10} y={lineY + 4}>{formatter.format(value)}</text>
            </g>
          );
        })}
        <path className="market-chart-range" d={rangeArea} />
        <path className="market-chart-line" d={averageLine} />
        {sorted.map((record, index) => (
          <circle className="market-chart-point" cx={x(index)} cy={y(record.avgPrice)} key={`${record.id}-${record.date}`} r={sorted.length > 35 ? 2 : 3.5}>
            <title>{`${record.date} · ${formatter.format(record.avgPrice)} TZS`}</title>
          </circle>
        ))}
        <text className="market-chart-label" textAnchor="start" x={left} y={height - 10}>{dateFormatter.format(new Date(`${sorted[0].date}T00:00:00Z`))}</text>
        <text className="market-chart-label" textAnchor="end" x={width - right} y={height - 10}>{dateFormatter.format(new Date(`${sorted[sorted.length - 1].date}T00:00:00Z`))}</text>
      </svg>
      <div className="market-chart-legend">
        <span><i className="market-legend-average" />{locale === "sw" ? "Wastani wa bei" : "Average price"}</span>
        <span><i className="market-legend-range" />{locale === "sw" ? "Kiwango wa chini hadi juu" : "Minimum-to-maximum range"}</span>
      </div>
    </div>
  );
}

export function MarketPricesSection({ locale }: { locale: Locale }) {
  const sw = locale === "sw";
  const [endDate, setEndDate] = useState(() => tanzaniaDate(0));
  const [startDate, setStartDate] = useState(() => tanzaniaDate(-29));
  const [records, setRecords] = useState<MarketPrice[]>([]);
  const [selectedProduct, setSelectedProduct] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isTruncated, setIsTruncated] = useState(false);
  const [fetchedAt, setFetchedAt] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    async function loadPrices() {
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams({ startDate, endDate });
        if (refreshKey > 0) params.set("refresh", String(refreshKey));
        const response = await fetch(`/api/market-prices?${params}`, {
          signal: controller.signal,
          cache: "no-store",
        });
        const result = await response.json() as PriceResponse & { error?: string };
        if (!response.ok) throw new Error(result.error ?? "Could not load market prices.");
        if (!Array.isArray(result.records)) throw new Error("Market price response is incomplete.");
        setRecords(result.records);
        setIsTruncated(result.isTruncated);
        setFetchedAt(result.fetchedAt);
        setSelectedProduct((current) => {
          const products = result.records.map((record) => record.product);
          if (current && products.includes(current)) return current;
          return products.includes("Mahindi") ? "Mahindi" : [...new Set(products)].sort((a, b) => a.localeCompare(b))[0] ?? "";
        });
      } catch (loadError) {
        if (controller.signal.aborted) return;
        setError(loadError instanceof Error ? loadError.message : (sw ? "Bei za soko hazikuweza kupakiwa." : "Market prices could not be loaded."));
        setRecords([]);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void loadPrices();
    return () => controller.abort();
  }, [startDate, endDate, refreshKey, sw]);

  const products = useMemo(
    () => [...new Set(records.map((record) => record.product))].sort((left, right) => left.localeCompare(right)),
    [records],
  );
  const selectedRecords = useMemo(
    () => records.filter((record) => record.product === selectedProduct)
      .sort((left, right) => left.date.localeCompare(right.date)),
    [records, selectedProduct],
  );
  const latest = selectedRecords.at(-1) ?? null;
  const previous = selectedRecords.at(-2) ?? null;
  const priceChange = latest && previous ? latest.avgPrice - previous.avgPrice : null;
  const priceChangePercent = priceChange !== null && previous && previous.avgPrice !== 0
    ? priceChange / previous.avgPrice * 100
    : null;
  const priceFormatter = useMemo(
    () => new Intl.NumberFormat(sw ? "sw-TZ" : "en-TZ", {
      style: "currency",
      currency: "TZS",
      maximumFractionDigits: 0,
    }),
    [sw],
  );
  const dateFormatter = useMemo(
    () => new Intl.DateTimeFormat(sw ? "sw-TZ" : "en-TZ", { dateStyle: "medium", timeZone: "UTC" }),
    [sw],
  );
  const updatedLabel = fetchedAt
    ? new Intl.DateTimeFormat(sw ? "sw-TZ" : "en-TZ", { dateStyle: "medium", timeStyle: "short" }).format(new Date(fetchedAt))
    : "";
  const exportCsv = () => {
    const lines = [
      ["Date", "Product", "Variety", "Minimum price (TZS)", "Average price (TZS)", "Maximum price (TZS)"].join(","),
      ...[...selectedRecords].reverse().map((record) => [
        record.date,
        escapeCsv(record.product),
        escapeCsv(record.variety ?? ""),
        record.minPrice,
        record.avgPrice,
        record.maxPrice,
      ].join(",")),
    ];
    const url = URL.createObjectURL(new Blob([lines.join("\r\n")], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `market-prices-${selectedProduct.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${startDate}-${endDate}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="dashboard-content market-prices-page">
      <div className="section-heading">
        <div>
          <div className="eyebrow">{sw ? "TAARIFA ZA SOKO" : "MARKET INTELLIGENCE"}</div>
          <h2>{sw ? "Bei za mazao" : "Crop market prices"}</h2>
          <p>{sw
            ? "Fuatilia bei za kila siku za wastani, za chini na za juu kutoka e-Kilimo."
            : "Track daily average, minimum and maximum crop prices published by e-Kilimo."}</p>
        </div>
        <a className="market-source-link" href="https://ekilimo.kilimo.go.tz/" rel="noreferrer" target="_blank">
          {sw ? "Chanzo: e-Kilimo" : "Source: e-Kilimo"} <ExternalLink size={14} />
        </a>
      </div>

      <section aria-label={sw ? "Vichujio vya bei" : "Price filters"} className="panel market-filter-panel">
        <label className="field">
          <span>{sw ? "Zao" : "Crop"}</span>
          <select onChange={(event) => setSelectedProduct(event.target.value)} value={selectedProduct}>
            {products.length === 0 && <option value="">{sw ? "Hakuna mazao" : "No crops available"}</option>}
            {products.map((product) => <option key={product} value={product}>{product}</option>)}
          </select>
        </label>
        <label className="field">
          <span>{sw ? "Kuanzia" : "From"}</span>
          <input max={endDate} onChange={(event) => setStartDate(event.target.value)} type="date" value={startDate} />
        </label>
        <label className="field">
          <span>{sw ? "Hadi" : "To"}</span>
          <input min={startDate} max={tanzaniaDate(0)} onChange={(event) => setEndDate(event.target.value)} type="date" value={endDate} />
        </label>
        <button className="button button-quiet market-refresh-button" disabled={loading} onClick={() => setRefreshKey((key) => key + 1)} type="button">
          <RefreshCw size={15} className={loading ? "market-refresh-spinning" : ""} />
          {sw ? "Sasisha" : "Refresh"}
        </button>
      </section>

      {error ? (
        <section className="panel market-message-panel" role="alert">
          <strong>{sw ? "Bei za soko hazipatikani kwa sasa" : "Market prices are temporarily unavailable"}</strong>
          <p>{error}</p>
          <button className="button button-quiet" onClick={() => setRefreshKey((key) => key + 1)} type="button">
            <RefreshCw size={14} />{sw ? "Jaribu tena" : "Try again"}
          </button>
        </section>
      ) : loading ? (
        <section aria-live="polite" className="panel market-message-panel">
          <span className="market-loading-mark"><TrendingUp size={19} /></span>
          <p>{sw ? "Inapakia bei za hivi karibuni…" : "Loading the latest published prices…"}</p>
        </section>
      ) : records.length === 0 ? (
        <section className="panel market-message-panel">
          <strong>{sw ? "Hakuna bei katika kipindi hiki" : "No published prices for this period"}</strong>
          <p>{sw ? "Chagua kipindi kingine. Bei huchapishwa na chanzo rasmi, si makadirio." : "Try another date range. Prices are published by the official source; none are estimated."}</p>
        </section>
      ) : (
        <>
          {isTruncated && <p className="market-data-note" role="status">{sw ? "Matokeo yamefupishwa kwa sababu ya kikomo cha kurasa." : "Results were capped at 2,500 records for performance."}</p>}
          {latest && (
            <section aria-label={sw ? `Muhtasari wa bei ya ${selectedProduct}` : `${selectedProduct} price summary`} className="market-stat-grid">
              <article className="market-stat-card market-stat-featured">
                <span>{sw ? "Wastani wa mwisho" : "Latest average"}</span>
                <strong>{priceFormatter.format(latest.avgPrice)}</strong>
                <small>{latest.product}{latest.variety ? ` · ${latest.variety}` : ""} · {dateFormatter.format(new Date(`${latest.date}T00:00:00Z`))}</small>
              </article>
              <article className="market-stat-card">
                <span>{sw ? "Bei ya chini" : "Daily low"}</span>
                <strong>{priceFormatter.format(latest.minPrice)}</strong>
                <small>{sw ? "Rekodi ya mwisho" : "Most recent record"}</small>
              </article>
              <article className="market-stat-card">
                <span>{sw ? "Bei ya juu" : "Daily high"}</span>
                <strong>{priceFormatter.format(latest.maxPrice)}</strong>
                <small>{sw ? "Rekodi ya mwisho" : "Most recent record"}</small>
              </article>
              <article className={`market-stat-card ${priceChange === null ? "" : priceChange >= 0 ? "market-stat-up" : "market-stat-down"}`}>
                <span>{sw ? "Mabadiliko dhidi ya rekodi iliyotangulia" : "Change from previous record"}</span>
                <strong>
                  {priceChange === null
                    ? "—"
                    : <>{priceChange >= 0 ? <ArrowUpRight size={17} /> : <ArrowDownRight size={17} />}{priceFormatter.format(Math.abs(priceChange))}</>}
                </strong>
                <small>{priceChangePercent === null ? (sw ? "Hakuna rekodi ya kulinganisha" : "No comparison record") : `${priceChangePercent >= 0 ? "+" : ""}${priceChangePercent.toFixed(1)}%`}</small>
              </article>
            </section>
          )}

          <section className="panel data-panel market-chart-panel">
            <div className="panel-header">
              <div>
                <h3>{sw ? `Mwenendo wa ${selectedProduct}` : `${selectedProduct} price trend`}</h3>
                <p>{sw ? "Mstari unaonyesha wastani; eneo lenye kivuli linaonyesha bei ya chini hadi ya juu." : "The line shows average prices; the shaded band shows the minimum-to-maximum range."}</p>
              </div>
              <span className="market-record-count">{selectedRecords.length} {sw ? "rekodi za siku" : "daily records"}</span>
            </div>
            {selectedRecords.length > 0
              ? <PriceTrendChart locale={locale} records={selectedRecords} />
              : <p className="field-help">{sw ? "Hakuna rekodi za zao hili katika kipindi hiki." : "No records for this crop in the selected period."}</p>}
          </section>

          <section className="panel data-panel">
            <div className="panel-header market-table-heading">
              <div>
                <h3>{sw ? "Rekodi za kila siku" : "Daily price records"}</h3>
                <p>{sw ? "Bei zinaonyeshwa kwa shilingi za Tanzania kama zilivyoripotiwa na chanzo." : "Prices are shown in Tanzanian shillings as reported by the source."}</p>
              </div>
              <button className="button button-quiet" disabled={!selectedRecords.length} onClick={exportCsv} type="button">
                <Download size={15} />{sw ? "Pakua CSV" : "Export CSV"}
              </button>
            </div>
            <div className="table-scroll">
              <table>
                <thead><tr>
                  <th>{sw ? "Tarehe" : "Date"}</th>
                  <th>{sw ? "Zao" : "Crop"}</th>
                  <th>{sw ? "Aina" : "Variety"}</th>
                  <th>{sw ? "Chini (TZS)" : "Low (TZS)"}</th>
                  <th>{sw ? "Wastani (TZS)" : "Average (TZS)"}</th>
                  <th>{sw ? "Juu (TZS)" : "High (TZS)"}</th>
                </tr></thead>
                <tbody>
                  {[...selectedRecords].reverse().map((record) => (
                    <tr key={`${record.id}-${record.date}`}>
                      <td>{dateFormatter.format(new Date(`${record.date}T00:00:00Z`))}</td>
                      <td>{record.product}</td>
                      <td>{record.variety ?? "—"}</td>
                      <td>{priceFormatter.format(record.minPrice)}</td>
                      <td><strong className="market-average-cell">{priceFormatter.format(record.avgPrice)}</strong></td>
                      <td>{priceFormatter.format(record.maxPrice)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <p className="market-source-footnote">
            {sw
              ? `Chanzo: e-Kilimo · Bei kwa kitengo kama kilivyoripotiwa na chanzo · Ilikaguliwa ${updatedLabel}`
              : `Source: e-Kilimo · Prices are per unit as reported by the source · Checked ${updatedLabel}`}
            {" · "}
            <a href="https://ekilimo.kilimo.go.tz/" rel="noreferrer" target="_blank">{sw ? "Tembelea chanzo" : "Visit source"}</a>
          </p>
        </>
      )}
    </div>
  );
}
