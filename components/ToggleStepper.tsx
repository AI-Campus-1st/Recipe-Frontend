"use client";

import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/cn";

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Accessible name, e.g. "10월 15일 요리 여부". */
  label: string;
  disabled?: boolean;
}

export function Toggle({ checked, onChange, label, disabled }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="flex min-h-11 min-w-11 items-center justify-center disabled:opacity-50"
    >
      <span
        className={cn(
          "relative inline-flex h-7 w-12 items-center rounded-full border transition-colors",
          checked ? "border-secondary bg-primary" : "border-border-strong bg-surface-strong",
        )}
      >
        <span
          className={cn(
            "absolute size-5 rounded-full bg-canvas shadow-overlay transition-transform",
            checked ? "translate-x-6" : "translate-x-1",
          )}
        />
      </span>
    </button>
  );
}

interface StepperProps {
  value: number;
  onChange: (value: number) => void;
  /** Accessible name, e.g. "10월 15일 인분". */
  label: string;
  min?: number;
  max?: number;
  disabled?: boolean;
  unit?: string;
}

/** Integer stepper, at least `min` (default 1). */
export function Stepper({ value, onChange, label, min = 1, max = 20, disabled, unit = "인분" }: StepperProps) {
  const set = (next: number) => onChange(Math.min(max, Math.max(min, Math.round(next))));
  return (
    <div role="group" aria-label={label} className={cn("inline-flex items-center", disabled && "opacity-50")}>
      <button
        type="button"
        aria-label={`${label} 줄이기`}
        disabled={disabled || value <= min}
        onClick={() => set(value - 1)}
        className="flex size-11 items-center justify-center rounded-full text-ink hover:bg-surface-soft disabled:cursor-not-allowed disabled:text-muted"
      >
        <Minus className="size-4" aria-hidden />
      </button>
      <output aria-live="polite" className="min-w-12 text-center text-body-md text-ink">
        {value}
        {unit}
      </output>
      <button
        type="button"
        aria-label={`${label} 늘리기`}
        disabled={disabled || value >= max}
        onClick={() => set(value + 1)}
        className="flex size-11 items-center justify-center rounded-full text-ink hover:bg-surface-soft disabled:cursor-not-allowed disabled:text-muted"
      >
        <Plus className="size-4" aria-hidden />
      </button>
    </div>
  );
}
