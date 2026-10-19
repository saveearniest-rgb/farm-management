"use client";

import {
  createExpenseAction,
  createNurseryCheckAction,
  createWorkEntryAction,
  recordScoutingAction,
  recordSprayAction,
  recordWeatherAction,
  updateTaskStatusAction,
} from "@/app/actions/operations";
import type { FormState } from "@/lib/form-state";
import { listPendingActions, removePendingAction, type OfflineActionKey, type PendingAction } from "@/lib/offline-queue";

const actions: Record<OfflineActionKey, (state: FormState, data: FormData) => Promise<FormState>> = {
  "task-status": updateTaskStatusAction,
  "nursery-check": createNurseryCheckAction,
  "work-entry": createWorkEntryAction,
  expense: createExpenseAction,
  weather: recordWeatherAction,
  scouting: recordScoutingAction,
  spray: recordSprayAction,
};

async function submitPendingAction(item: PendingAction) {
  const formData = new FormData();
  for (const [key, value] of Object.entries(item.fields)) formData.set(key, value);
  formData.set("offlineId", item.id);
  return actions[item.actionKey]({ message: "" }, formData);
}

const activeSync = new Map<string, Promise<{ count: number; error: string; synced: number }>>();

export function syncPendingActions(farmId: string) {
  const currentSync = activeSync.get(farmId);
  if (currentSync) return currentSync;
  const pendingSync = (async () => {
    let synced = 0;
    const pending = (await listPendingActions()).filter((item) => item.farmId === farmId);
    for (const item of pending) {
      const result = await submitPendingAction(item);
      if (!result.success) return { count: pending.length - synced, error: result.message, synced };
      await removePendingAction(item.id);
      synced += 1;
    }
    return { count: 0, error: "", synced };
  })().finally(() => {
    activeSync.delete(farmId);
  });
  activeSync.set(farmId, pendingSync);
  return pendingSync;
}
