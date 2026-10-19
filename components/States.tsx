"use client";

import { AlertCircle, Inbox, Loader2 } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "./Button";
import { cn } from "@/lib/cn";

interface EmptyStateProps {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center rounded-md border border-dashed border-border-strong bg-canvas px-5 py-8 text-center", className)}>
      <Inbox className="mb-3 size-8 text-border-strong" aria-hidden />
      <p className="text-body-lg font-semibold text-ink">{title}</p>
      {description && <div className="mt-1 text-body-md text-body">{description}</div>}
      {action && <div className="mt-4 flex w-full flex-col gap-2">{action}</div>}
    </div>
  );
}

export function LoadingState({ label = "불러오는 중" }: { label?: string }) {
  return (
    <div role="status" className="flex flex-col items-center justify-center gap-2 py-12 text-body-md text-muted">
      <Loader2 className="size-6 animate-spin text-secondary" aria-hidden />
      {label}
    </div>
  );
}

interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
  retrying?: boolean;
}

export function ErrorState({ message, onRetry, retrying }: ErrorStateProps) {
  return (
    <div role="alert" className="flex flex-col items-center rounded-md border border-error/30 bg-canvas px-5 py-8 text-center">
      <AlertCircle className="mb-3 size-8 text-error" aria-hidden />
      <p className="text-body-md text-ink">{message}</p>
      {onRetry && (
        <Button variant="secondary" className="mt-4" onClick={onRetry} loading={retrying}>
          다시 시도
        </Button>
      )}
    </div>
  );
}

/** Fixed bottom CTA that sits above the bottom navigation, plus a spacer so content is not hidden. */
export function BottomActionBar({ children }: { children: ReactNode }) {
  return (
    <>
      <div aria-hidden className="h-20" />
      <div className="fixed inset-x-0 bottom-[calc(var(--app-bottom-nav-height)+env(safe-area-inset-bottom))] z-30 mx-auto w-full max-w-[var(--app-max-width)] border-t border-hairline bg-canvas px-5 py-3">
        {children}
      </div>
    </>
  );
}
