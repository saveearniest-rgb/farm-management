"use client";

export type OfflineActionKey =
  | "task-status"
  | "nursery-check"
  | "work-entry"
  | "expense"
  | "weather"
  | "scouting"
  | "spray"
  | "animal-daily-record";

export type PendingAction = {
  id: string;
  farmId: string;
  actionKey: OfflineActionKey;
  fields: Record<string, string>;
  queuedAt: string;
};

const DATABASE_NAME = "shamba-field-records";
const STORE_NAME = "pending-actions";

function openStore() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 2);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains("pending-activity-logs")) {
        database.createObjectStore("pending-activity-logs", { keyPath: "id" });
      }
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open offline action storage."));
  });
}

export async function listPendingActions(): Promise<PendingAction[]> {
  const database = await openStore();
  return new Promise<PendingAction[]>((resolve, reject) => {
    const request = database.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).getAll();
    request.onsuccess = () => resolve(request.result as PendingAction[]);
    request.onerror = () => reject(request.error ?? new Error("Could not read pending offline actions."));
  }).finally(() => database.close());
}

export async function savePendingAction(action: PendingAction) {
  const database = await openStore();
  return new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put(action);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("Could not save offline action."));
    transaction.onabort = () => reject(transaction.error ?? new Error("Offline action save was aborted."));
  }).finally(() => database.close());
}

export async function removePendingAction(id: string) {
  const database = await openStore();
  return new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).delete(id);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("Could not remove synced offline action."));
    transaction.onabort = () => reject(transaction.error ?? new Error("Offline action removal was aborted."));
  }).finally(() => database.close());
}
