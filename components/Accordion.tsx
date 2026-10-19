"use client";

import { ChevronDown } from "lucide-react";
import { useId, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

interface AccordionProps {
  /** Header content — must convey the item's core information even when collapsed. */
  header: ReactNode;
  /** Always-visible content between the header and the collapsible body (may contain links). */
  summary?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Lower collapsed height (e.g. weekly days without a meal). */
  compact?: boolean;
  className?: string;
  headerClassName?: string;
  bodyClassName?: string;
}

export function Accordion({
  header,
  summary,
  children,
  defaultOpen = false,
  open: controlledOpen,
  onOpenChange,
  compact = false,
  className,
  headerClassName,
  bodyClassName,
}: AccordionProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const open = controlledOpen ?? uncontrolledOpen;
  const contentId = useId();

  const toggle = () => {
    const next = !open;
    if (controlledOpen === undefined) setUncontrolledOpen(next);
    onOpenChange?.(next);
  };

  return (
    <div className={className}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={contentId}
        onClick={toggle}
        className={cn(
          "flex w-full items-center gap-3 text-left",
          compact ? "min-h-11 py-2" : "min-h-12 py-3",
          headerClassName,
        )}
      >
        <div className="min-w-0 flex-1">{header}</div>
        <ChevronDown
          className={cn("size-5 shrink-0 text-muted transition-transform duration-200", open && "rotate-180")}
          aria-hidden
        />
      </button>
      {summary}
      <div id={contentId} hidden={!open} className={bodyClassName}>
        {open && children}
      </div>
    </div>
  );
}
