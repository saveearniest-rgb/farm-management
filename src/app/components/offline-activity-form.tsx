"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { createActivityLogAction } from "@/app/actions/operations";
import {
  listPendingLogs,
  removePendingLog,
  savePendingLog,
  type PendingLog,
} from "@/lib/offline-logs";
import type { Locale } from "@/lib/i18n";
import { translate } from "@/lib/i18n";
import { FormField, FormSelect } from "./action-form";

export function OfflineActivityForm({
  cycles,
  locale,
}: {
  cycles: Array<{ id: string; cropName: string; plotName: string }>;
  locale: Locale;
}) {
  const [pendingLogs, setPendingLogs] = useState<PendingLog[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const t = useCallback((key: string) => translate(locale, key), [locale]);

  const syncRows = useCallback(async (rows: PendingLog[]) => {
    if (!navigator.onLine) return;
    for (const log of rows) {
      const formData = new FormData();
      formData.set("body", log.body);
      formData.set("weather", log.weather);
      formData.set("whoWorked", log.whoWorked);
      formData.set("cycleId", log.cycleId);
      formData.set("loggedAt", log.loggedAt.slice(0, 10));
      const result = await createActivityLogAction({ message: "" }, formData);
      if (!result.success) {
        setMessage(result.message || t("offlineSyncNeedsAttention"));
        return;
      }
      await removePendingLog(log.id);
    }
    const remaining = await listPendingLogs();
    setPendingLogs(remaining);
    if (rows.length > 0) setMessage(t("offlineSyncSaved"));
  }, [t]);

  const syncPending = useCallback(async () => {
    if (!navigator.onLine) return;
    const rows = await listPendingLogs();
    setPendingLogs(rows);
    await syncRows(rows);
  }, [syncRows]);

  useEffect(() => {
    let active = true;
    if (!("indexedDB" in window)) {
      queueMicrotask(() => {
        if (active) setMessage(t("offlineStorageUnavailable"));
      });
    } else {
      void listPendingLogs().then((rows) => {
        if (!active) return;
        setPendingLogs(rows);
        if (navigator.onLine) {
          void syncRows(rows).catch((error: unknown) => {
            setMessage(error instanceof Error ? error.message : t("offlineSyncFailed"));
          });
        }
      }).catch((error: unknown) => {
        setMessage(error instanceof Error ? error.message : t("offlineStorageOpenFailed"));
      });
    }
    const handleOnline = () => {
      void syncPending().catch((error: unknown) => {
        setMessage(error instanceof Error ? error.message : t("offlineSyncFailed"));
      });
    };
    window.addEventListener("online", handleOnline);
    return () => {
      active = false;
      window.removeEventListener("online", handleOnline);
    };
  }, [syncPending, syncRows, t]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const log: PendingLog = {
      id: crypto.randomUUID(),
      body: String(data.get("body") ?? "").trim(),
      weather: String(data.get("weather") ?? "").trim(),
      whoWorked: String(data.get("whoWorked") ?? "").trim(),
      cycleId: String(data.get("cycleId") ?? ""),
      loggedAt: String(data.get("loggedAt") ?? ""),
    };
    if (!log.body) {
      setMessage(t("offlineNoteRequired"));
      return;
    }

    setBusy(true);
    try {
      await savePendingLog(log);
      setPendingLogs(await listPendingLogs());
      form.reset();
      if (!navigator.onLine) {
        setMessage(t("offlineEntrySaved"));
      } else {
        await syncPending();
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t("offlineEntrySaveFailed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <form className="record-form" onSubmit={submit}>
        <FormField label={t("offlineDate")} name="loggedAt" type="date" />
        <FormSelect
          label={t("offlineCropCycle")}
          name="cycleId"
          required={false}
          options={cycles.map((cycle) => ({
            value: cycle.id,
            label: `${cycle.cropName} · ${cycle.plotName}`,
          }))}
        />
        <FormField label={t("offlineWeather")} name="weather" placeholder={t("offlineWeatherPlaceholder")} />
        <FormField label={t("offlineWhoWorked")} name="whoWorked" placeholder={t("offlineNamesPlaceholder")} />
        <label className="field field-wide">
          <span>{t("offlineFieldNote")}</span>
          <textarea name="body" placeholder={t("offlineNotePlaceholder")} rows={4} required />
        </label>
        <div className="form-footer">
          <button className="button button-primary" type="submit" disabled={busy}>
            {busy ? t("offlineSaving") : t("save")}
          </button>
          <p aria-live="polite" className="form-message" role="status">{message}</p>
        </div>
      </form>
      {pendingLogs.length > 0 && (
        <div className="sync-status">
          <span className="sync-indicator" />
          {pendingLogs.length} {t(pendingLogs.length === 1 ? "offlinePendingOne" : "offlinePendingMany")}
        </div>
      )}
    </div>
  );
}
