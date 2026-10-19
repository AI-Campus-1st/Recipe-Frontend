"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { useCallback, useState, useSyncExternalStore, type ReactNode } from "react";
import { ToastProvider } from "@/components/Toast";
import { LoadingState } from "@/components/States";
import { ApiError } from "@/lib/api/client";

const MOCKING_ENABLED = process.env.NEXT_PUBLIC_API_MOCKING === "enabled";

const MockWorkerStarter = dynamic(() => import("@/mocks/MockWorkerStarter"), { ssr: false });

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 10_000,
        refetchOnWindowFocus: false,
        retry: (failureCount, error) =>
          failureCount < 2 && !(error instanceof ApiError && error.status >= 400 && error.status < 500),
      },
      mutations: { retry: false },
    },
  });
}

const noopSubscribe = () => () => {};

/**
 * Data and "today" depend on the client (local timezone, API), so content renders only after mount.
 * When mocks are explicitly enabled, the MSW worker is started first. It never falls back silently.
 */
function MockGate({ children }: { children: ReactNode }) {
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const [mockState, setMockState] = useState<"starting" | "ready" | "failed">(MOCKING_ENABLED ? "starting" : "ready");
  const onReady = useCallback(() => setMockState("ready"), []);
  const onError = useCallback(() => setMockState("failed"), []);

  if (mockState === "failed") return <p className="p-5 text-error">Mock API를 시작하지 못했습니다.</p>;
  if (!mounted || mockState !== "ready") {
    return (
      <>
        {MOCKING_ENABLED && <MockWorkerStarter onReady={onReady} onError={onError} />}
        <LoadingState label="준비 중" />
      </>
    );
  }
  return <>{children}</>;
}

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(createQueryClient);
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <MockGate>{children}</MockGate>
      </ToastProvider>
    </QueryClientProvider>
  );
}
