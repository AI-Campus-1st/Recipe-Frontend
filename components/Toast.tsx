"use client";

import { CheckCircle2, Info, X, XCircle } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

export type ToastType = "success" | "error" | "info";

export interface ToastOptions {
  type: ToastType;
  message: string;
  action?: { label: string; onClick: () => void };
}

interface ToastItem extends ToastOptions {
  id: number;
}

interface ToastContextValue {
  show: (options: ToastOptions) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

/** Errors stay longer so they can be read before disappearing. */
const DURATION: Record<ToastType, number> = { success: 3000, info: 4500, error: 7000 };
const MAX_VISIBLE = 3;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
    const timer = timers.current.get(id);
    if (timer) clearTimeout(timer);
    timers.current.delete(id);
  }, []);

  const show = useCallback(
    (options: ToastOptions) => {
      const id = nextId.current++;
      setToasts((current) => {
        // Do not stack identical messages.
        const withoutDuplicate = current.filter((t) => !(t.message === options.message && t.type === options.type));
        return [...withoutDuplicate, { ...options, id }].slice(-MAX_VISIBLE);
      });
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), DURATION[options.type]),
      );
    },
    [dismiss],
  );

  useEffect(() => {
    const map = timers.current;
    return () => map.forEach((timer) => clearTimeout(timer));
  }, []);

  const value = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 top-0 z-[60] mx-auto flex w-full max-w-[var(--app-max-width)] flex-col gap-2 px-4 pt-[calc(12px+env(safe-area-inset-top))]"
        aria-live="polite"
        aria-relevant="additions"
      >
        {toasts.map((toast) => (
          <ToastView key={toast.id} toast={toast} onDismiss={() => dismiss(toast.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

const icons = { success: CheckCircle2, error: XCircle, info: Info };
const iconColor = { success: "text-success", error: "text-error", info: "text-info" };

function ToastView({ toast, onDismiss }: { toast: ToastItem; onDismiss: () => void }) {
  const Icon = icons[toast.type];
  return (
    <div
      role={toast.type === "error" ? "alert" : "status"}
      className="pointer-events-auto flex items-start gap-3 rounded-md border border-hairline bg-canvas p-3 shadow-overlay"
    >
      <Icon className={cn("mt-0.5 size-5 shrink-0", iconColor[toast.type])} aria-hidden />
      <p className="flex-1 text-body-md text-ink">{toast.message}</p>
      {toast.action && (
        <button
          type="button"
          className="min-h-8 shrink-0 rounded-sm px-2 text-label text-secondary hover:bg-surface-soft"
          onClick={() => {
            toast.action?.onClick();
            onDismiss();
          }}
        >
          {toast.action.label}
        </button>
      )}
      <button
        type="button"
        aria-label="알림 닫기"
        onClick={onDismiss}
        className="-m-1 flex size-8 shrink-0 items-center justify-center rounded-full text-muted hover:bg-surface-soft"
      >
        <X className="size-4" aria-hidden />
      </button>
    </div>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used within ToastProvider");
  return context;
}
