"use client";

import { useEffect, useState } from "react";

export function PwaRegister() {
  const [error, setError] = useState("");

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch((reason: unknown) => {
      setError(reason instanceof Error ? reason.message : "Service worker registration failed.");
    });
  }, []);

  return error ? (
    <span className="pwa-warning" role="status" title={error}>
      Offline app shell unavailable
    </span>
  ) : null;
}
