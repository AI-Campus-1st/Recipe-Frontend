"use client";

import { Loader2 } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "destructive";
export type ButtonSize = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 rounded-md text-button transition-colors select-none disabled:cursor-not-allowed";

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-primary text-on-primary hover:bg-primary-hover active:bg-primary-active disabled:bg-primary-disabled disabled:text-muted",
  secondary:
    "bg-canvas text-ink border border-border-strong hover:bg-surface-soft active:bg-surface-strong disabled:text-muted disabled:border-hairline disabled:bg-surface-soft",
  ghost: "bg-transparent text-secondary hover:bg-surface-soft active:bg-surface-strong disabled:text-muted",
  destructive:
    "bg-canvas text-error border border-error hover:bg-error hover:text-white active:bg-error active:text-white disabled:opacity-50",
};

const sizes: Record<ButtonSize, string> = {
  sm: "min-h-11 px-3 text-label",
  md: "min-h-11 px-4",
  lg: "min-h-12 px-5 w-full",
};

export function buttonClass(variant: ButtonVariant = "primary", size: ButtonSize = "md", className?: string) {
  return cn(base, variants[variant], sizes[size], className);
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: ReactNode;
}

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  icon,
  disabled,
  className,
  children,
  type = "button",
  onClick,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonClass(variant, size, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      onClick={loading ? undefined : onClick}
      {...rest}
    >
      {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  );
}
