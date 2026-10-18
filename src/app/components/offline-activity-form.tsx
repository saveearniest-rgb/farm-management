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
  const t = (key: string) => translate(locale, key);

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
        setMessage(result.message || "Some field entries need attention before they can sync.");
        return;
      }
      await removePendingLog(log.id);
    }
    const remaining = await listPendingLogs();
    setPendingLogs(remaining);
    if (rows.length > 0) setMessage("Saved field entries synced.");
  }, []);

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
        if (active) setMessage("Offline storage is not available in this browser.");
      });
    } else {
      void listPendingLogs().then((rows) => {
        if (!active) return;
        setPendingLogs(rows);
        if (navigator.onLine) {
          void syncRows(rows).catch((error: unknown) => {
            setMessage(error instanceof Error ? error.message : "Could not sync field entries.");
          });
        }
      }).catch((error: unknown) => {
        setMessage(error instanceof Error ? error.message : "Could not open offline storage.");
      });
    }
    const handleOnline = () => {
      void syncPending().catch((error: unknown) => {
        setMessage(error instanceof Error ? error.message : "Could not sync field entries.");
      });
    };
    window.addEventListener("online", handleOnline);
    return () => {
      active = false;
      window.removeEventListener("online", handleOnline);
    };
  }, [syncPending, syncRows]);

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
      setMessage("Write a short field note before saving.");
      return;
    }

    setBusy(true);
    try {
      await savePendingLog(log);
      setPendingLogs(await listPendingLogs());
      form.reset();
      if (!navigator.onLine) {
        setMessage("Saved on this device. It will sync when you are back online.");
      } else {
        await syncPending();
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save the field entry.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <form className="record-form" onSubmit={submit}>
        <FormField label="Date" name="loggedAt" type="date" />
        <FormSelect
          label="Crop cycle"
          name="cycleId"
          required={false}
          options={cycles.map((cycle) => ({
            value: cycle.id,
            label: `${cycle.cropName} · ${cycle.plotName}`,
          }))}
        />
        <FormField label="Weather notes" name="weather" placeholder="Optional; recorded observation only" />
        <FormField label="Who worked?" name="whoWorked" placeholder="Names or crew" />
        <label className="field field-wide">
          <span>Field note</span>
          <textarea name="body" placeholder="What happened in the field today?" rows={4} required />
        </label>
        <div className="form-footer">
          <button className="button button-primary" type="submit" disabled={busy}>
            {busy ? "Saving..." : t("save")}
          </button>
          <p aria-live="polite" className="form-message" role="status">{message}</p>
        </div>
      </form>
      {pendingLogs.length > 0 && (
        <div className="sync-status">
          <span className="sync-indicator" />
          {pendingLogs.length} {pendingLogs.length === 1 ? "entry is" : "entries are"} saved on this device and waiting to sync.
        </div>
      )}
    </div>
  );
}
