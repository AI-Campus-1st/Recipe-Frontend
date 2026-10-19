"use client";

import { Plus } from "lucide-react";
import { cn } from "@/lib/cn";

interface FloatingActionButtonProps {
  label: string;
  onClick: () => void;
  /** Raise the button when a fixed bottom CTA is also on screen. */
  raised?: boolean;
}

export function FloatingActionButton({ label, onClick, raised = false }: FloatingActionButtonProps) {
  return (
    <div
      className={cn(
        "pointer-events-none fixed inset-x-0 z-30 mx-auto flex w-full max-w-[var(--app-max-width)] justify-end px-5",
        raised
          ? "bottom-[calc(var(--app-bottom-nav-height)+env(safe-area-inset-bottom)+80px)]"
          : "bottom-[calc(var(--app-bottom-nav-height)+env(safe-area-inset-bottom)+16px)]",
      )}
    >
      <button
        type="button"
        onClick={onClick}
        className="pointer-events-auto inline-flex min-h-12 items-center gap-2 rounded-full bg-primary px-5 text-button text-on-primary shadow-overlay hover:bg-primary-hover active:bg-primary-active"
      >
        <Plus className="size-5" aria-hidden />
        {label}
      </button>
    </div>
  );
}
