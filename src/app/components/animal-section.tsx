"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  archiveAnimalAction,
  archiveAnimalGroupAction,
  createAnimalBreedAction,
  createAnimalBreedBenchmarkAction,
  createAnimalAction,
  createAnimalsBulkAction,
  createAnimalGroupAction,
  createAnimalHealthProductAction,
  createAnimalSalesForecastAction,
  createAnimalVaccinationScheduleAction,
  createStockItemAction,
  recordAnimalHealthAction,
  recordAnimalHealthCaseAction,
  recordAnimalDailyAction,
  recordAnimalBreedingAction,
  recordAnimalEventAction,
  recordAnimalPerformanceAction,
  recordAnimalSalePaymentAction,
  recordAnimalSaleAction,
  recordAnimalTraitAction,
  resolveAnimalHealthCaseAction,
  saveAnimalSpeciesProfileAction,
  saveFeedRationAction,
  updateAnimalBreedingProgressAction,
} from "@/app/actions/operations";
import {
  calculateCurrentAnimalCount,
  calculateFeedPlan,
  calculateFeedNutrientIntake,
} from "@/lib/animal-management";
import {
  calculateAverageDailyWeightGain,
  isWithinWithdrawalPeriod,
} from "@/lib/animal-health";
import { areCloseRelatives } from "@/lib/animal-breeding";
import type { DashboardData } from "@/lib/dashboard-data";
import type { Locale } from "@/lib/i18n";
import { ActionForm, FormField, FormSelect, FormTextArea } from "./action-form";
import { Plus } from "lucide-react";

const eventTypes = [
  "BIRTH",
  "PURCHASE",
  "WEANING",
  "MOVE",
  "DEATH",
  "CULLED",
  "OTHER",
];
const dailyTypes = ["FEEDING", "WATER", "MILK", "EGGS", "HEALTH_CHECK", "OTHER"];
const healthRecordTypes = ["VACCINATION", "TREATMENT", "DEWORMING", "DIPPING", "TICK_CONTROL", "VET_VISIT"];
const performanceTypes = ["WEIGHT", "MILK", "EGGS"];
const animalPurposes = ["MILK", "MEAT", "EGGS", "DUAL", "BREEDING", "OTHER"];
const animalTraitTypes = ["BIRTH_WEIGHT", "COLOR", "HORN_STATUS", "TEMPERAMENT", "CONFORMATION", "OTHER"];
const sourceLabels = ["BENCHMARK", "PLACEHOLDER_BENCHMARK", "LOCAL_QUOTE", "YOUR_ACTUAL"];
const pregnancyResults = ["POSITIVE", "NEGATIVE", "INCONCLUSIVE"];
const birthOutcomes = ["LIVE", "STILLBORN", "ABORTION", "UNKNOWN"];
const breedingMethods = ["NATURAL", "ARTIFICIAL_INSEMINATION"];
const animalProductLines = [
  "MILK",
  "MEAT",
  "EGGS",
  "LIVE_ANIMAL",
  "MANURE",
  "HIDES",
  "BREEDING_SERVICE",
  "OTHER",
] as const;

export type AnimalSectionId = "overview" | "herd" | "breeding" | "daily" | "feed" | "health" | "income";

type OverviewMetric = {
  label: string;
  value: string;
  hasData: boolean;
};

function AnimalOverviewGroup({
  title,
  metrics,
  emptyLabel,
  countLabel,
}: {
  title: string;
  metrics: OverviewMetric[];
  emptyLabel: string;
  countLabel: (count: number) => string;
}) {
  const visibleMetrics = metrics.filter((metric) => metric.hasData);

  return (
    <details className="animal-overview-group">
      <summary>
        <strong>{title}</strong>
        <span>{visibleMetrics.length ? countLabel(visibleMetrics.length) : emptyLabel}</span>
      </summary>
      {visibleMetrics.length ? (
        <div className="plan-kpi-grid">
          {visibleMetrics.map((metric) => (
            <div className="plan-kpi" key={metric.label}>
              <span>{metric.label}</span>
              <strong>{metric.value}</strong>
            </div>
          ))}
        </div>
      ) : (
        <p className="field-help">{emptyLabel}</p>
      )}
    </details>
  );
}

function AddDisclosure({ title, children }: { title: string; children: ReactNode }) {
  return (
    <details className="animal-form-disclosure">
      <summary><Plus size={15} />{title}</summary>
      {children}
    </details>
  );
}

function productLineLabel(productLine: string, locale: Locale) {
  const sw: Record<string, string> = {
    MILK: "Maziwa",
    MEAT: "Nyama",
    EGGS: "Mayai",
    LIVE_ANIMAL: "Mnyama hai",
    MANURE: "Samadi",
    HIDES: "Ngozi",
    BREEDING_SERVICE: "Huduma za uzalishaji",
    OTHER: "Nyingine",
  };
  return locale === "sw" ? sw[productLine] ?? productLine : productLine.toLowerCase().replaceAll("_", " ");
}

function eventLabel(type: string, locale: Locale) {
  const sw: Record<string, string> = {
    BIRTH: "Kuzaliwa",
    PURCHASE: "Ununuzi",
    WEANING: "Kuachisha kunyonya",
    MOVE: "Kuhamisha",
    BREEDING: "Kupandisha",
    SALE: "Mauzo",
    DEATH: "Kifo",
    CULLED: "Kuondoa kundini",
    OTHER: "Nyingine",
  };
  return locale === "sw" ? sw[type] ?? type : type.toLowerCase().replaceAll("_", " ");
}

function dailyLabel(type: string, locale: Locale) {
  const sw: Record<string, string> = {
    FEEDING: "Kulisha",
    WATER: "Maji",
    MILK: "Maziwa",
    EGGS: "Mayai",
    HEALTH_CHECK: "Ukaguzi wa afya",
    OTHER: "Nyingine",
  };
  return locale === "sw" ? sw[type] ?? type : type.toLowerCase().replaceAll("_", " ");
}

function traitLabel(type: string, locale: Locale) {
  const sw: Record<string, string> = {
    BIRTH_WEIGHT: "Uzito wa kuzaliwa",
    COLOR: "Rangi",
    HORN_STATUS: "Hali ya pembe",
    TEMPERAMENT: "Tabia",
    CONFORMATION: "Muundo wa mwili",
    OTHER: "Nyingine",
  };
  return locale === "sw" ? sw[type] ?? type : type.toLowerCase().replaceAll("_", " ");
}

function purposeLabel(purpose: string, locale: Locale) {
  const sw: Record<string, string> = {
    MILK: "Maziwa",
    MEAT: "Nyama",
    EGGS: "Mayai",
    DUAL: "Madhumuni mawili",
    BREEDING: "Uzalishaji",
    OTHER: "Nyingine",
  };
  return locale === "sw" ? sw[purpose] ?? purpose : purpose.toLowerCase();
}

function sourceLabelText(sourceLabel: string, locale: Locale) {
  const sw: Record<string, string> = {
    BENCHMARK: "KIGEZO",
    PLACEHOLDER_BENCHMARK: "KIGEZO CHA MUDA",
    LOCAL_QUOTE: "TAARIFA YA ENEO",
    YOUR_ACTUAL: "TAARIFA HALISI YA SHAMBA",
  };
  return locale === "sw" ? sw[sourceLabel] ?? sourceLabel : sourceLabel.replaceAll("_", " ");
}

export function AnimalSection({
  data,
  locale,
  isOwner,
  activeSection,
}: {
  data: DashboardData;
  locale: Locale;
  isOwner: boolean;
  activeSection: AnimalSectionId;
}) {
  const sw = locale === "sw";
  const [planningDays, setPlanningDays] = useState(7);
  const feedItems = useMemo(
    () => data.stockItems.filter((item) => item.category === "FEED"),
    [data.stockItems],
  );
  const groupOptions = data.animalGroups.map((group) => ({
    value: group.id,
    label: `${group.name} · ${group.species} · ${group.trackingMode === "INDIVIDUAL" ? (sw ? "binafsi" : "individual") : (sw ? "idadi" : "head count")}`,
  }));
  const headCountGroupOptions = groupOptions.filter((option) =>
    data.animalGroups.find((group) => group.id === option.value)?.trackingMode === "HEAD_COUNT",
  );
  const animalOptions = data.animals.map((animal) => ({
    value: animal.id,
    label: `${animal.name ? `${animal.name} · ` : ""}${animal.tagNumber} · ${animal.species}`,
  }));
  const dailyOptions = dailyTypes.map((type) => ({
    value: type,
    label: dailyLabel(type, locale),
  }));
  const eventOptions = eventTypes.map((type) => ({
    value: type,
    label: eventLabel(type, locale),
  }));
  const groupsWithCounts = useMemo(
    () => data.animalGroups.map((group) => ({
      ...group,
      currentCount: calculateCurrentAnimalCount({
        trackingMode: group.trackingMode,
        startingCount: group.startingCount,
        events: group.events,
        activeTaggedCount: data.animals.filter(
          (animal) => animal.groupId === group.id && animal.status === "ACTIVE",
        ).length,
      }),
    })),
    [data.animalGroups, data.animals],
  );
  const feedPlans = useMemo(
    () => groupsWithCounts.flatMap((group) =>
      group.feedRations.map((ration) => {
        const item = feedItems.find((stockItem) => stockItem.id === ration.itemId);
        if (!item) return null;
        return {
          group,
          ration,
          item,
          ...calculateFeedPlan({
            groupCount: group.currentCount,
            quantityPerHead: ration.quantityPerHead,
            days: planningDays,
            stock: item.balance,
          }),
          nutrition: calculateFeedNutrientIntake({
            groupCount: group.currentCount,
            quantityPerHead: ration.quantityPerHead,
            unit: ration.unit,
            days: planningDays,
            crudeProteinPct: item.crudeProteinPct,
            crudeFiberPct: item.crudeFiberPct,
          }),
        };
      }).filter((plan) => plan !== null),
    ),
    [feedItems, groupsWithCounts, planningDays],
  );
  const feedUseRecords = data.animalDailyRecords.filter((record) =>
    record.type === "FEEDING" && record.feedItemId,
  );
  const feedPerformanceRecords = data.animalPerformanceRecords.filter((record) => record.feedItemId);
  const eventRows = useMemo(() => [
    ...data.animalGroups.flatMap((group) => group.events.map((event) => ({
      id: event.id,
      target: group.name,
      type: event.type,
      occurredAt: event.occurredAt,
      quantity: event.quantity,
      purchaseCost: event.purchaseCost,
      seller: event.seller,
      notes: event.notes,
    }))),
    ...data.animals.flatMap((animal) => animal.events.map((event) => ({
      id: event.id,
      target: animal.tagNumber,
      type: event.type,
      occurredAt: event.occurredAt,
      quantity: event.quantity,
      purchaseCost: event.purchaseCost,
      seller: event.seller,
      notes: event.notes,
    }))),
  ].sort((a, b) => new Date(b.occurredAt ?? 0).getTime() - new Date(a.occurredAt ?? 0).getTime()), [
    data.animalGroups,
    data.animals,
  ]);
  const date = (value: string | null) => value
    ? new Intl.DateTimeFormat(sw ? "sw-TZ" : "en-TZ", { dateStyle: "medium" }).format(new Date(value))
    : "—";
  const number = (value: number, maximumFractionDigits = 2) =>
    new Intl.NumberFormat(sw ? "sw-TZ" : "en-TZ", { maximumFractionDigits }).format(value);
  const nowMs = data.generatedAt;
  const activeWithdrawalRecords = data.animalHealthRecords.filter(
    (record) => record.withdrawalUntil && new Date(record.withdrawalUntil).getTime() > nowMs,
  );
  const targetsOverlap = (
    left: { animalId: string | null; animalGroupId: string | null },
    right: { animalId: string | null; animalGroupId: string | null },
  ) =>
    Boolean(
      left.animalId && left.animalId === right.animalId ||
      left.animalGroupId && left.animalGroupId === right.animalGroupId ||
      left.animalGroupId && right.animalId && data.animals.some((animal) =>
        animal.id === right.animalId && animal.groupId === left.animalGroupId,
      ) ||
      left.animalId && right.animalGroupId && data.animals.some((animal) =>
        animal.id === left.animalId && animal.groupId === right.animalGroupId,
      ),
    );
  const restrictedCollections = data.animalDailyRecords.filter((record) =>
    (record.type === "MILK" || record.type === "EGGS") &&
    data.animalHealthRecords.some((healthRecord) =>
      targetsOverlap(healthRecord, record) &&
      isWithinWithdrawalPeriod(
        healthRecord.administeredAt ?? "",
        healthRecord.withdrawalUntil,
        record.recordedAt ?? "",
      ),
    ),
  );
  const scheduleReminders = useMemo(
    () => data.animalVaccinationSchedules.flatMap((schedule) => {
      const targets = schedule.animalGroupId
        ? data.animalGroups
            .filter((group) => group.id === schedule.animalGroupId)
            .map((group) => ({ id: group.id, name: group.name, groupId: group.id, animalId: null, birthDate: null }))
        : [
            ...data.animals
              .filter((animal) =>
                animal.status === "ACTIVE" &&
                animal.species.toLocaleLowerCase() === schedule.species.toLocaleLowerCase() &&
                (!schedule.breed || animal.breed?.toLocaleLowerCase() === schedule.breed.toLocaleLowerCase()),
              )
              .map((animal) => ({
                id: animal.id,
                name: animal.tagNumber,
                groupId: null,
                animalId: animal.id,
                birthDate: animal.birthDate,
              })),
            ...(schedule.firstDueAt
              ? data.animalGroups
                  .filter((group) => group.species.toLocaleLowerCase() === schedule.species.toLocaleLowerCase())
                  .map((group) => ({
                    id: group.id,
                    name: group.name,
                    groupId: group.id,
                    animalId: null,
                    birthDate: null,
                  }))
              : []),
          ];
      return targets.map((target) => {
        const lastDose = schedule.records
          .filter((record) =>
            target.animalId
              ? record.animalId === target.animalId
              : record.animalGroupId === target.groupId,
          )
          .sort((a, b) => new Date(b.administeredAt ?? 0).getTime() - new Date(a.administeredAt ?? 0).getTime())[0];
        let firstDue = schedule.firstDueAt ? new Date(schedule.firstDueAt) : null;
        if (!firstDue && schedule.ageDays !== null && target.birthDate) {
          firstDue = new Date(new Date(target.birthDate).getTime() + schedule.ageDays * 86_400_000);
        }
        const dueAt = lastDose
          ? schedule.repeatEveryDays
            ? new Date(new Date(lastDose.administeredAt ?? 0).getTime() + schedule.repeatEveryDays * 86_400_000)
            : null
          : firstDue;
        return {
          id: `${schedule.id}:${target.id}`,
          title: schedule.title,
          productName: schedule.productName,
          targetName: target.name,
          dueAt: dueAt?.toISOString() ?? null,
          needsBirthDate: !dueAt && !lastDose && schedule.ageDays !== null && !target.birthDate,
          overdue: dueAt ? dueAt.getTime() < nowMs : false,
          complete: Boolean(lastDose && !schedule.repeatEveryDays),
        };
      });
    }),
    [data.animalVaccinationSchedules, data.animalGroups, data.animals, nowMs],
  );
  const healthTypeLabel = (type: string) => type.toLowerCase().replaceAll("_", " ");
  const recentThreshold = nowMs - 30 * 86_400_000;
  const recentEvents = eventRows.filter((event) =>
    event.occurredAt && new Date(event.occurredAt).getTime() >= recentThreshold,
  );
  const recentBirths = recentEvents
    .filter((event) => event.type === "BIRTH")
    .reduce((sum, event) => sum + (event.quantity ?? 1), 0);
  const recentLosses = recentEvents
    .filter((event) => event.type === "DEATH" || event.type === "CULLED")
    .reduce((sum, event) => sum + (event.quantity ?? 1), 0);
  const recentMilkEggs = data.animalDailyRecords.filter((record) =>
    (record.type === "MILK" || record.type === "EGGS") &&
    record.recordedAt && new Date(record.recordedAt).getTime() >= recentThreshold,
  );
  const upcomingBirths = data.animalBreedingRecords.filter((record) =>
    record.expectedBirthAt &&
    new Date(record.expectedBirthAt).getTime() >= nowMs &&
    new Date(record.expectedBirthAt).getTime() <= nowMs + 30 * 86_400_000,
  );
  const animalCapitalAssets = data.assets.filter((asset) =>
    asset.isCapitalInvestment &&
    (asset.division === "ANIMALS" || asset.division === "SHARED") &&
    asset.productLine,
  );
  const monthlyCapitalEstimate = animalCapitalAssets.reduce((sum, asset) =>
    sum + (asset.productLine && asset.purchaseCost !== null && asset.expectedLifeMonths
      ? Math.max(0, (asset.purchaseCost - (asset.salvageValue ?? 0)) / asset.expectedLifeMonths)
      : 0), 0);
  const minimumFeedDaysRemaining = feedPlans
    .map((plan) => plan.daysRemaining)
    .filter((days): days is number => days !== null)
    .sort((a, b) => a - b)[0] ?? null;
  const capitalCostsByLine = new Map<(typeof animalProductLines)[number], number>();
  const investmentValueByLine = new Map<(typeof animalProductLines)[number], number>();
  for (const asset of animalCapitalAssets) {
    if (!asset.productLine || asset.purchaseCost === null || !asset.expectedLifeMonths) continue;
    const monthlyCost = Math.max(0, (asset.purchaseCost - (asset.salvageValue ?? 0)) / asset.expectedLifeMonths);
    const elapsedMonths = asset.purchasedAt
      ? Math.max(0, (nowMs - new Date(asset.purchasedAt).getTime()) / (30.4375 * 86_400_000))
      : 0;
    const capitalCostToDate = monthlyCost * Math.min(asset.expectedLifeMonths, elapsedMonths);
    capitalCostsByLine.set(asset.productLine, (capitalCostsByLine.get(asset.productLine) ?? 0) + capitalCostToDate);
    investmentValueByLine.set(asset.productLine, (investmentValueByLine.get(asset.productLine) ?? 0) + asset.purchaseCost);
  }
  const productEconomics = data.animalProductLineEconomics.map((row) => ({
    ...row,
    capitalCost: capitalCostsByLine.get(row.productLine) ?? 0,
    investment: investmentValueByLine.get(row.productLine) ?? 0,
  }));
  for (const [productLine, capitalCost] of capitalCostsByLine) {
    if (!productEconomics.some((row) => row.productLine === productLine)) {
      productEconomics.push({
        productLine,
        quantitySold: 0,
        sales: 0,
        amountReceived: 0,
        costs: 0,
        capitalCost,
        investment: investmentValueByLine.get(productLine) ?? 0,
      });
    }
  }
  const economicsTotals = productEconomics.reduce((totals, row) => ({
    sales: totals.sales + row.sales,
    directCosts: totals.directCosts + row.costs,
    capitalCosts: totals.capitalCosts + row.capitalCost,
    receivable: totals.receivable + Math.max(0, row.sales - row.amountReceived),
    investment: totals.investment + row.investment,
  }), { sales: 0, directCosts: 0, capitalCosts: 0, receivable: 0, investment: 0 });
  const activeAnimalCount = data.animals.filter((animal) => animal.status === "ACTIVE").length +
    groupsWithCounts.filter((group) => group.trackingMode === "HEAD_COUNT")
      .reduce((sum, group) => sum + group.currentCount, 0);
  const overdueVaccinations = scheduleReminders.filter((reminder) => reminder.overdue && !reminder.complete).length;
  const openHealthCases = data.animalHealthCases.filter((healthCase) => !healthCase.resolvedAt).length;
  const monthlySales = data.animalMonthEconomics.sales;
  const monthlyCosts = data.animalMonthEconomics.allocatedCosts;
  const monthlyReceived = data.animalMonthEconomics.amountReceived;
  const animalOverviewGroups: Array<{ title: string; metrics: OverviewMetric[] }> = [
    {
      title: sw ? "Kundi na matukio" : "Herd and activity",
      metrics: [
        { label: sw ? "Mifugo hai" : "Active animals", value: number(activeAnimalCount, 0), hasData: activeAnimalCount > 0 },
        { label: sw ? "Waliozaliwa siku 30" : "Births · last 30 days", value: number(recentBirths, 0), hasData: recentBirths > 0 },
        { label: sw ? "Vifo/kuondolewa siku 30" : "Deaths/culls · last 30 days", value: number(recentLosses, 0), hasData: recentLosses > 0 },
      ],
    },
    {
      title: sw ? "Uzalishaji" : "Production",
      metrics: [
        {
          label: sw ? "Maziwa yaliyorekodiwa · siku 30" : "Recorded milk · last 30 days",
          value: number(recentMilkEggs.filter((record) => record.type === "MILK").reduce((sum, record) => sum + (record.quantity ?? 0), 0)),
          hasData: recentMilkEggs.some((record) => record.type === "MILK" && (record.quantity ?? 0) > 0),
        },
        {
          label: sw ? "Mayai yaliyorekodiwa · siku 30" : "Recorded eggs · last 30 days",
          value: number(recentMilkEggs.filter((record) => record.type === "EGGS").reduce((sum, record) => sum + (record.quantity ?? 0), 0)),
          hasData: recentMilkEggs.some((record) => record.type === "EGGS" && (record.quantity ?? 0) > 0),
        },
      ],
    },
    {
      title: sw ? "Afya na chakula" : "Health and feed",
      metrics: [
        { label: sw ? "Chanjo zilizochelewa" : "Overdue vaccination reminders", value: number(overdueVaccinations, 0), hasData: overdueVaccinations > 0 },
        { label: sw ? "Matukio ya uzazi siku 30 zijazo" : "Expected births · next 30 days", value: number(upcomingBirths.length, 0), hasData: upcomingBirths.length > 0 },
        { label: sw ? "Kesi za afya zilizo wazi" : "Open health cases", value: number(openHealthCases, 0), hasData: openHealthCases > 0 },
        {
          label: sw ? "Siku za chakula zilizobaki (makadirio)" : "Feed days remaining (estimate)",
          value: minimumFeedDaysRemaining === null ? "" : number(minimumFeedDaysRemaining),
          hasData: minimumFeedDaysRemaining !== null,
        },
        { label: sw ? "Vipindi vya kusubiri vinavyoendelea" : "Active withdrawal periods", value: number(activeWithdrawalRecords.length, 0), hasData: activeWithdrawalRecords.length > 0 },
      ],
    },
    ...(isOwner ? [{
      title: sw ? "Fedha na mipango" : "Finances and planning",
      metrics: [
        {
          label: sw ? "Mauzo mwezi huu" : "Sales this month",
          value: `${number(monthlySales)} ${data.farm.currency}`,
          hasData: monthlySales > 0,
        },
        {
          label: sw ? "Malipo yaliyorekodiwa mwezi huu" : "Amount received this month",
          value: `${number(monthlyReceived)} ${data.farm.currency}`,
          hasData: monthlySales > 0,
        },
        {
          label: sw ? "Gharama zilizogawiwa mwezi huu" : "Allocated costs this month",
          value: `${number(monthlyCosts)} ${data.farm.currency}`,
          hasData: monthlyCosts > 0,
        },
        {
          label: sw ? "Mchango uliorekodiwa kabla ya mtaji" : "Recorded contribution before capital",
          value: `${number(monthlySales - monthlyCosts)} ${data.farm.currency}`,
          hasData: monthlySales > 0 || monthlyCosts > 0,
        },
        {
          label: sw ? "Mauzo yaliyorekodiwa (jumla)" : "Recorded sales (all time)",
          value: `${number(economicsTotals.sales)} ${data.farm.currency}`,
          hasData: economicsTotals.sales > 0,
        },
        {
          label: sw ? "Malipo yaliyorekodiwa" : "Amount received (recorded)",
          value: `${number(economicsTotals.sales - economicsTotals.receivable)} ${data.farm.currency}`,
          hasData: economicsTotals.sales > 0,
        },
        {
          label: sw ? "Salio linalodaiwa" : "Outstanding receivable",
          value: `${number(economicsTotals.receivable)} ${data.farm.currency}`,
          hasData: economicsTotals.receivable > 0,
        },
        {
          label: sw ? "Gharama za moja kwa moja zilizogawiwa" : "Allocated direct costs",
          value: `${number(economicsTotals.directCosts)} ${data.farm.currency}`,
          hasData: economicsTotals.directCosts > 0,
        },
        {
          label: sw ? "Uchakavu wa mtaji uliokadiriwa" : "Estimated capital cost to date",
          value: `${number(economicsTotals.capitalCosts)} ${data.farm.currency}`,
          hasData: economicsTotals.capitalCosts > 0,
        },
        {
          label: sw ? "Mauzo ukilinganisha na gharama zilizorekodiwa" : "Recorded contribution after costs",
          value: `${number(economicsTotals.sales - economicsTotals.directCosts - economicsTotals.capitalCosts)} ${data.farm.currency}`,
          hasData: economicsTotals.sales > 0 || economicsTotals.directCosts > 0 || economicsTotals.capitalCosts > 0,
        },
        {
          label: sw ? "Mtaji wa mifugo uliosajiliwa" : "Registered animal investment",
          value: `${number(economicsTotals.investment)} ${data.farm.currency}`,
          hasData: economicsTotals.investment > 0,
        },
        {
          label: sw ? "Makadirio ya mtaji kwa mwezi" : "Estimated capital cost / month",
          value: `${number(monthlyCapitalEstimate)} ${data.farm.currency}`,
          hasData: monthlyCapitalEstimate > 0,
        },
      ],
    }] : []),
  ];
  const forecastWindow = data.animalSalesForecasts.filter((forecast) =>
    forecast.plannedFor && new Date(forecast.plannedFor).getTime() <= nowMs + 90 * 86_400_000,
  );

  return (
    <div className="dashboard-content">
      <div className="section-heading">
        <div>
          <div className="eyebrow">{sw ? "MIFUGO" : "LIVESTOCK"}</div>
          <h2>{sw ? "Usajili na kazi za kila siku" : "Animal register and daily work"}</h2>
          <p>
            {sw
              ? "Rekodi vikundi, wanyama binafsi, matukio na matumizi ya chakula. Hakuna ratiba au ushauri wa mifugo uliojazwa kama ukweli."
              : "Record groups, individual animals, events and feed use. No veterinary schedule or advice is pre-filled as fact."}
          </p>
        </div>
      </div>

      {activeSection === "overview" && <section className="panel data-panel">
        <div className="panel-header">
          <div>
            <h3>{sw ? "Muhtasari na mpango wa mifugo" : "Animal dashboard and planning"}</h3>
            <p>{sw ? "Takwimu zinatokana na rekodi za shamba; gharama za mstari wa bidhaa hujumuisha mgao uliowekwa pekee." : "Figures come from farm records; product-line costs include only expenses explicitly allocated to that line."}</p>
          </div>
        </div>
        <div className="animal-overview-groups">
          {animalOverviewGroups.map((group) => (
            <AnimalOverviewGroup
              key={group.title}
              title={group.title}
              metrics={group.metrics}
              emptyLabel={sw ? "Hakuna taarifa zilizorekodiwa bado" : "No records yet"}
              countLabel={(count) => sw ? `Vipimo ${count}` : `${count} ${count === 1 ? "metric" : "metrics"}`}
            />
          ))}
        </div>
        {isOwner && <p className="field-help">{sw ? "Thamani za uchakavu ni makadirio ya mipango ya mstari mnyoofu tu, si ushauri wa uhasibu." : "Straight-line useful-life amounts are planning estimates only, not accounting advice."}</p>}
      </section>}

      {activeSection === "income" && isOwner && <section className="panel">
        <div className="panel-header">
          <div>
            <h3>{sw ? "Mauzo ya bidhaa za mifugo" : "Animal product sales"}</h3>
            <p>{sw ? "Hifadhi mapato, kiasi kilichopokelewa na salio bila kuchakata malipo." : "Record income, amount received and balance due; no payment is processed by the app."}</p>
          </div>
        </div>
        <AddDisclosure title={sw ? "Rekodi mauzo ya mifugo" : "Record animal product sale"}>
        <ActionForm action={recordAnimalSaleAction} submitLabel={sw ? "Rekodi mauzo" : "Record sale"} className="form-grid">
          <FormSelect label={sw ? "Mstari wa bidhaa" : "Product line"} name="productLine" options={animalProductLines.map((line) => ({ value: line, label: productLineLabel(line, locale) }))} />
          <FormSelect label={sw ? "Mnyama (hiari; lazima kwa mnyama hai)" : "Animal (optional; required for live-animal sales)"} name="animalId" required={false} options={animalOptions.filter((option) => data.animals.find((animal) => animal.id === option.value)?.status === "ACTIVE")} />
          <FormSelect label={sw ? "Kikundi (hiari; lazima kwa mauzo ya kundi la wanyama hai)" : "Group (optional; required for head-count live sales)"} name="animalGroupId" required={false} options={headCountGroupOptions} />
          <FormField label={sw ? "Tarehe ya mauzo" : "Sale date"} name="soldAt" type="date" />
          <FormField label={sw ? "Kiasi" : "Quantity"} name="quantity" type="number" min="0.0001" step="0.0001" required />
          <FormField label={sw ? "Kipimo" : "Unit"} name="unit" placeholder="litre, kg, tray, head" required />
          <FormField label={sw ? "Bei kwa kipimo" : "Price per unit"} name="price" type="number" min="0" step="0.01" required />
          <FormField label={sw ? `Kiasi kilichopokelewa (${data.farm.currency})` : `Amount received (${data.farm.currency})`} name="amountReceived" type="number" min="0" step="0.01" defaultValue="0" />
          <FormSelect label={sw ? "Njia ya malipo iliyorekodiwa" : "Recorded payment method"} name="paymentMethod" required={false} options={[
            { value: "CASH", label: sw ? "Taslimu" : "Cash" },
            { value: "BANK", label: sw ? "Benki" : "Bank" },
            { value: "MOBILE_MONEY", label: sw ? "Pesa kwa simu" : "Mobile money" },
          ]} />
          <FormField label={sw ? "Mnunuzi" : "Buyer"} name="buyer" required={false} />
          <FormField label={sw ? "Rejea ya malipo (hiari)" : "Payment reference (optional)"} name="paymentReference" required={false} />
          <FormTextArea label={sw ? "Maelezo" : "Notes"} name="notes" />
        </ActionForm>
        </AddDisclosure>
        <div className="table-scroll">
          {productEconomics.length > 0 && <table><thead><tr><th>{sw ? "Bidhaa" : "Product line"}</th><th>{sw ? "Kiasi kilichouzwa" : "Quantity sold"}</th><th>{sw ? "Mauzo" : "Sales"}</th><th>{sw ? "Gharama za moja kwa moja" : "Direct costs"}</th><th>{sw ? "Mtaji uliokadiriwa" : "Estimated capital cost"}</th><th>{sw ? "Margin iliyorekodiwa" : "Recorded margin"}</th><th>{sw ? "Salio" : "Receivable"}</th></tr></thead><tbody>
            {productEconomics.map((row) => <tr key={row.productLine}><td>{productLineLabel(row.productLine, locale)}</td><td>{number(row.quantitySold)}</td><td>{number(row.sales)} {data.farm.currency}</td><td>{number(row.costs)} {data.farm.currency}</td><td>{number(row.capitalCost)} {data.farm.currency}</td><td>{number(row.sales - row.costs - row.capitalCost)} {data.farm.currency}</td><td>{number(Math.max(0, row.sales - row.amountReceived))} {data.farm.currency}</td></tr>)}
          </tbody></table>}
          {data.animalSales.length > 0 ? <table><thead><tr><th>{sw ? "Tarehe" : "Date"}</th><th>{sw ? "Bidhaa" : "Product"}</th><th>{sw ? "Mnyama/kikundi" : "Animal/group"}</th><th>{sw ? "Kiasi" : "Quantity"}</th><th>{sw ? "Jumla" : "Total"}</th><th>{sw ? "Imepokelewa" : "Received"}</th><th>{sw ? "Inayodaiwa" : "Outstanding"}</th><th>{sw ? "Malipo" : "Payment history"}</th><th>{sw ? "Rekodi malipo" : "Record payment"}</th></tr></thead><tbody>
            {data.animalSales.map((sale) => <tr key={sale.id}><td>{date(sale.soldAt)}</td><td>{productLineLabel(sale.productLine, locale)}</td><td>{sale.animalName ?? "—"}</td><td>{number(sale.quantity)} {sale.unit}</td><td>{number(sale.totalAmount)} {sale.currency}</td><td>{number(sale.amountReceived)} {sale.currency}</td><td>{number(Math.max(0, sale.totalAmount - sale.amountReceived))} {sale.currency}</td><td>{sale.payments.map((payment) => `${date(payment.receivedAt)}: ${number(payment.amount)}`).join(", ") || "—"}</td><td>{sale.totalAmount > sale.amountReceived && <AddDisclosure title={sw ? "Ongeza malipo" : "Add payment"}><ActionForm action={recordAnimalSalePaymentAction} submitLabel={sw ? "Ongeza" : "Add payment"} className="animal-row-action">
              <input name="saleId" type="hidden" value={sale.id} />
              <FormField label={sw ? "Kiasi" : "Amount"} name="amount" type="number" min="0.01" step="0.01" required />
              <FormField label={sw ? "Tarehe" : "Date"} name="receivedAt" type="date" />
              <FormSelect label={sw ? "Njia" : "Method"} name="paymentMethod" required={false} options={[
                { value: "CASH", label: sw ? "Taslimu" : "Cash" },
                { value: "BANK", label: sw ? "Benki" : "Bank" },
                { value: "MOBILE_MONEY", label: sw ? "Pesa kwa simu" : "Mobile money" },
              ]} />
              <FormField label={sw ? "Rejea" : "Reference"} name="reference" required={false} />
            </ActionForm></AddDisclosure>}</td></tr>)}
          </tbody></table> : <p className="field-help">{sw ? "Bado hakuna mauzo yaliyorekodiwa." : "No animal sales recorded yet."}</p>}
        </div>
      </section>}

      {activeSection === "income" && isOwner && <section className="panel">
        <div className="panel-header">
          <div>
            <h3>{sw ? "Mpango wa mauzo ya mifugo" : "Animal sales forecast"}</h3>
            <p>{sw ? "Makadirio haya ni mpango uliowekwa na shamba, si mauzo halisi au kigezo cha nje." : "These are farm-entered forecasts, not actual sales or external benchmarks."}</p>
          </div>
        </div>
        <AddDisclosure title={sw ? "Ongeza utabiri wa mauzo" : "Add sales forecast"}>
        <ActionForm action={createAnimalSalesForecastAction} submitLabel={sw ? "Hifadhi utabiri" : "Save forecast"} className="form-grid">
          <FormSelect label={sw ? "Mstari wa bidhaa" : "Product line"} name="productLine" options={animalProductLines.map((line) => ({ value: line, label: productLineLabel(line, locale) }))} />
          <FormField label={sw ? "Tarehe iliyopangwa" : "Planned date"} name="plannedFor" type="date" required />
          <FormField label={sw ? "Kiasi kinachotarajiwa" : "Expected quantity"} name="quantity" type="number" min="0.0001" step="0.0001" required />
          <FormField label={sw ? "Kipimo" : "Unit"} name="unit" placeholder="litre, kg, tray, head" required />
          <FormField label={sw ? `Bei inayotarajiwa (${data.farm.currency})` : `Expected unit price (${data.farm.currency})`} name="unitPrice" type="number" min="0" step="0.01" required={false} />
          <FormTextArea label={sw ? "Maelezo" : "Notes"} name="notes" />
        </ActionForm>
        </AddDisclosure>
        {forecastWindow.length > 0 ? <div className="table-scroll"><table><thead><tr><th>{sw ? "Tarehe" : "Date"}</th><th>{sw ? "Bidhaa" : "Product line"}</th><th>{sw ? "Kiasi" : "Quantity"}</th><th>{sw ? "Mapato yanayokadiriwa" : "Indicative revenue"}</th></tr></thead><tbody>
          {forecastWindow.map((forecast) => <tr key={forecast.id}><td>{date(forecast.plannedFor)}</td><td>{productLineLabel(forecast.productLine, locale)}</td><td>{number(forecast.quantity)} {forecast.unit}</td><td>{forecast.unitPrice === null ? "—" : `${number(forecast.quantity * forecast.unitPrice)} ${forecast.currency}`}</td></tr>)}
        </tbody></table></div> : <p className="field-help">{sw ? "Hakuna utabiri wa mauzo ndani ya siku 90." : "No sales forecasts are scheduled within the next 90 days."}</p>}
      </section>}

      {activeSection === "income" && isOwner && animalCapitalAssets.length > 0 && <section className="panel">
        <div className="panel-header">
          <div>
            <h3>{sw ? "Uwekezaji wa mtaji wa mifugo" : "Animal capital investments"}</h3>
            <p>{sw ? "Taarifa hizi zinatumia rejista ileile ya vifaa; gharama ya mwezi ni makadirio ya mipango ya uchakavu wa mstari mnyoofu." : "These investments reuse the shared asset register; monthly amounts are straight-line planning estimates only."}</p>
          </div>
        </div>
        <div className="table-scroll"><table><thead><tr><th>{sw ? "Kifaa" : "Asset"}</th><th>{sw ? "Bidhaa" : "Product line"}</th><th>{sw ? "Gharama ya ununuzi" : "Purchase cost"}</th><th>{sw ? "Chanzo cha fedha" : "Funding source"}</th><th>{sw ? "Makadirio ya mwezi" : "Monthly estimate"}</th></tr></thead><tbody>
          {animalCapitalAssets.map((asset) => {
            const monthlyEstimate = asset.purchaseCost !== null && asset.expectedLifeMonths
              ? Math.max(0, (asset.purchaseCost - (asset.salvageValue ?? 0)) / asset.expectedLifeMonths)
              : null;
            return <tr key={asset.id}><td>{asset.name}</td><td>{asset.productLine ? productLineLabel(asset.productLine, locale) : "—"}</td><td>{asset.purchaseCost === null ? "—" : `${number(asset.purchaseCost)} ${asset.currency}`}</td><td>{asset.fundingSource || "—"}</td><td>{monthlyEstimate === null ? "—" : `${number(monthlyEstimate)} ${asset.currency}`}</td></tr>;
          })}
        </tbody></table></div>
      </section>}

      {activeSection === "herd" && <section className="panel">
        <div className="panel-header">
          <div>
            <h3>{sw ? "Vikundi na makundi" : "Groups and batches"}</h3>
            <p>{sw ? "Idadi ya sasa huhesabiwa kutokana na matukio." : "Current counts are calculated from recorded events."}</p>
          </div>
        </div>
        {isOwner && (
          <AddDisclosure title={sw ? "Ongeza kikundi cha mifugo" : "Add animal group"}>
          <ActionForm action={createAnimalGroupAction} submitLabel={sw ? "Hifadhi kikundi" : "Save group"} className="form-grid">
            <FormField label={sw ? "Jina la kikundi" : "Group name"} name="name" required />
            <FormField label={sw ? "Aina ya mnyama" : "Species"} name="species" placeholder={sw ? "Ingiza aina kutoka shambani" : "Enter farm's species"} required />
            <FormSelect
              label={sw ? "Njia ya ufuatiliaji" : "Tracking mode"}
              name="trackingMode"
              options={[
                { value: "INDIVIDUAL", label: sw ? "Kila mnyama ana alama" : "Each animal has a tag" },
                { value: "HEAD_COUNT", label: sw ? "Idadi ya kikundi" : "Group head count" },
              ]}
            />
            <FormField label={sw ? "Tarehe ya kuanza" : "Start date"} name="startDate" type="date" />
            <FormField label={sw ? "Idadi ya kuanzia" : "Starting count"} name="startingCount" type="number" min="0" step="1" defaultValue="0" required />
            <p className="field-help field-wide">
              {sw
                ? "Kwa ufuatiliaji wa alama binafsi, anza na 0 kisha sajili kila mnyama. Kwa ufuatiliaji wa idadi, weka idadi ya mwanzo na rekodi mabadiliko kama matukio."
                : "For individual tracking, start at 0 and register each tagged animal. For head-count tracking, enter the starting count and record changes as events."}
            </p>
            <FormTextArea label={sw ? "Maelezo" : "Notes"} name="notes" />
          </ActionForm>
          </AddDisclosure>
        )}
        {groupsWithCounts.length > 0 ? (
          <div className="table-scroll">
            <table>
              <thead><tr>
                <th>{sw ? "Kikundi" : "Group"}</th>
                <th>{sw ? "Aina" : "Species"}</th>
                <th>{sw ? "Ufuatiliaji" : "Tracking"}</th>
                <th>{sw ? "Idadi ya sasa" : "Current count"}</th>
                <th>{sw ? "Tarehe ya kuanza" : "Started"}</th>
                {isOwner && <th>{sw ? "Kitendo" : "Action"}</th>}
              </tr></thead>
              <tbody>{groupsWithCounts.map((group) => (
                <tr key={group.id}>
                  <td>{group.name}</td>
                  <td>{group.species}</td>
                  <td>{group.trackingMode === "INDIVIDUAL" ? (sw ? "Alama binafsi" : "Individual tags") : (sw ? "Idadi ya kichwa" : "Head count")}</td>
                  <td>{number(group.currentCount, 0)}</td>
                  <td>{date(group.startDate)}</td>
                  {isOwner && <td>
                    <ActionForm action={archiveAnimalGroupAction} submitLabel={sw ? "Hifadhi" : "Archive"} className="animal-row-action">
                      <input name="id" type="hidden" value={group.id} />
                    </ActionForm>
                  </td>}
                </tr>
              ))}</tbody>
            </table>
          </div>
        ) : <p className="field-help">{sw ? "Bado hakuna vikundi vilivyosajiliwa." : "No animal groups registered yet."}</p>}
      </section>}

      {activeSection === "breeding" && <section className="panel">
        <div className="panel-header">
          <div>
            <h3>{sw ? "Jenetiki na uzalishaji" : "Genetics and breeding"}</h3>
            <p>{sw
              ? "Rekodi za ukoo, sifa na uzalishaji hujazwa na shamba. Tarehe ya kuzaliwa inayotarajiwa huonyeshwa tu baada ya kuweka muda wa ujauzito pamoja na chanzo."
              : "Pedigree, traits and breeding records are farm-entered. An expected birth date appears only after the farm records a sourced gestation period."}</p>
          </div>
        </div>
        {isOwner && (
          <div className="form-grid">
            <AddDisclosure title={sw ? "Ongeza taarifa za spishi" : "Add species details"}>
            <ActionForm action={saveAnimalSpeciesProfileAction} submitLabel={sw ? "Hifadhi taarifa za spishi" : "Save species reference"} className="form-grid field-wide">
              <FormField label={sw ? "Aina ya mnyama" : "Species"} name="species" required />
              <FormField label={sw ? "Siku za ujauzito (si lazima)" : "Gestation days (optional)"} name="gestationDays" type="number" min="1" max="1000" step="1" required={false} />
              <FormSelect label={sw ? "Lebo ya chanzo" : "Source label"} name="sourceLabel" required={false} options={sourceLabels.map((label) => ({ value: label, label: sourceLabelText(label, locale) }))} />
              <FormField label={sw ? "Tarehe ya chanzo" : "Source date"} name="sourceDate" type="date" required={false} />
              <FormField label={sw ? "Maelezo ya chanzo" : "Source note"} name="sourceNote" required={false} />
            </ActionForm>
            </AddDisclosure>
            <AddDisclosure title={sw ? "Ongeza aina ya uzalishaji" : "Add breed"}>
            <ActionForm action={createAnimalBreedAction} submitLabel={sw ? "Sajili aina ya uzalishaji" : "Register breed"} className="form-grid field-wide">
              <FormField label={sw ? "Aina ya mnyama" : "Species"} name="species" required />
              <FormField label={sw ? "Jina la uzazi" : "Breed name"} name="name" required />
              <FormSelect label={sw ? "Madhumuni" : "Purpose"} name="purpose" options={animalPurposes.map((purpose) => ({
                value: purpose,
                label: purposeLabel(purpose, locale),
              }))} />
            </ActionForm>
            </AddDisclosure>
            {data.animalBreeds.length > 0 && (
              <AddDisclosure title={sw ? "Ongeza kigezo cha uzazi" : "Add breed benchmark"}>
              <ActionForm action={createAnimalBreedBenchmarkAction} submitLabel={sw ? "Hifadhi kigezo chenye chanzo" : "Save sourced breed benchmark"} className="form-grid field-wide">
                <FormSelect label={sw ? "Uzazi" : "Breed"} name="breedId" options={data.animalBreeds.map((breed) => ({ value: breed.id, label: `${breed.name} · ${breed.species}` }))} />
                <FormField label={sw ? "Sifa/kigezo" : "Trait"} name="traitName" required />
                <FormField label={sw ? "Thamani" : "Value"} name="value" required />
                <FormField label={sw ? "Kipimo (hiari)" : "Unit (optional)"} name="unit" required={false} />
                <FormSelect label={sw ? "Lebo ya chanzo" : "Source label"} name="sourceLabel" options={sourceLabels.map((label) => ({ value: label, label: sourceLabelText(label, locale) }))} />
                <FormField label={sw ? "Tarehe ya chanzo" : "Source date"} name="sourceDate" type="date" required />
                <FormField label={sw ? "Maelezo ya chanzo" : "Source note"} name="sourceNote" required />
              </ActionForm>
              </AddDisclosure>
            )}
          </div>
        )}
        {data.animalSpeciesProfiles.length > 0 && (
          <div className="record-list">
            {data.animalSpeciesProfiles.map((profile) => (
              <p key={profile.id}><strong>{profile.species}</strong>
                {profile.gestationDays === null
                  ? ` · ${sw ? "hakuna muda wa ujauzito uliowekwa" : "no gestation period set"}`
                  : ` · ${profile.gestationDays} ${sw ? "siku za ujauzito" : "gestation days"} · ${profile.sourceLabel ? sourceLabelText(profile.sourceLabel, locale) : ""} · ${date(profile.sourceDate)} · ${profile.sourceNote}`}
              </p>
            ))}
          </div>
        )}
        {data.animalBreeds.length > 0 && (
          <div className="table-scroll"><table><thead><tr>
            <th>{sw ? "Aina / uzazi" : "Species / breed"}</th><th>{sw ? "Madhumuni" : "Purpose"}</th>
            <th>{sw ? "Vigezo vya marejeo" : "Reference benchmarks"}</th>
          </tr></thead><tbody>{data.animalBreeds.map((breed) => (
            <tr key={breed.id}>
              <td>{breed.species} · {breed.name}</td><td>{purposeLabel(breed.purpose, locale)}</td>
              <td>{breed.benchmarks.length
                ? breed.benchmarks.map((benchmark) =>
                    `${benchmark.traitName}: ${benchmark.value}${benchmark.unit ? ` ${benchmark.unit}` : ""} (${sourceLabelText(benchmark.sourceLabel, locale)}, ${date(benchmark.sourceDate)} — ${benchmark.sourceNote})`,
                  ).join(" · ")
                : (sw ? "Hakuna vigezo vilivyowekwa" : "No benchmark values entered")}</td>
            </tr>
          ))}</tbody></table></div>
        )}
        <AddDisclosure title={sw ? "Rekodi sifa ya mnyama" : "Record animal trait"}>
        <ActionForm
          action={recordAnimalTraitAction}
          submitLabel={sw ? "Rekodi sifa" : "Record animal trait"}
          className="form-grid"
          offlineActionKey="animal-trait-record"
          workspaceId={data.farm.id}
          locale={locale}
        >
          <FormSelect label={sw ? "Mnyama" : "Animal"} name="animalId" options={animalOptions} />
          <FormSelect label={sw ? "Sifa" : "Trait"} name="type" options={animalTraitTypes.map((type) => ({ value: type, label: traitLabel(type, locale) }))} />
          <FormField label={sw ? "Thamani ya maandishi (rangi, pembe, tabia)" : "Text value (colour, horn status, temperament)"} name="textValue" required={false} />
          <FormField label={sw ? "Thamani ya namba (uzito wa kuzaliwa/alama)" : "Numeric value (birth weight/score)"} name="numericValue" type="number" min="0" step="any" required={false} />
          <FormField label={sw ? "Kipimo" : "Unit"} name="unit" required={false} />
          <FormField label={sw ? "Tarehe" : "Date"} name="recordedAt" type="date" />
          <FormTextArea label={sw ? "Maelezo" : "Notes"} name="notes" />
        </ActionForm>
        </AddDisclosure>
        {data.animalTraitRecords.length > 0 && (
          <div className="table-scroll"><table><thead><tr>
            <th>{sw ? "Tarehe" : "Date"}</th><th>{sw ? "Mnyama" : "Animal"}</th>
            <th>{sw ? "Sifa" : "Trait"}</th><th>{sw ? "Thamani" : "Value"}</th><th>{sw ? "Maelezo" : "Notes"}</th>
          </tr></thead><tbody>{data.animalTraitRecords.map((record) => (
            <tr key={record.id}>
              <td>{date(record.recordedAt)}</td><td>{record.animalTag}</td><td>{traitLabel(record.type, locale)}</td>
              <td>{record.textValue ?? `${number(record.numericValue ?? 0)} ${record.unit ?? ""}`}</td><td>{record.notes ?? "—"}</td>
            </tr>
          ))}</tbody></table></div>
        )}
        <AddDisclosure title={sw ? "Ongeza rekodi ya uzalishaji" : "Add breeding record"}>
        <ActionForm
          action={recordAnimalBreedingAction}
          submitLabel={sw ? "Hifadhi tukio la uzalishaji" : "Save breeding record"}
          className="form-grid"
          offlineActionKey="animal-breeding-record"
          workspaceId={data.farm.id}
          locale={locale}
        >
          <FormSelect label={sw ? "Mama" : "Dam"} name="damId" options={animalOptions} />
          <FormSelect label={sw ? "Baba (ikiwa anajulikana)" : "Sire (if known)"} name="sireId" required={false} options={animalOptions} />
          <FormSelect label={sw ? "Njia" : "Method"} name="method" options={breedingMethods.map((method) => ({
            value: method,
            label: sw ? (method === "NATURAL" ? "Asili" : "Upandikizaji") : method === "NATURAL" ? "Natural" : "Artificial insemination",
          }))} />
          <FormField label={sw ? "Kundi la shahawa (ikiwa limetumika)" : "Semen batch (if used)"} name="semenBatch" required={false} />
          <FormField label={sw ? "Tarehe ya kupandisha (inaweza kuwa ya baadaye kwa mpango)" : "Service date (future dates can be planned)"} name="servedAt" type="date" required />
          <FormTextArea label={sw ? "Maelezo" : "Notes"} name="notes" />
        </ActionForm>
        </AddDisclosure>
        {data.animalBreedingRecords.length > 0 ? (
          <div className="table-scroll"><table><thead><tr>
            <th>{sw ? "Tarehe" : "Service date"}</th><th>{sw ? "Mama / baba" : "Dam / sire"}</th>
            <th>{sw ? "Njia / shahawa" : "Method / semen batch"}</th><th>{sw ? "Kuzaliwa kunakotarajiwa" : "Expected birth"}</th>
            <th>{sw ? "Ukaguzi / matokeo" : "Check / outcome"}</th><th>{sw ? "Maendeleo" : "Progress"}</th>
          </tr></thead><tbody>{data.animalBreedingRecords.map((record) => {
            const related = record.sireId ? areCloseRelatives(record.damId, record.sireId, data.animalLineage) : false;
            return (
              <tr key={record.id}>
                <td>{date(record.servedAt)}</td><td>{record.damTag} / {record.sireTag ?? record.semenBatch ?? "—"}</td>
                <td>{record.method.replaceAll("_", " ").toLowerCase()}</td>
                <td>{record.expectedBirthAt ? date(record.expectedBirthAt) : (sw ? "Muda wa ujauzito haujawekwa" : "Gestation not configured")}</td>
                <td>{[
                  record.pregnancyResult ? `${record.pregnancyResult} · ${date(record.pregnancyCheckedAt)}` : null,
                  record.birthOutcome ? `${record.birthOutcome} · ${date(record.birthAt)}` : null,
                  related ? (sw ? "Tahadhari: ukoo wa karibu" : "Warning: close-relative mating") : null,
                ].filter(Boolean).join(" · ") || "—"}</td>
                <td>{!record.birthAt && (
                  <AddDisclosure title={sw ? "Sasisha maendeleo ya uzazi" : "Update breeding progress"}>
                  <ActionForm action={updateAnimalBreedingProgressAction} submitLabel={sw ? "Hifadhi maendeleo" : "Save progress"} className="animal-row-action">
                    <input name="id" type="hidden" value={record.id} />
                    <FormField label={sw ? "Tarehe ya ukaguzi wa ujauzito" : "Pregnancy check date"} name="pregnancyCheckedAt" type="date" defaultValue={record.pregnancyCheckedAt?.slice(0, 10)} required={false} />
                    <FormSelect label={sw ? "Matokeo ya ukaguzi" : "Pregnancy result"} name="pregnancyResult" required={false} defaultValue={record.pregnancyResult ?? ""} options={pregnancyResults.map((result) => ({ value: result, label: result.toLowerCase() }))} />
                    <FormField label={sw ? "Tarehe ya kuzaliwa" : "Birth date"} name="birthAt" type="date" required={false} />
                    <FormSelect label={sw ? "Matokeo ya kuzaliwa" : "Birth outcome"} name="birthOutcome" required={false} options={birthOutcomes.map((outcome) => ({ value: outcome, label: outcome.toLowerCase() }))} />
                  </ActionForm>
                  </AddDisclosure>
                )}</td>
              </tr>
            );
          })}</tbody></table></div>
        ) : <p className="field-help">{sw ? "Bado hakuna matukio ya uzalishaji." : "No breeding records yet."}</p>}
      </section>}

      {activeSection === "herd" && <section className="panel">
        <div className="panel-header">
          <div>
            <h3>{sw ? "Wanyama wenye alama" : "Tagged animals"}</h3>
            <p>{sw ? "Tumia namba ya utambulisho iliyopo shambani." : "Use the identification tags already used on the farm."}</p>
          </div>
        </div>
        {isOwner && (
          <>
          <AddDisclosure title={sw ? "Ongeza mnyama mmoja" : "Add one animal"}>
          <ActionForm action={createAnimalAction} submitLabel={sw ? "Sajili mnyama" : "Register animal"} className="form-grid">
            <FormField label={sw ? "Namba ya alama" : "Tag number"} name="tagNumber" required />
            <FormField label={sw ? "Jina (hiari)" : "Name (optional)"} name="name" required={false} />
            <FormField label={sw ? "Aina ya mnyama" : "Species"} name="species" required />
            <FormField label={sw ? "Aina ya uzalishaji" : "Breed"} name="breed" required={false} />
            <FormSelect
              label={sw ? "Rejista ya aina (si lazima)" : "Registered breed (optional)"}
              name="breedId"
              required={false}
              options={data.animalBreeds.map((breed) => ({
                value: breed.id,
                label: `${breed.name} · ${breed.species}`,
              }))}
            />
            <FormField label={sw ? "Jinsia" : "Sex"} name="sex" required={false} />
            <FormField label={sw ? "Tarehe ya kuzaliwa" : "Birth date"} name="birthDate" type="date" />
            <FormSelect
              label={sw ? "Tukio la uzalishaji la mtoto (hiari)" : "Offspring breeding record (optional)"}
              name="breedingRecordId"
              required={false}
              options={data.animalBreedingRecords.map((record) => ({
                value: record.id,
                label: `${record.damTag} / ${record.sireTag ?? record.semenBatch ?? "—"} · ${date(record.servedAt)}`,
              }))}
            />
            <FormSelect label={sw ? "Mama (hiari)" : "Dam (optional)"} name="damId" required={false} options={animalOptions} />
            <FormSelect label={sw ? "Baba (hiari)" : "Sire (optional)"} name="sireId" required={false} options={animalOptions} />
            <FormField label={sw ? "Chanzo (aliyezaliwa/aliyenunuliwa)" : "Source (born/bought)"} name="source" required={false} />
            {isOwner && <FormField label={sw ? `Bei ya ununuzi (${data.farm.currency}, ikiwa inanunuliwa)` : `Purchase price (${data.farm.currency}, if bought)`} name="purchasePrice" type="number" min="0" step="0.01" required={false} />}
            <FormField label={sw ? "Muuzaji" : "Seller"} name="seller" required={false} />
            <FormSelect label={sw ? "Kikundi cha ufuatiliaji binafsi (hiari)" : "Individual-tracking group (optional)"} name="groupId" required={false} options={groupOptions.filter((option) => data.animalGroups.find((group) => group.id === option.value)?.trackingMode === "INDIVIDUAL")} />
          </ActionForm>
          </AddDisclosure>
          <AddDisclosure title={sw ? "Ingiza orodha ya alama" : "Import a tag list"}>
            <ActionForm action={createAnimalsBulkAction} submitLabel={sw ? "Sajili wanyama wote" : "Register animals"} className="form-grid">
              <FormSelect label={sw ? "Kikundi cha ufuatiliaji binafsi (hiari)" : "Individual-tracking group (optional)"} name="groupId" required={false} options={groupOptions.filter((option) => data.animalGroups.find((group) => group.id === option.value)?.trackingMode === "INDIVIDUAL")} />
              <FormField label={sw ? "Aina ya mnyama" : "Species"} name="species" required />
              <FormTextArea label={sw ? "Namba za alama (mstari, koma au semicolon moja kwa kila namba)" : "Tag numbers (one per line, comma, or semicolon)"} name="tags" required rows={5} />
              <p className="field-help field-wide">{sw ? "Hadi wanyama 500 kwa mara moja. Majina yanaweza kuongezwa baadaye kwa usajili wa mnyama mmoja." : "Up to 500 animals at once. Add names later by editing an individual animal record."}</p>
            </ActionForm>
          </AddDisclosure>
          </>
        )}
        {data.animals.length > 0 ? (
          <div className="table-scroll">
            <table>
              <thead><tr>
                <th>{sw ? "Jina" : "Name"}</th>
                <th>{sw ? "Alama" : "Tag"}</th>
                <th>{sw ? "Aina" : "Species"}</th>
                <th>{sw ? "Uzazi" : "Breed"}</th>
                <th>{sw ? "Kikundi" : "Group"}</th>
                <th>{sw ? "Wazazi" : "Parents"}</th>
                <th>{sw ? "Jinsia" : "Sex"}</th>
                {isOwner && <th>{sw ? "Bei ya ununuzi" : "Purchase price"}</th>}
                {isOwner && <th>{sw ? "Muuzaji" : "Seller"}</th>}
                <th>{sw ? "Hali" : "Status"}</th>
                {isOwner && <th>{sw ? "Kitendo" : "Action"}</th>}
              </tr></thead>
              <tbody>{data.animals.map((animal) => (
                <tr key={animal.id}>
                  <td>{animal.name ?? "—"}</td>
                  <td>{animal.tagNumber}</td>
                  <td>{animal.species}</td>
                  <td>{animal.breedName ?? "—"}</td>
                  <td>{animal.groupName ?? "—"}</td>
                  <td>{[
                    animal.damTag ? `${sw ? "Mama" : "Dam"}: ${animal.damTag}` : null,
                    animal.sireTag ? `${sw ? "Baba" : "Sire"}: ${animal.sireTag}` : null,
                  ].filter(Boolean).join(" · ") || "—"}</td>
                  <td>{animal.sex ?? "—"}</td>
                  {isOwner && <td>{animal.purchasePrice === null ? "—" : `${number(animal.purchasePrice)} ${data.farm.currency}`}</td>}
                  {isOwner && <td>{animal.seller ?? "—"}</td>}
                  <td>{animal.status}</td>
                  {isOwner && <td>
                    <ActionForm action={archiveAnimalAction} submitLabel={sw ? "Hifadhi" : "Archive"} className="animal-row-action">
                      <input name="id" type="hidden" value={animal.id} />
                    </ActionForm>
                  </td>}
                </tr>
              ))}</tbody>
            </table>
          </div>
        ) : <p className="field-help">{sw ? "Bado hakuna wanyama binafsi waliosajiliwa." : "No individual animals registered yet."}</p>}
      </section>}

      {activeSection === "herd" && <section className="panel">
        <div className="panel-header">
          <div>
            <h3>{sw ? "Matukio ya mifugo" : "Animal events"}</h3>
            <p>{sw ? "Mizani ya vikundi hubadilishwa na kuzaliwa, ununuzi, mauzo, vifo au kuondoa kundini." : "Group counts change with births, purchases, sales, deaths and culls."}</p>
          </div>
        </div>
        <AddDisclosure title={sw ? "Rekodi tukio la mifugo" : "Record an animal event"}>
        <ActionForm action={recordAnimalEventAction} submitLabel={sw ? "Rekodi tukio" : "Record event"} className="form-grid">
          <FormSelect label={sw ? "Kikundi cha idadi (chagua moja tu)" : "Head-count group (choose only one target)"} name="animalGroupId" required={false} options={headCountGroupOptions} />
          <FormSelect label={sw ? "Mnyama binafsi (chagua moja tu)" : "Individual animal (choose only one target)"} name="animalId" required={false} options={animalOptions} />
          <FormSelect label={sw ? "Tukio" : "Event"} name="type" options={eventOptions} />
          <FormField label={sw ? "Tarehe" : "Date"} name="occurredAt" type="date" />
          <FormField label={sw ? "Idadi iliyoathirika (kwa kikundi)" : "Quantity affected (for groups)"} name="quantity" type="number" min="1" step="1" required={false} />
          {isOwner && <FormField label={sw ? `Gharama ya ununuzi (${data.farm.currency}, kwa tukio la ununuzi)` : `Purchase cost (${data.farm.currency}, for purchase events)`} name="purchaseCost" type="number" min="0" step="0.01" required={false} />}
          <FormField label={sw ? "Muuzaji (kwa ununuzi)" : "Seller (for purchases)"} name="seller" required={false} />
          <FormTextArea label={sw ? "Maelezo" : "Notes"} name="notes" />
        </ActionForm>
        </AddDisclosure>
        {eventRows.length > 0 && (
          <div className="table-scroll">
            <table>
              <thead><tr>
                <th>{sw ? "Tarehe" : "Date"}</th>
                <th>{sw ? "Mnyama/kikundi" : "Animal/group"}</th>
                <th>{sw ? "Tukio" : "Event"}</th>
                <th>{sw ? "Idadi" : "Quantity"}</th>
                {isOwner && <th>{sw ? "Gharama" : "Purchase cost"}</th>}
                <th>{sw ? "Maelezo" : "Notes"}</th>
              </tr></thead>
              <tbody>{eventRows.map((event) => (
                <tr key={event.id}>
                  <td>{date(event.occurredAt)}</td>
                  <td>{event.target}</td>
                  <td>{eventLabel(event.type, locale)}</td>
                  <td>{event.quantity ?? "—"}</td>
                  {isOwner && <td>{event.purchaseCost === null ? "—" : `${number(event.purchaseCost)} ${data.farm.currency}`}</td>}
                  <td>{[event.seller, event.notes].filter(Boolean).join(" · ") || "—"}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </section>}

      {activeSection === "feed" && <section className="panel">
        <div className="panel-header">
          <div>
            <h3>{sw ? "Bidhaa za chakula na utabiri wa mahitaji" : "Feed products and demand forecast"}</h3>
            <p>{sw ? "Rekodi maelezo na ubora wa chakula, kisha kadiria mahitaji kwa idadi ya wanyama na mgao uliowekwa na shamba." : "Record feed details and quality, then forecast needs from animal counts and farm-entered daily rations."}</p>
          </div>
        </div>
        {isOwner && (
          <AddDisclosure title={sw ? "Ongeza bidhaa ya chakula" : "Add feed item"}>
          <ActionForm action={createStockItemAction} submitLabel={sw ? "Hifadhi bidhaa" : "Save feed item"} className="form-grid">
            <input name="category" type="hidden" value="FEED" />
            <FormField label={sw ? "Jina la chakula" : "Feed name"} name="name" required />
            <FormField label={sw ? "Kipimo cha akiba (mf. kg)" : "Stock unit (e.g. kg)"} name="unit" required />
            <FormField label={sw ? "Kizingiti cha akiba ndogo" : "Low-stock threshold"} name="lowStockThreshold" type="number" min="0" step="any" required={false} />
            <FormField label={sw ? "Protini ghafi (%)" : "Crude protein (%)"} name="crudeProteinPct" type="number" min="0" max="100" step="any" required={false} />
            <FormField label={sw ? "Nyuzi ghafi (%)" : "Crude fiber (%)"} name="crudeFiberPct" type="number" min="0" max="100" step="any" required={false} />
            <FormField label={sw ? "Thamani ya nishati" : "Energy value"} name="energyValue" type="number" min="0" step="any" required={false} />
            <FormField label={sw ? "Kipimo cha nishati (mf. MJ/kg)" : "Energy unit (e.g. MJ/kg)"} name="energyUnit" required={false} />
            <FormTextArea label={sw ? "Ubora/virutubisho na chanzo" : "Quality, nutrients and source notes"} name="qualityNotes" required={false} />
            <FormTextArea label={sw ? "Maelekezo ya kuhifadhi" : "Storage instructions"} name="storageInstructions" required={false} />
            <FormField label={sw ? "Muda wa kuhifadhi (siku)" : "Shelf life (days)"} name="shelfLifeDays" type="number" min="1" step="1" required={false} />
            <FormField label={sw ? "Muda baada ya kufungua (siku)" : "After-opening life (days)"} name="openedLifeDays" type="number" min="1" step="1" required={false} />
            <p className="field-help field-wide">{sw ? "Bidhaa mpya huanza na akiba sifuri. Rekodi ununuzi/kuingiza akiba kwenye sehemu ya Mazao → Pembejeo na akiba." : "New feed items start with zero stock. Record purchases or stock intake under Crops → Inputs & stock."}</p>
          </ActionForm>
          </AddDisclosure>
        )}
        {feedItems.length > 0 ? (
          <div className="table-scroll"><table><thead><tr>
            <th>{sw ? "Chakula" : "Feed"}</th><th>{sw ? "Akiba" : "Stock"}</th>
            <th>{sw ? "Protini ghafi" : "Crude protein"}</th><th>{sw ? "Nyuzi ghafi" : "Crude fiber"}</th>
            <th>{sw ? "Nishati" : "Energy"}</th><th>{sw ? "Muda wa kuhifadhi" : "Shelf life"}</th>
            <th>{sw ? "Matumizi yaliyorekodiwa" : "Recorded intake"}</th>
            <th>{sw ? "Uhifadhi/ubora" : "Storage / quality"}</th>
          </tr></thead><tbody>{feedItems.map((item) => (
            <tr key={item.id}>
              <td>{item.name}</td><td>{number(item.balance)} {item.unit}</td>
              <td>{item.crudeProteinPct === null ? "—" : `${number(item.crudeProteinPct)}%`}</td>
              <td>{item.crudeFiberPct === null ? "—" : `${number(item.crudeFiberPct)}%`}</td>
              <td>{item.energyValue === null ? "—" : `${number(item.energyValue)} ${item.energyUnit ?? ""}`}</td>
              <td>{item.shelfLifeDays === null ? "—" : `${item.shelfLifeDays} ${sw ? "siku" : "days"}`}{item.openedLifeDays === null ? "" : ` · ${sw ? "baada ya kufungua" : "opened"}: ${item.openedLifeDays} ${sw ? "siku" : "days"}`}</td>
              <td>{(() => {
                const summary = data.animalFeedIntakeSummary.find((record) => record.feedItemId === item.id);
                return summary ? `${number(summary.totalQuantity)} ${summary.unit} · ${summary.recordCount} ${sw ? "rekodi" : "entries"}` : "—";
              })()}</td>
              <td>{[item.storageInstructions, item.qualityNotes].filter(Boolean).join(" · ") || "—"}</td>
            </tr>
          ))}</tbody></table></div>
        ) : <p className="field-help">{sw ? "Bado hakuna chakula kilichosajiliwa." : "No feed items registered yet."}</p>}
        {isOwner && (
          <AddDisclosure title={sw ? "Weka mgao wa kila siku kwa kikundi" : "Set a group's daily ration"}>
          <ActionForm action={saveFeedRationAction} submitLabel={sw ? "Hifadhi mgao" : "Save ration"} className="form-grid">
            <FormSelect label={sw ? "Kikundi" : "Group"} name="animalGroupId" options={groupOptions} />
            <FormSelect
              label={sw ? "Bidhaa ya chakula (aina FEED)" : "Feed item (category FEED)"}
              name="itemId"
              options={feedItems.map((item) => ({ value: item.id, label: `${item.name} (${item.unit})` }))}
            />
            <FormField label={sw ? "Kiasi kwa mnyama kwa siku (kwa kipimo cha bidhaa)" : "Quantity per head per day (item unit)"} name="quantityPerHead" type="number" min="0.0001" step="any" required />
          </ActionForm>
          </AddDisclosure>
        )}
        <label className="field field-compact">
          <span>{sw ? "Siku za kupanga" : "Planning days"}</span>
          <input type="number" min="1" max="365" value={planningDays} onChange={(event) => setPlanningDays(Number(event.target.value) || 1)} />
        </label>
        {feedPlans.length > 0 ? (
          <div className="table-scroll">
            <table>
              <thead><tr>
                <th>{sw ? "Kikundi na bidhaa" : "Group and item"}</th>
                <th>{sw ? "Idadi × mgao wa kila siku" : "Head count × daily ration"}</th>
                <th>{sw ? "Mahitaji ya mpango" : "Planned need"}</th>
                <th>{sw ? "Protini ghafi inayokadiriwa" : "Estimated crude protein"}</th>
                <th>{sw ? "Nyuzi ghafi zinazokadiriwa" : "Estimated crude fiber"}</th>
                <th>{sw ? "Akiba" : "Stock"}</th>
                <th>{sw ? "Upungufu" : "Shortfall"}</th>
                <th>{sw ? "Siku zilizobaki kwa mgao huu" : "Days left at this ration"}</th>
              </tr></thead>
              <tbody>{feedPlans.map((plan) => (
                <tr key={plan.ration.id}>
                  <td>{plan.group.name} · {plan.ration.itemName}</td>
                  <td>{plan.group.currentCount} × {number(plan.ration.quantityPerHead)} {plan.ration.unit}/{sw ? "mnyama/siku" : "head/day"} · {number(plan.nutrition?.dailyFeedGroupKg ?? plan.group.currentCount * plan.ration.quantityPerHead)} {plan.nutrition ? "kg" : plan.ration.unit}/{sw ? "siku" : "day"}</td>
                  <td>{number(plan.plannedQuantity)} {plan.ration.unit}</td>
                  <td>{plan.nutrition?.plannedCrudeProteinKg === null || plan.nutrition?.plannedCrudeProteinKg === undefined ? "—" : `${number(plan.nutrition.plannedCrudeProteinKg)} kg`}</td>
                  <td>{plan.nutrition?.plannedCrudeFiberKg === null || plan.nutrition?.plannedCrudeFiberKg === undefined ? "—" : `${number(plan.nutrition.plannedCrudeFiberKg)} kg`}</td>
                  <td>{number(plan.stock)} {plan.ration.unit}</td>
                  <td>{number(plan.shortfall)} {plan.ration.unit}</td>
                  <td>{plan.daysRemaining === null ? "—" : number(plan.daysRemaining)}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        ) : <p className="field-help">{sw ? "Weka mgao wa chakula kwa kikundi ili kuona utabiri." : "Set a feed ration for a group to see its demand forecast."}</p>}
        {feedUseRecords.length > 0 && <div className="table-scroll">
          <h4>{sw ? "Historia ya matumizi ya chakula" : "Feed intake history"}</h4>
          <table><thead><tr><th>{sw ? "Tarehe" : "Date"}</th><th>{sw ? "Chakula" : "Feed"}</th><th>{sw ? "Mnyama/kikundi" : "Animal/group"}</th><th>{sw ? "Kiasi kilichotolewa" : "Amount fed"}</th><th>{sw ? "Maelezo" : "Notes"}</th></tr></thead>
            <tbody>{feedUseRecords.map((record) => <tr key={record.id}><td>{date(record.recordedAt)}</td><td>{record.feedItemName ?? "—"}</td><td>{record.animalName ? `${record.animalName} · ` : ""}{record.animalGroupName ?? record.animalTag ?? "—"}</td><td>{number(record.quantity ?? 0)} {record.unit ?? ""}</td><td>{record.notes ?? "—"}</td></tr>)}</tbody>
          </table>
        </div>}
        {feedPerformanceRecords.length > 0 && <div className="table-scroll">
          <h4>{sw ? "Vipimo vya utendaji vilivyounganishwa na chakula" : "Performance records linked to feed"}</h4>
          <p className="field-help">{sw ? "Hivi ni vipimo vilivyorekodiwa pamoja na bidhaa; uhusiano pekee hauonyeshi kuwa chakula ndicho kilichosababisha matokeo." : "These are measurements recorded alongside a feed item; association alone does not establish that the feed caused the result."}</p>
          <table><thead><tr><th>{sw ? "Tarehe" : "Date"}</th><th>{sw ? "Chakula" : "Feed"}</th><th>{sw ? "Mnyama/kikundi" : "Animal/group"}</th><th>{sw ? "Kipimo" : "Measure"}</th><th>{sw ? "Thamani" : "Value"}</th></tr></thead>
            <tbody>{feedPerformanceRecords.map((record) => <tr key={record.id}><td>{date(record.recordedAt)}</td><td>{record.feedItemName ?? "—"}</td><td>{record.animalName ? `${record.animalName} · ` : ""}{record.animalGroupName ?? record.animalTag ?? "—"}</td><td>{healthTypeLabel(record.type)}</td><td>{number(record.quantity)} {record.unit}</td></tr>)}</tbody>
          </table>
        </div>}
        {data.animalFeedPerformanceSummary.length > 0 && <div className="table-scroll">
          <h4>{sw ? "Muhtasari wa kihistoria wa vipimo kwa chakula" : "Historical performance summary by feed"}</h4>
          <table><thead><tr><th>{sw ? "Chakula" : "Feed"}</th><th>{sw ? "Kipimo" : "Measure"}</th><th>{sw ? "Wastani wa vipimo" : "Average recorded measure"}</th><th>{sw ? "Idadi ya vipimo" : "Measurements"}</th></tr></thead>
            <tbody>{data.animalFeedPerformanceSummary.map((summary) => <tr key={`${summary.feedItemId}-${summary.type}-${summary.unit}`}><td>{summary.feedItemName}</td><td>{healthTypeLabel(summary.type)}</td><td>{summary.averageQuantity === null ? "—" : `${number(summary.averageQuantity)} ${summary.unit}`}</td><td>{summary.recordCount}</td></tr>)}</tbody>
          </table>
        </div>}
      </section>}

      {activeSection === "daily" && <section className="panel">
        <div className="panel-header">
          <div>
            <h3>{sw ? "Kirekodi cha kila siku" : "Daily tracker"}</h3>
            <p>{sw ? "Rekodi chakula kilichotolewa, maji, mazao yaliyokusanywa au ukaguzi wa kumbukumbu. Ingizo la chakula hupunguza akiba." : "Record feed given, water, collected products or a health-check note. Feed entries deduct stock."}</p>
          </div>
        </div>
        <AddDisclosure title={sw ? "Rekodi matumizi ya kila siku" : "Record daily activity"}>
        <ActionForm
          action={recordAnimalDailyAction}
          submitLabel={sw ? "Hifadhi rekodi" : "Save daily record"}
          className="form-grid"
          offlineActionKey="animal-daily-record"
          workspaceId={data.farm.id}
          locale={locale}
        >
          <FormSelect label={sw ? "Kikundi (chagua moja tu)" : "Group (choose only one target)"} name="animalGroupId" required={false} options={groupOptions} />
          <FormSelect label={sw ? "Mnyama binafsi (chagua moja tu)" : "Individual animal (choose only one target)"} name="animalId" required={false} options={animalOptions} />
          <FormSelect label={sw ? "Shughuli" : "Activity"} name="type" options={dailyOptions} />
          <FormField label={sw ? "Kiasi (ikiwa kinapimwa)" : "Quantity (when measured)"} name="quantity" type="number" min="0.0001" step="any" required={false} />
          <FormSelect label={sw ? "Bidhaa ya chakula (kwa kulisha)" : "Feed item (for feeding)"} name="feedItemId" required={false} options={feedItems.map((item) => ({ value: item.id, label: `${item.name} (${item.unit})` }))} />
          <FormField label={sw ? "Kipimo (kwa mfano ulioingiza)" : "Unit (as entered on farm)"} name="unit" placeholder={sw ? "Weka kipimo" : "Enter unit"} required={false} />
          <FormField label={sw ? "Tarehe" : "Date"} name="recordedAt" type="date" />
          <FormTextArea label={sw ? "Maelezo" : "Notes"} name="notes" placeholder={sw ? "Ukaguzi ni kumbukumbu tu, si utambuzi." : "A check is a record only, not a diagnosis."} />
        </ActionForm>
        </AddDisclosure>
        {data.animalDailyRecords.length > 0 ? (
          <div className="table-scroll">
            <table>
              <thead><tr>
                <th>{sw ? "Tarehe" : "Date"}</th>
                <th>{sw ? "Mnyama/kikundi" : "Animal/group"}</th>
                <th>{sw ? "Shughuli" : "Activity"}</th>
                <th>{sw ? "Kiasi" : "Quantity"}</th>
                <th>{sw ? "Tahadhari ya afya" : "Health flag"}</th>
                <th>{sw ? "Maelezo" : "Notes"}</th>
              </tr></thead>
              <tbody>{data.animalDailyRecords.map((record) => {
                const hasOpenCase = data.animalHealthCases.some(
                  (healthCase) => !healthCase.resolvedAt && targetsOverlap(healthCase, record),
                );
                return (
                  <tr key={record.id}>
                    <td>{date(record.recordedAt)}</td>
                    <td>{record.animalName ? `${record.animalName} · ` : ""}{record.animalGroupName ?? record.animalTag ?? "—"}</td>
                    <td>{dailyLabel(record.type, locale)}{record.feedItemName ? ` · ${record.feedItemName}` : ""}</td>
                    <td>{record.quantity === null ? "—" : `${number(record.quantity)} ${record.unit ?? ""}`}</td>
                    <td>{hasOpenCase ? <span className="status-pill status-warning">{sw ? "Kesi wazi" : "Open case"}</span> : "—"}</td>
                    <td>{record.notes ?? "—"}</td>
                  </tr>
                );
              })}</tbody>
            </table>
          </div>
        ) : <p className="field-help">{sw ? "Bado hakuna kumbukumbu za kila siku." : "No daily animal records yet."}</p>}
      </section>}

      {activeSection === "health" && <section className="panel">
        <div className="panel-header">
          <div>
            <h3>{sw ? "Afya, chanjo na dawa" : "Health, vaccination and medicine"}</h3>
            <p>{sw ? "Ratiba hujazwa na shamba au daktari wa mifugo; mfumo hautambui magonjwa wala kutoa ushauri. Akiba ya dawa inaweza kuunganishwa kwenye bidhaa." : "Schedules are entered by the farm or its vet; Shamba does not diagnose or prescribe. Medicine stock can be linked to a product."}</p>
          </div>
        </div>
        {isOwner && (
          <AddDisclosure title={sw ? "Ongeza bidhaa ya afya" : "Add health product"}>
          <ActionForm action={createAnimalHealthProductAction} submitLabel={sw ? "Ongeza bidhaa ya afya" : "Add health product"} className="form-grid">
            <FormField label={sw ? "Jina la chanjo/dawa" : "Vaccine or medicine name"} name="name" required />
            <FormSelect label={sw ? "Aina" : "Type"} name="type" options={[
              { value: "VACCINE", label: sw ? "Chanjo" : "Vaccine" },
              { value: "MEDICINE", label: sw ? "Dawa" : "Medicine" },
              { value: "OTHER", label: sw ? "Nyingine" : "Other" },
            ]} />
            <FormSelect
              label={sw ? "Bidhaa ya akiba ya dawa (si lazima)" : "Veterinary medicine stock item (optional)"}
              name="stockItemId"
              required={false}
              options={data.stockItems
                .filter((item) => item.category === "VETERINARY_MEDICINE")
                .map((item) => ({ value: item.id, label: `${item.name} (${item.unit})` }))}
            />
            <FormField label={sw ? "Ugonjwa unaolengwa (ikiwa umeelezwa)" : "Disease covered (if stated)"} name="diseaseCovered" required={false} />
            <FormField label={sw ? "Dozi" : "Dose"} name="dose" required={false} />
            <FormField label={sw ? "Njia ya matumizi" : "Route"} name="route" required={false} />
            <FormField label={sw ? "Masharti ya uhifadhi" : "Storage"} name="storage" required={false} />
            <FormField label={sw ? "Namba ya kundi" : "Batch"} name="batch" required={false} />
            <FormField label={sw ? "Inaisha tarehe" : "Expiry date"} name="expiresAt" type="date" />
            {isOwner && <FormField label={`${sw ? "Gharama kwa dozi" : "Cost per dose"} (${data.farm.currency})`} name="costPerDose" type="number" min="0" step="any" required={false} />}
            <FormField label={sw ? "Siku za kusubiri kabla ya mazao" : "Withdrawal days before products"} name="withdrawalDays" type="number" min="0" max="3650" step="1" defaultValue="0" required />
          </ActionForm>
          </AddDisclosure>
        )}
        {data.animalHealthProducts.length > 0 ? (
          <div className="table-scroll">
            <table><thead><tr>
              <th>{sw ? "Bidhaa" : "Product"}</th><th>{sw ? "Aina" : "Type"}</th>
              <th>{sw ? "Ugonjwa/dozi/njia" : "Disease / dose / route"}</th>
              <th>{sw ? "Kundi/inaisha" : "Batch / expiry"}</th>
              <th>{sw ? "Bidhaa ya akiba" : "Linked stock"}</th>
              <th>{sw ? "Muda wa kusubiri" : "Withdrawal"}</th>
              {isOwner && <th>{sw ? "Gharama kwa dozi" : "Cost per dose"}</th>}
            </tr></thead><tbody>{data.animalHealthProducts.map((product) => (
              <tr key={product.id}>
                <td>{product.name}</td><td>{healthTypeLabel(product.type)}</td>
                <td>{[product.diseaseCovered, product.dose, product.route].filter(Boolean).join(" · ") || "—"}</td>
                <td>{[product.batch, date(product.expiresAt)].filter(Boolean).join(" · ") || "—"}</td>
                <td>{product.stockItemName ? `${product.stockItemName} (${product.stockItemUnit})` : "—"}</td>
                <td>{product.withdrawalDays} {sw ? "siku" : "days"}</td>
                {isOwner && <td>{product.costPerDose === null ? "—" : `${number(product.costPerDose)} ${data.farm.currency}`}</td>}
              </tr>
            ))}</tbody></table>
          </div>
        ) : <p className="field-help">{sw ? "Hakuna chanjo au dawa zilizosajiliwa." : "No vaccines or medicines registered yet."}</p>}
      </section>}

      {activeSection === "health" && <section className="panel">
        <div className="panel-header">
          <div>
            <h3>{sw ? "Ratiba za chanjo na zinazokaribia" : "Vaccination schedules and reminders"}</h3>
            <p>{sw ? "Tarehe zinatokana na ratiba za shamba pekee; tarehe ya kuzaliwa inahitajika kwa ratiba za umri." : "Dates use only farm-entered schedules; age-based schedules need an animal birth date."}</p>
          </div>
        </div>
        {isOwner && (
          <AddDisclosure title={sw ? "Ongeza ratiba ya chanjo" : "Add vaccination schedule"}>
          <ActionForm action={createAnimalVaccinationScheduleAction} submitLabel={sw ? "Hifadhi ratiba" : "Save schedule"} className="form-grid">
            <FormField label={sw ? "Jina la ratiba" : "Schedule title"} name="title" required />
            <FormSelect label={sw ? "Chanjo" : "Vaccine"} name="productId" options={data.animalHealthProducts.filter((product) => product.type === "VACCINE").map((product) => ({ value: product.id, label: product.name }))} />
            <FormField label={sw ? "Aina ya mnyama" : "Species"} name="species" required />
            <FormField label={sw ? "Aina ndogo (si lazima)" : "Breed (optional)"} name="breed" required={false} />
            <FormSelect label={sw ? "Kikundi maalum (si lazima)" : "Specific group (optional)"} name="animalGroupId" required={false} options={groupOptions} />
            <FormField label={sw ? "Umri wa dozi ya kwanza (siku)" : "Age for first dose (days)"} name="ageDays" type="number" min="0" step="1" required={false} />
            <FormField label={sw ? "Tarehe ya kwanza ya dozi" : "First dose due date"} name="firstDueAt" type="date" required={false} />
            <FormField label={sw ? "Rudia kila siku ngapi (hiari)" : "Repeat every (days, optional)"} name="repeatEveryDays" type="number" min="1" step="1" required={false} />
            <FormTextArea label={sw ? "Maelezo yaliyothibitishwa" : "Verified notes"} name="notes" />
            <p className="field-help field-wide">{sw ? "Weka umri au tarehe ya kwanza; kwa kikundi maalum tumia tarehe. Hakuna ratiba ya chanjo iliyotolewa kama ukweli." : "Enter an age or first due date; a specific group requires a date. No vaccine schedules are supplied as facts."}</p>
          </ActionForm>
          </AddDisclosure>
        )}
        {scheduleReminders.length > 0 ? (
          <div className="table-scroll"><table><thead><tr>
            <th>{sw ? "Ratiba" : "Schedule"}</th><th>{sw ? "Mnyama/kikundi" : "Animal/group"}</th>
            <th>{sw ? "Chanjo" : "Vaccine"}</th><th>{sw ? "Tarehe inayofuata" : "Next due"}</th><th>{sw ? "Hali" : "Status"}</th>
          </tr></thead><tbody>{scheduleReminders.map((reminder) => (
            <tr key={reminder.id}>
              <td>{reminder.title}</td><td>{reminder.targetName}</td><td>{reminder.productName}</td>
              <td>{date(reminder.dueAt)}</td>
              <td><span className={`status-pill ${reminder.overdue ? "status-warning" : ""}`}>
                {reminder.needsBirthDate
                  ? (sw ? "Inahitaji tarehe ya kuzaliwa" : "Birth date needed")
                  : reminder.complete
                    ? (sw ? "Imekamilika" : "Complete")
                    : reminder.overdue
                      ? (sw ? "Imechelewa" : "Overdue")
                      : (sw ? "Inakuja" : "Upcoming")}
              </span></td>
            </tr>
          ))}</tbody></table></div>
        ) : <p className="field-help">{sw ? "Hakuna vikumbusho vinavyolingana na wanyama waliosajiliwa." : "No reminders match the registered animals yet."}</p>}
        {data.animalVaccinationSchedules.length > 0 && (
          <ul className="record-list">
            {data.animalVaccinationSchedules.map((schedule) => (
              <li key={schedule.id}><strong>{schedule.title}</strong> · {schedule.species}{schedule.breed ? ` · ${schedule.breed}` : ""} · {schedule.ageDays === null ? date(schedule.firstDueAt) : `${schedule.ageDays} ${sw ? "siku" : "days"}`} {schedule.repeatEveryDays ? ` · ${sw ? "kila" : "every"} ${schedule.repeatEveryDays} ${sw ? "siku" : "days"}` : ""}</li>
            ))}
          </ul>
        )}
      </section>}

      {activeSection === "health" && <section className="panel">
        <div className="panel-header">
          <div>
            <h3>{sw ? "Kesi za afya na matibabu" : "Health cases and treatments"}</h3>
            <p>{sw ? "Rekodi dalili na matokeo; kwa uchunguzi na matibabu, wasiliana na mtaalamu wa mifugo." : "Record symptoms and outcomes; consult a livestock professional for diagnosis and treatment."}</p>
          </div>
        </div>
        <AddDisclosure title={sw ? "Rekodi kesi ya afya" : "Record a health case"}>
        <ActionForm
          action={recordAnimalHealthCaseAction}
          submitLabel={sw ? "Rekodi kesi" : "Record health case"}
          className="form-grid"
          offlineActionKey="animal-health-case"
          workspaceId={data.farm.id}
          locale={locale}
        >
          <FormSelect label={sw ? "Kikundi" : "Group"} name="animalGroupId" required={false} options={groupOptions} />
          <FormSelect label={sw ? "Mnyama binafsi" : "Individual animal"} name="animalId" required={false} options={animalOptions} />
          <FormField label={sw ? "Dalili zilizoonekana" : "Observed symptoms"} name="symptoms" required />
          <FormField label={sw ? "Uchunguzi ulioandikwa na mtaalamu (si lazima)" : "Diagnosis from professional (optional)"} name="diagnosis" required={false} />
          <FormField label={sw ? "Aliyefanya uchunguzi" : "Diagnosed by"} name="diagnosedBy" required={false} />
          <FormField label={sw ? "Matokeo" : "Outcome"} name="outcome" required={false} />
          <FormField label={sw ? "Tarehe" : "Date"} name="openedAt" type="date" />
        </ActionForm>
        </AddDisclosure>
        <AddDisclosure title={sw ? "Rekodi tiba au chanjo" : "Record treatment or vaccination"}>
        <ActionForm
          action={recordAnimalHealthAction}
          submitLabel={sw ? "Hifadhi tiba/chanjo" : "Save treatment/vaccination"}
          className="form-grid"
          offlineActionKey="animal-health-record"
          workspaceId={data.farm.id}
          locale={locale}
        >
          <FormSelect label={sw ? "Kikundi" : "Group"} name="animalGroupId" required={false} options={groupOptions} />
          <FormSelect label={sw ? "Mnyama binafsi" : "Individual animal"} name="animalId" required={false} options={animalOptions} />
          <FormSelect label={sw ? "Shughuli ya afya" : "Health activity"} name="type" options={healthRecordTypes.map((type) => ({ value: type, label: healthTypeLabel(type) }))} />
          <FormSelect label={sw ? "Kesi wazi (si lazima)" : "Open case (optional)"} name="healthCaseId" required={false} options={data.animalHealthCases.filter((healthCase) => !healthCase.resolvedAt).map((healthCase) => ({ value: healthCase.id, label: `${healthCase.animalGroupName ?? healthCase.animalTag} · ${healthCase.symptoms}` }))} />
          <FormSelect label={sw ? "Chanjo/dawa (si lazima)" : "Vaccine/medicine (optional)"} name="productId" required={false} options={data.animalHealthProducts.map((product) => ({ value: product.id, label: `${product.name} · ${product.withdrawalDays} ${sw ? "siku kusubiri" : "day withdrawal"}` }))} />
          <FormSelect label={sw ? "Ratiba (si lazima)" : "Schedule (optional)"} name="scheduleId" required={false} options={data.animalVaccinationSchedules.map((schedule) => ({ value: schedule.id, label: schedule.title }))} />
          <FormField label={sw ? "Tarehe ya matumizi" : "Administration date"} name="administeredAt" type="date" />
          <FormField label={sw ? "Kiasi cha akiba kilichotumika (ikiwa kimeunganishwa)" : "Stock quantity used (if linked)"} name="quantityUsed" type="number" min="0.0001" step="any" required={false} />
          {isOwner && <FormField label={`${sw ? "Gharama" : "Cost"} (${data.farm.currency}, optional)`} name="cost" type="number" min="0" step="any" required={false} />}
          <FormTextArea label={sw ? "Maelezo" : "Notes"} name="notes" />
          <p className="field-help field-wide">{sw ? "Bidhaa iliyounganishwa na akiba inahitaji kiasi kilichotumika; kiasi hicho hupunguzwa na gharama huhesabiwa kutokana na manunuzi yaliyorekodiwa." : "A product linked to stock requires the amount used; that amount is deducted and cost is calculated from recorded stock purchases."}</p>
        </ActionForm>
        </AddDisclosure>
        {activeWithdrawalRecords.length > 0 && (
          <div className="alert-card status-warning" role="status">
            <strong>{sw ? "Vipindi vya kusubiri vinavyoendelea" : "Active withdrawal periods"}</strong>
            <ul>{activeWithdrawalRecords.map((record) => (
              <li key={record.id}>
                {record.animalGroupName ?? record.animalTag ?? "—"} · {record.productName ?? healthTypeLabel(record.type)} · {sw ? "hadi" : "until"} {date(record.withdrawalUntil)}
              </li>
            ))}</ul>
          </div>
        )}
        {restrictedCollections.length > 0 && (
          <div className="alert-card status-warning" role="alert">
            <strong>{sw ? "Rekodi za maziwa/mayai ndani ya muda wa kusubiri" : "Milk/egg records inside a withdrawal period"}</strong>
            <ul>{restrictedCollections.map((record) => (
              <li key={record.id}>{record.animalGroupName ?? record.animalTag ?? "—"} · {dailyLabel(record.type, locale)} · {date(record.recordedAt)}</li>
            ))}</ul>
          </div>
        )}
        {data.animalHealthCases.length > 0 ? (
          <div className="table-scroll"><table><thead><tr>
            <th>{sw ? "Tarehe" : "Date"}</th><th>{sw ? "Mnyama/kikundi" : "Animal/group"}</th>
            <th>{sw ? "Dalili" : "Symptoms"}</th><th>{sw ? "Uchunguzi/matokeo" : "Diagnosis / outcome"}</th>
            <th>{sw ? "Hali" : "Status"}</th><th>{sw ? "Kitendo" : "Action"}</th>
          </tr></thead><tbody>{data.animalHealthCases.map((healthCase) => (
            <tr key={healthCase.id}>
              <td>{date(healthCase.openedAt)}</td><td>{healthCase.animalGroupName ?? healthCase.animalTag ?? "—"}</td>
              <td>{healthCase.symptoms}</td><td>{[healthCase.diagnosis, healthCase.diagnosedBy, healthCase.outcome].filter(Boolean).join(" · ") || "—"}</td>
              <td>{healthCase.resolvedAt ? (sw ? "Imetatuliwa" : "Resolved") : (sw ? "Wazi" : "Open")}</td>
              <td>{!healthCase.resolvedAt && <ActionForm action={resolveAnimalHealthCaseAction} submitLabel={sw ? "Tatua kesi" : "Resolve case"} className="animal-row-action"><input name="id" type="hidden" value={healthCase.id} /></ActionForm>}</td>
            </tr>
          ))}</tbody></table></div>
        ) : <p className="field-help">{sw ? "Bado hakuna kesi za afya." : "No health cases recorded yet."}</p>}
        {data.animalHealthRecords.length > 0 && (
          <div className="table-scroll"><table><thead><tr>
            <th>{sw ? "Tarehe" : "Date"}</th><th>{sw ? "Mnyama/kikundi" : "Animal/group"}</th>
            <th>{sw ? "Shughuli" : "Activity"}</th><th>{sw ? "Bidhaa/dozi/njia" : "Product / dose / route"}</th>
            <th>{sw ? "Kundi/muda wa kusubiri" : "Batch / withdrawal"}</th>{isOwner && <th>{sw ? "Gharama" : "Cost"}</th>}
          </tr></thead><tbody>{data.animalHealthRecords.map((record) => (
            <tr key={record.id}>
              <td>{date(record.administeredAt)}</td><td>{record.animalGroupName ?? record.animalTag ?? "—"}</td>
              <td>{healthTypeLabel(record.type)}{record.scheduleTitle ? ` · ${record.scheduleTitle}` : ""}</td>
              <td>{[record.productName, record.dose, record.route].filter(Boolean).join(" · ") || "—"}</td>
              <td>{[record.batch, record.withdrawalUntil ? date(record.withdrawalUntil) : null].filter(Boolean).join(" · ") || "—"}</td>
              {isOwner && <td>{record.cost === null ? "—" : `${number(record.cost)} ${data.farm.currency}`}</td>}
            </tr>
          ))}</tbody></table></div>
        )}
      </section>}

      {activeSection === "daily" && <section className="panel">
        <div className="panel-header">
          <div>
            <h3>{sw ? "Vipimo vya uzalishaji na ukuaji" : "Performance records"}</h3>
            <p>{sw ? "Rekodi uzito, maziwa na mayai; matukio ya kuzaliwa/kuachisha hunyonya yako kwenye matukio ya mifugo." : "Record weight, milk and eggs; births and weaning are recorded in animal events."}</p>
          </div>
        </div>
        <AddDisclosure title={sw ? "Rekodi kipimo cha uzalishaji/ukuaji" : "Record production or growth"}>
        <ActionForm
          action={recordAnimalPerformanceAction}
          submitLabel={sw ? "Hifadhi kipimo" : "Save measurement"}
          className="form-grid"
          offlineActionKey="animal-performance-record"
          workspaceId={data.farm.id}
          locale={locale}
        >
          <FormSelect label={sw ? "Kikundi" : "Group"} name="animalGroupId" required={false} options={groupOptions} />
          <FormSelect label={sw ? "Mnyama binafsi" : "Individual animal"} name="animalId" required={false} options={animalOptions} />
          <FormSelect label={sw ? "Kipimo" : "Measure"} name="type" options={performanceTypes.map((type) => ({ value: type, label: healthTypeLabel(type) }))} />
          <FormField label={sw ? "Kiasi" : "Quantity"} name="quantity" type="number" min="0.0001" step="any" required />
          <FormField label={sw ? "Kipimo (weka kilichotumika shambani)" : "Unit (enter the farm's unit)"} name="unit" placeholder={sw ? "mf. kg, lita, tray" : "e.g. kg, litre, tray"} required />
          <FormSelect label={sw ? "Chakula kilichotumika (hiari)" : "Feed used (optional)"} name="feedItemId" required={false} options={feedItems.map((item) => ({ value: item.id, label: item.name }))} />
          <FormField label={sw ? "Tarehe" : "Date"} name="recordedAt" type="date" />
          <FormTextArea label={sw ? "Maelezo" : "Notes"} name="notes" />
        </ActionForm>
        </AddDisclosure>
        {data.animalPerformanceRecords.length > 0 ? (
          <>
            <p className="field-help">
              {sw ? "Wastani wa ongezeko la uzito kwa siku kwa vipimo binafsi vinavyotumia kipimo kimoja:" : "Average daily weight gain for individual records in one consistent unit:"}{" "}
              {(() => {
                const gain = calculateAverageDailyWeightGain(data.animalPerformanceRecords);
                return gain === null ? (sw ? "Bado haitoshi kuhesabu" : "Not enough comparable readings") : `${number(gain)} ${data.animalPerformanceRecords.find((record) => record.type === "WEIGHT" && record.animalId)?.unit ?? ""}/${sw ? "siku" : "day"}`;
              })()}
            </p>
            <div className="table-scroll"><table><thead><tr>
              <th>{sw ? "Tarehe" : "Date"}</th><th>{sw ? "Mnyama/kikundi" : "Animal/group"}</th>
              <th>{sw ? "Kipimo" : "Measure"}</th><th>{sw ? "Kiasi" : "Quantity"}</th><th>{sw ? "Maelezo" : "Notes"}</th>
            </tr></thead><tbody>{data.animalPerformanceRecords.map((record) => (
              <tr key={record.id}>
                <td>{date(record.recordedAt)}</td><td>{record.animalName ? `${record.animalName} · ` : ""}{record.animalGroupName ?? record.animalTag ?? "—"}</td>
                <td>{healthTypeLabel(record.type)}</td><td>{number(record.quantity)} {record.unit}</td><td>{record.notes ?? "—"}</td>
              </tr>
            ))}</tbody></table></div>
          </>
        ) : <p className="field-help">{sw ? "Bado hakuna vipimo vya uzalishaji." : "No performance measurements recorded yet."}</p>}
      </section>}
    </div>
  );
}
