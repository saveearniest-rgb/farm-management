"use client";

import { useCallback, useEffect, useState } from "react";
import { listPendingActions } from "@/lib/offline-queue";
import { syncPendingActions } from "./offline-action-sync";

export function OfflineSyncStatus({
  farmId,
  locale,
}: {
  farmId: string;
  locale: "en" | "sw";
}) {
  const [message, setMessage] = useState("");
  const [pendingCount, setPendingCount] = useState(0);
  const sw = locale === "sw";

  const sync = useCallback(async () => {
    if (!navigator.onLine) return;
    const result = await syncPendingActions(farmId);
    setPendingCount(result.count);
    setMessage(result.error || (result.synced
      ? (sw ? "Rekodi za nje ya mtandao zimesawazishwa." : "Offline entries synced.")
      : ""));
  }, [farmId, sw]);

  useEffect(() => {
    let active = true;
    void listPendingActions().then((rows) => {
      if (!active) return;
      const farmRows = rows.filter((row) => row.farmId === farmId);
      setPendingCount(farmRows.length);
      if (navigator.onLine && farmRows.length) {
        void sync().catch((error: unknown) => {
          setMessage(error instanceof Error ? error.message : (sw ? "Usawazishaji umeshindwa." : "Offline sync failed."));
        });
      }
    }).catch((error: unknown) => {
      setMessage(error instanceof Error ? error.message : (sw ? "Hifadhi ya nje ya mtandao haipatikani." : "Offline storage is unavailable."));
    });
    const handleOnline = () => {
      void sync().catch((error: unknown) => {
        setMessage(error instanceof Error ? error.message : (sw ? "Usawazishaji umeshindwa." : "Offline sync failed."));
      });
    };
    window.addEventListener("online", handleOnline);
    return () => {
      active = false;
      window.removeEventListener("online", handleOnline);
    };
  }, [farmId, sync, sw]);

  if (!pendingCount && !message) return null;
  return (
    <div className="offline-sync-banner" aria-live="polite" role="status">
      {pendingCount > 0
        ? `${pendingCount} ${sw ? "rekodi zinasubiri kusawazishwa." : "offline entries waiting to sync."} `
        : ""}
      {message}
    </div>
  );
}
