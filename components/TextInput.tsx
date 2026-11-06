"use client";

import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

interface FieldProps {
  label: string;
  /** Shows `필수` or `선택` next to the label. */
  required?: boolean;
  hint?: ReactNode;
  error?: string | null;
  labelAddon?: ReactNode;
}

function FieldLabel({ id, label, required, addon }: { id: string; label: string; required?: boolean; addon?: ReactNode }) {
  return (
    <div className="mb-1.5 flex items-center gap-1">
      <label htmlFor={id} className="text-label text-ink">
        {label}
      </label>
      <span className={cn("text-caption", required ? "text-warning" : "text-muted")}>{required ? "필수" : "선택"}</span>
      {addon}
    </div>
  );
}

export const fieldClass = (error?: string | null) =>
  cn(
    "w-full rounded-sm border bg-canvas px-3 text-body-lg text-ink placeholder:text-muted outline-none",
    "focus:border-secondary focus:ring-2 focus:ring-primary-soft disabled:bg-surface-soft disabled:text-muted",
    error ? "border-error" : "border-border-strong",
  );

type TextInputProps = FieldProps & Omit<InputHTMLAttributes<HTMLInputElement>, "required">;

export function TextInput({ label, required, hint, error, labelAddon, className, id: idProp, ...rest }: TextInputProps) {
  const autoId = useId();
  const id = idProp ?? autoId;
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  return (
    <div className={className}>
      <FieldLabel id={id} label={label} required={required} addon={labelAddon} />
      <input
        id={id}
        aria-required={required || undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={cn(hint ? hintId : undefined, error ? errorId : undefined) || undefined}
        className={cn(fieldClass(error), "min-h-11")}
        {...rest}
      />
      {hint && !error && (
        <p id={hintId} className="mt-1 text-caption text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="mt-1 text-caption text-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

type TextAreaProps = FieldProps & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "required">;

export function TextArea({ label, required, hint, error, labelAddon, className, id: idProp, rows = 3, ...rest }: TextAreaProps) {
  const autoId = useId();
  const id = idProp ?? autoId;
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  return (
    <div className={className}>
      <FieldLabel id={id} label={label} required={required} addon={labelAddon} />
      <textarea
        id={id}
        rows={rows}
        aria-required={required || undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={cn(hint ? hintId : undefined, error ? errorId : undefined) || undefined}
        className={cn(fieldClass(error), "resize-none py-2")}
        {...rest}
      />
      {hint && !error && (
        <p id={hintId} className="mt-1 text-caption text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="mt-1 text-caption text-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

type SelectProps = FieldProps & Omit<SelectHTMLAttributes<HTMLSelectElement>, "required">;

/** Native select with the same label, hint and error layout as `TextInput`. */
export function Select({ label, required, hint, error, labelAddon, className, id: idProp, children, ...rest }: SelectProps) {
  const autoId = useId();
  const id = idProp ?? autoId;
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  return (
    <div className={className}>
      <FieldLabel id={id} label={label} required={required} addon={labelAddon} />
      <select
        id={id}
        aria-required={required || undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={cn(hint ? hintId : undefined, error ? errorId : undefined) || undefined}
        className={cn(fieldClass(error), "min-h-11")}
        {...rest}
      >
        {children}
      </select>
      {hint && !error && (
        <p id={hintId} className="mt-1 text-caption text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="mt-1 text-caption text-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
