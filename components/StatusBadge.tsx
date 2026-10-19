import { AlertTriangle, CheckCircle2, Clock, Loader2, XCircle, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type BadgeTone = "progress" | "success" | "warning" | "error" | "neutral";

const tones: Record<BadgeTone, { className: string; icon: LucideIcon; spin?: boolean }> = {
  progress: { className: "bg-surface-strong text-secondary", icon: Loader2, spin: true },
  success: { className: "bg-primary-soft text-success", icon: CheckCircle2 },
  warning: { className: "bg-surface-soft text-warning ring-1 ring-inset ring-warning/40", icon: AlertTriangle },
  error: { className: "bg-surface-soft text-error ring-1 ring-inset ring-error/40", icon: XCircle },
  neutral: { className: "bg-surface-soft text-body", icon: Clock },
};

interface StatusBadgeProps {
  tone: BadgeTone;
  children: ReactNode;
  className?: string;
}

/** Status is always conveyed with text + icon, never by colour alone. */
export function StatusBadge({ tone, children, className }: StatusBadgeProps) {
  const { className: toneClass, icon: Icon, spin } = tones[tone];
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-badge whitespace-nowrap",
        toneClass,
        className,
      )}
    >
      <Icon className={cn("size-3", spin && "animate-spin")} aria-hidden />
      {children}
    </span>
  );
}
