"use client";

import { useMemo, useState } from "react";
import {
  archiveAnimalAction,
  archiveAnimalGroupAction,
  createAnimalAction,
  createAnimalGroupAction,
  createAnimalHealthProductAction,
  createAnimalVaccinationScheduleAction,
  recordAnimalHealthAction,
  recordAnimalHealthCaseAction,
  recordAnimalDailyAction,
  recordAnimalEventAction,
  recordAnimalPerformanceAction,
  resolveAnimalHealthCaseAction,
  saveFeedRationAction,
} from "@/app/actions/operations";
import {
  calculateCurrentAnimalCount,
  calculateFeedPlan,
} from "@/lib/animal-management";
import {
  calculateAverageDailyWeightGain,
  isWithinWithdrawalPeriod,
} from "@/lib/animal-health";
import type { DashboardData } from "@/lib/dashboard-data";
import type { Locale } from "@/lib/i18n";
import { ActionForm, FormField, FormSelect, FormTextArea } from "./action-form";

const eventTypes = [
  "BIRTH",
  "PURCHASE",
  "WEANING",
  "MOVE",
  "SALE",
  "DEATH",
  "CULLED",
  "OTHER",
];
const dailyTypes = ["FEEDING", "WATER", "MILK", "EGGS", "HEALTH_CHECK", "OTHER"];
const healthRecordTypes = ["VACCINATION", "TREATMENT", "DEWORMING", "DIPPING", "TICK_CONTROL", "VET_VISIT"];
const performanceTypes = ["WEIGHT", "MILK", "EGGS"];

function eventLabel(type: string, locale: Locale) {
  const sw: Record<string, string> = {
    BIRTH: "Kuzaliwa",
    PURCHASE: "Ununuzi",
    WEANING: "Kuachisha kunyonya",
    MOVE: "Kuhamisha",
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

export function AnimalSection({
  data,
  locale,
  isOwner,
}: {
  data: DashboardData;
  locale: Locale;
  isOwner: boolean;
}) {
  const sw = locale === "sw";
  const [planningDays, setPlanningDays] = useState(7);
  const feedItems = data.stockItems.filter((item) => item.category === "FEED");
  const groupOptions = data.animalGroups.map((group) => ({
    value: group.id,
    label: `${group.name} · ${group.species} · ${group.trackingMode === "INDIVIDUAL" ? (sw ? "binafsi" : "individual") : (sw ? "idadi" : "head count")}`,
  }));
  const headCountGroupOptions = groupOptions.filter((option) =>
    data.animalGroups.find((group) => group.id === option.value)?.trackingMode === "HEAD_COUNT",
  );
  const animalOptions = data.animals.map((animal) => ({
    value: animal.id,
    label: `${animal.tagNumber} · ${animal.species}`,
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
  const feedPlans = groupsWithCounts.flatMap((group) =>
    group.feedRations.map((ration) => {
      const item = feedItems.find((stockItem) => stockItem.id === ration.itemId);
      if (!item) return null;
      return {
        group,
        ration,
        ...calculateFeedPlan({
          groupCount: group.currentCount,
          quantityPerHead: ration.quantityPerHead,
          days: planningDays,
          stock: item.balance,
        }),
      };
    }).filter((plan) => plan !== null),
  );
  const eventRows = [
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
  ].sort((a, b) => new Date(b.occurredAt ?? 0).getTime() - new Date(a.occurredAt ?? 0).getTime());
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
  const scheduleReminders = data.animalVaccinationSchedules.flatMap((schedule) => {
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
  });
  const healthTypeLabel = (type: string) => type.toLowerCase().replaceAll("_", " ");

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

      <section className="panel">
        <div className="panel-header">
          <div>
            <h3>{sw ? "Vikundi na makundi" : "Groups and batches"}</h3>
            <p>{sw ? "Idadi ya sasa huhesabiwa kutokana na matukio." : "Current counts are calculated from recorded events."}</p>
          </div>
        </div>
        {isOwner && (
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
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h3>{sw ? "Wanyama wenye alama" : "Tagged animals"}</h3>
            <p>{sw ? "Tumia namba ya utambulisho iliyopo shambani." : "Use the identification tags already used on the farm."}</p>
          </div>
        </div>
        {isOwner && (
          <ActionForm action={createAnimalAction} submitLabel={sw ? "Sajili mnyama" : "Register animal"} className="form-grid">
            <FormField label={sw ? "Namba ya alama" : "Tag number"} name="tagNumber" required />
            <FormField label={sw ? "Aina ya mnyama" : "Species"} name="species" required />
            <FormField label={sw ? "Aina ya uzalishaji" : "Breed"} name="breed" required={false} />
            <FormField label={sw ? "Jinsia" : "Sex"} name="sex" required={false} />
            <FormField label={sw ? "Tarehe ya kuzaliwa" : "Birth date"} name="birthDate" type="date" />
            <FormField label={sw ? "Chanzo (aliyezaliwa/aliyenunuliwa)" : "Source (born/bought)"} name="source" required={false} />
            {isOwner && <FormField label={sw ? `Bei ya ununuzi (${data.farm.currency}, ikiwa inanunuliwa)` : `Purchase price (${data.farm.currency}, if bought)`} name="purchasePrice" type="number" min="0" step="0.01" required={false} />}
            <FormField label={sw ? "Muuzaji" : "Seller"} name="seller" required={false} />
            <FormSelect label={sw ? "Kikundi cha ufuatiliaji binafsi" : "Individual-tracking group"} name="groupId" options={groupOptions.filter((option) => data.animalGroups.find((group) => group.id === option.value)?.trackingMode === "INDIVIDUAL")} />
          </ActionForm>
        )}
        {data.animals.length > 0 ? (
          <div className="table-scroll">
            <table>
              <thead><tr>
                <th>{sw ? "Alama" : "Tag"}</th>
                <th>{sw ? "Aina" : "Species"}</th>
                <th>{sw ? "Kikundi" : "Group"}</th>
                <th>{sw ? "Jinsia" : "Sex"}</th>
                {isOwner && <th>{sw ? "Bei ya ununuzi" : "Purchase price"}</th>}
                {isOwner && <th>{sw ? "Muuzaji" : "Seller"}</th>}
                <th>{sw ? "Hali" : "Status"}</th>
                {isOwner && <th>{sw ? "Kitendo" : "Action"}</th>}
              </tr></thead>
              <tbody>{data.animals.map((animal) => (
                <tr key={animal.id}>
                  <td>{animal.tagNumber}</td>
                  <td>{animal.species}</td>
                  <td>{animal.groupName ?? "—"}</td>
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
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h3>{sw ? "Matukio ya mifugo" : "Animal events"}</h3>
            <p>{sw ? "Mizani ya vikundi hubadilishwa na kuzaliwa, ununuzi, mauzo, vifo au kuondoa kundini." : "Group counts change with births, purchases, sales, deaths and culls."}</p>
          </div>
        </div>
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
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h3>{sw ? "Mpango wa chakula na akiba" : "Feed plan and stock"}</h3>
            <p>{sw ? "Hesabu hutumia mgao ulioingizwa na mkulima; si pendekezo la lishe." : "Calculations use the farm-entered ration; they are not a nutrition recommendation."}</p>
          </div>
        </div>
        {isOwner && (
          <ActionForm action={saveFeedRationAction} submitLabel={sw ? "Hifadhi mgao" : "Save ration"} className="form-grid">
            <FormSelect label={sw ? "Kikundi" : "Group"} name="animalGroupId" options={groupOptions} />
            <FormSelect
              label={sw ? "Bidhaa ya chakula (aina FEED)" : "Feed item (category FEED)"}
              name="itemId"
              options={feedItems.map((item) => ({ value: item.id, label: `${item.name} (${item.unit})` }))}
            />
            <FormField label={sw ? "Kiasi kwa mnyama kwa siku (kwa kipimo cha bidhaa)" : "Quantity per head per day (item unit)"} name="quantityPerHead" type="number" min="0.0001" step="any" required />
          </ActionForm>
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
                <th>{sw ? "Mahitaji ya mpango" : "Planned need"}</th>
                <th>{sw ? "Akiba" : "Stock"}</th>
                <th>{sw ? "Upungufu" : "Shortfall"}</th>
                <th>{sw ? "Siku zilizobaki kwa mgao huu" : "Days left at this ration"}</th>
              </tr></thead>
              <tbody>{feedPlans.map((plan) => (
                <tr key={plan.ration.id}>
                  <td>{plan.group.name} · {plan.ration.itemName}</td>
                  <td>{number(plan.plannedQuantity)} {plan.ration.unit}</td>
                  <td>{number(plan.stock)} {plan.ration.unit}</td>
                  <td>{number(plan.shortfall)} {plan.ration.unit}</td>
                  <td>{plan.daysRemaining === null ? "—" : number(plan.daysRemaining)}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        ) : <p className="field-help">{sw ? "Ongeza bidhaa ya chakula ya aina FEED na mgao wa kikundi ili kuona mpango." : "Add a FEED stock item and a group ration to see the plan."}</p>}
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h3>{sw ? "Kirekodi cha kila siku" : "Daily tracker"}</h3>
            <p>{sw ? "Rekodi chakula kilichotolewa, maji, mazao yaliyokusanywa au ukaguzi wa kumbukumbu. Ingizo la chakula hupunguza akiba." : "Record feed given, water, collected products or a health-check note. Feed entries deduct stock."}</p>
          </div>
        </div>
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
                    <td>{record.animalGroupName ?? record.animalTag ?? "—"}</td>
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
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h3>{sw ? "Afya, chanjo na dawa" : "Health, vaccination and medicine"}</h3>
            <p>{sw ? "Ratiba hujazwa na shamba au daktari wa mifugo; mfumo hautambui magonjwa wala kutoa ushauri. Akiba ya dawa inaweza kuunganishwa kwenye bidhaa." : "Schedules are entered by the farm or its vet; Shamba does not diagnose or prescribe. Medicine stock can be linked to a product."}</p>
          </div>
        </div>
        {isOwner && (
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
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h3>{sw ? "Ratiba za chanjo na zinazokaribia" : "Vaccination schedules and reminders"}</h3>
            <p>{sw ? "Tarehe zinatokana na ratiba za shamba pekee; tarehe ya kuzaliwa inahitajika kwa ratiba za umri." : "Dates use only farm-entered schedules; age-based schedules need an animal birth date."}</p>
          </div>
        </div>
        {isOwner && (
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
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h3>{sw ? "Kesi za afya na matibabu" : "Health cases and treatments"}</h3>
            <p>{sw ? "Rekodi dalili na matokeo; kwa uchunguzi na matibabu, wasiliana na mtaalamu wa mifugo." : "Record symptoms and outcomes; consult a livestock professional for diagnosis and treatment."}</p>
          </div>
        </div>
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
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h3>{sw ? "Vipimo vya uzalishaji na ukuaji" : "Performance records"}</h3>
            <p>{sw ? "Rekodi uzito, maziwa na mayai; matukio ya kuzaliwa/kuachisha hunyonya yako kwenye matukio ya mifugo." : "Record weight, milk and eggs; births and weaning are recorded in animal events."}</p>
          </div>
        </div>
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
          <FormField label={sw ? "Tarehe" : "Date"} name="recordedAt" type="date" />
          <FormTextArea label={sw ? "Maelezo" : "Notes"} name="notes" />
        </ActionForm>
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
                <td>{date(record.recordedAt)}</td><td>{record.animalGroupName ?? record.animalTag ?? "—"}</td>
                <td>{healthTypeLabel(record.type)}</td><td>{number(record.quantity)} {record.unit}</td><td>{record.notes ?? "—"}</td>
              </tr>
            ))}</tbody></table></div>
          </>
        ) : <p className="field-help">{sw ? "Bado hakuna vipimo vya uzalishaji." : "No performance measurements recorded yet."}</p>}
      </section>
    </div>
  );
}
