"use client";

import { Check } from "lucide-react";
import { useId, type ReactNode } from "react";
import { cn } from "@/lib/cn";

interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: ReactNode;
  disabled?: boolean;
  className?: string;
}

export function Checkbox({ checked, onChange, label, disabled, className }: CheckboxProps) {
  const id = useId();
  return (
    <label
      htmlFor={id}
      className={cn("inline-flex min-h-11 cursor-pointer items-center gap-3", disabled && "cursor-not-allowed opacity-60", className)}
    >
      <span className="relative flex size-6 shrink-0 items-center justify-center">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(event) => onChange(event.target.checked)}
          className="peer absolute inset-0 size-6 cursor-pointer appearance-none rounded-sm border-2 border-border-strong bg-canvas checked:border-secondary checked:bg-primary disabled:cursor-not-allowed"
        />
        <Check className="pointer-events-none relative size-4 text-on-primary opacity-0 peer-checked:opacity-100" aria-hidden />
      </span>
      <span className="min-w-0">{label}</span>
    </label>
  );
}
