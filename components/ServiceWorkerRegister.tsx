"use client";

import { useEffect } from "react";

/**
 * Registers the PWA service worker (public/sw.js) in production builds only.
 * Skipped when MSW mocking is enabled: both workers would claim the "/" scope.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (process.env.NEXT_PUBLIC_API_MOCKING === "enabled") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {
      // Installability is progressive enhancement; the app works without a worker.
    });
  }, []);
  return null;
}
