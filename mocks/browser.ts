import { setupWorker } from "msw/browser";
import { applyScenarioFromUrl } from "./db";
import { handlers } from "./handlers";

let starting: Promise<void> | null = null;

/** Idempotent: React Strict Mode runs effects twice, but the worker may only start once. */
export function startMockWorker(): Promise<void> {
  starting ??= (async () => {
    applyScenarioFromUrl();
    const worker = setupWorker(...handlers);
    await worker.start({ onUnhandledFrame: "bypass", quiet: true });
  })();
  return starting;
}
