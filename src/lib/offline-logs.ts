export type PendingLog = {
  id: string;
  farmId?: string;
  body: string;
  weather: string;
  whoWorked: string;
  cycleId: string;
  loggedAt: string;
};

const DATABASE_NAME = "shamba-field-records";
const STORE_NAME = "pending-activity-logs";

function openStore() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 2);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
      if (!database.objectStoreNames.contains("pending-actions")) {
        database.createObjectStore("pending-actions", { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open offline log storage."));
  });
}

export async function listPendingLogs(): Promise<PendingLog[]> {
  const database = await openStore();
  return new Promise<PendingLog[]>((resolve, reject) => {
    const request = database.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).getAll();
    request.onsuccess = () => resolve(request.result as PendingLog[]);
    request.onerror = () => reject(request.error ?? new Error("Could not read offline activity logs."));
  }).finally(() => database.close());
}

export async function savePendingLog(log: PendingLog) {
  const database = await openStore();
  return new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put(log);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("Could not save offline activity log."));
    transaction.onabort = () => reject(transaction.error ?? new Error("Offline activity log save was aborted."));
  }).finally(() => database.close());
}

export async function removePendingLog(id: string) {
  const database = await openStore();
  return new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).delete(id);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("Could not remove synced activity log."));
    transaction.onabort = () => reject(transaction.error ?? new Error("Offline activity log removal was aborted."));
  }).finally(() => database.close());
}
