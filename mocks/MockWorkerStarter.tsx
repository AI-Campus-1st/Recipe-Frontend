"use client";

import { useEffect } from "react";
import { startMockWorker } from "./browser";

/** Browser-only: loaded with `next/dynamic({ ssr: false })` so `msw/browser` never enters the server bundle. */
export default function MockWorkerStarter({ onReady, onError }: { onReady: () => void; onError: () => void }) {
  useEffect(() => {
    let cancelled = false;
    startMockWorker()
      .then(() => !cancelled && onReady())
      .catch((error: unknown) => {
        console.error("[mocks] Failed to start the MSW worker", error);
        if (!cancelled) onError();
      });
    return () => {
      cancelled = true;
    };
  }, [onReady, onError]);
  return null;
}
