"use client";

import { useMemo, useState } from "react";
import {
  archiveAnimalAction,
  archiveAnimalGroupAction,
  createAnimalAction,
  createAnimalGroupAction,
  recordAnimalDailyAction,
  recordAnimalEventAction,
  saveFeedRationAction,
} from "@/app/actions/operations";
import {
  calculateCurrentAnimalCount,
  calculateFeedPlan,
} from "@/lib/animal-management";
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
                <th>{sw ? "Maelezo" : "Notes"}</th>
              </tr></thead>
              <tbody>{data.animalDailyRecords.map((record) => (
                <tr key={record.id}>
                  <td>{date(record.recordedAt)}</td>
                  <td>{record.animalGroupName ?? record.animalTag ?? "—"}</td>
                  <td>{dailyLabel(record.type, locale)}{record.feedItemName ? ` · ${record.feedItemName}` : ""}</td>
                  <td>{record.quantity === null ? "—" : `${number(record.quantity)} ${record.unit ?? ""}`}</td>
                  <td>{record.notes ?? "—"}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        ) : <p className="field-help">{sw ? "Bado hakuna kumbukumbu za kila siku." : "No daily animal records yet."}</p>}
      </section>
    </div>
  );
}
