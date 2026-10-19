"use client";

import { useActionState, useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import type { FormAction, FormState } from "@/lib/form-state";
import { listPendingActions, savePendingAction, type OfflineActionKey } from "@/lib/offline-queue";
import { syncPendingActions } from "./offline-action-sync";

const emptyState: FormState = { message: "" };

export function ActionForm({
  action,
  submitLabel,
  children,
  className = "",
  offlineActionKey,
  workspaceId,
  locale = "en",
}: {
  action: FormAction;
  submitLabel: string;
  children: ReactNode;
  className?: string;
  offlineActionKey?: OfflineActionKey;
  workspaceId?: string;
  locale?: "en" | "sw";
}) {
  const [state, formAction, pending] = useActionState(action, emptyState);
  const offlineId = useRef("");
  const [pendingCount, setPendingCount] = useState(0);
  const [offlineMessage, setOfflineMessage] = useState("");
  const t = locale === "sw";

  const syncPending = useCallback(async () => {
    if (!offlineActionKey || !workspaceId || !navigator.onLine) return;
    const result = await syncPendingActions(workspaceId);
    setPendingCount(result.count);
    setOfflineMessage(result.error || (result.synced ? (t ? "Rekodi za nje ya mtandao zimesawazishwa." : "Offline entries synced.") : ""));
  }, [offlineActionKey, workspaceId, t]);

  useEffect(() => {
    if (!offlineActionKey) return;
    let active = true;
    void listPendingActions().then((rows) => {
      if (!active) return;
      setPendingCount(rows.filter((row) => row.farmId === workspaceId).length);
      if (navigator.onLine) void syncPending().catch((error: unknown) => {
        setOfflineMessage(error instanceof Error ? error.message : (t ? "Usawazishaji umeshindwa." : "Sync failed."));
      });
    }).catch((error: unknown) => {
      setOfflineMessage(error instanceof Error ? error.message : (t ? "Hifadhi ya nje ya mtandao haipatikani." : "Offline storage is unavailable."));
    });
    const handleOnline = () => {
      void syncPending().catch((error: unknown) => {
        setOfflineMessage(error instanceof Error ? error.message : (t ? "Usawazishaji umeshindwa." : "Sync failed."));
      });
    };
    window.addEventListener("online", handleOnline);
    return () => {
      active = false;
      window.removeEventListener("online", handleOnline);
    };
  }, [offlineActionKey, workspaceId, syncPending, t]);

  useEffect(() => {
    if (state.success) offlineId.current = "";
  }, [state.success]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    if (!offlineActionKey) return;
    const form = event.currentTarget;
    const id = state.success || !offlineId.current ? crypto.randomUUID() : offlineId.current;
    offlineId.current = id;
    const idInput = form.elements.namedItem("offlineId");
    if (idInput instanceof HTMLInputElement) idInput.value = id;
    if (navigator.onLine) return;

    event.preventDefault();
    const values: Record<string, string> = {};
    for (const [key, value] of new FormData(form).entries()) {
      if (typeof value !== "string") {
        setOfflineMessage(t ? "Faili zinahitaji muunganisho wa intaneti." : "File uploads require an internet connection.");
        return;
      }
      values[key] = value;
    }
    try {
      const farmId = workspaceId ?? form.closest<HTMLElement>("[data-farm-id]")?.dataset.farmId;
      if (!farmId) throw new Error("Farm workspace is unavailable; offline action was not saved.");
      await savePendingAction({ id, farmId, actionKey: offlineActionKey, fields: values, queuedAt: new Date().toISOString() });
      setPendingCount((count) => count + 1);
      setOfflineMessage(t ? "Imehifadhiwa kwenye kifaa; itasawazishwa mtandao utakaporejea." : "Saved on this device; it will sync when connected.");
      offlineId.current = "";
      form.reset();
    } catch (error) {
      setOfflineMessage(error instanceof Error ? error.message : (t ? "Haikuweza kuhifadhi rekodi nje ya mtandao." : "Could not save the offline entry."));
    }
  }

  return (
    <form action={formAction} className={`record-form ${className}`} onSubmit={handleSubmit}>
      {offlineActionKey && <input name="offlineId" type="hidden" defaultValue="" />}
      {children}
      <div className="form-footer">
        <button className="button button-primary" disabled={pending} type="submit">
          {pending ? "Saving…" : submitLabel}
        </button>
        <p
          aria-live="polite"
          className={`form-message ${state.success ? "is-success" : ""}`}
          role="status"
        >
          {state.message}
        </p>
      </div>
      {offlineActionKey && (pendingCount > 0 || offlineMessage) && <div className="field-help field-wide" aria-live="polite">
        {pendingCount > 0 ? `${pendingCount} ${t ? "rekodi zinasubiri kusawazishwa." : "entries waiting to sync."} ` : ""}
        {offlineMessage}
      </div>}
    </form>
  );
}

export function FormField({
  label,
  name,
  type = "text",
  placeholder,
  required,
  min,
  max,
  step,
  defaultValue,
  children,
}: {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
  min?: string;
  max?: string;
  step?: string;
  defaultValue?: string | number;
  children?: ReactNode;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children ?? (
        <input
          defaultValue={defaultValue}
          min={min}
          max={max}
          name={name}
          placeholder={placeholder}
          required={required}
          step={step}
          type={type}
        />
      )}
    </label>
  );
}

export function FormSelect({
  label,
  name,
  options,
  required = true,
  defaultValue = "",
}: {
  label: string;
  name: string;
  options: Array<{ value: string; label: string }>;
  required?: boolean;
  defaultValue?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <select name={name} required={required} defaultValue={defaultValue}>
        {!required && <option value="">—</option>}
        {required && <option disabled value="">Choose…</option>}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function FormTextArea({
  label,
  name,
  placeholder,
  required,
  rows = 3,
  defaultValue,
}: {
  label: string;
  name: string;
  placeholder?: string;
  required?: boolean;
  rows?: number;
  defaultValue?: string;
}) {
  return (
    <label className="field field-wide">
      <span>{label}</span>
      <textarea
        name={name}
        placeholder={placeholder}
        required={required}
        rows={rows}
        defaultValue={defaultValue}
      />
    </label>
  );
}
