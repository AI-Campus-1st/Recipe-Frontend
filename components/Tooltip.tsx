"use client";

import { HelpCircle } from "lucide-react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";

interface TooltipProps {
  /** Accessible name of the trigger. */
  label: string;
  children: ReactNode;
}

/** Opens on hover, focus or tap. Supplementary information only. */
export function Tooltip({ label, children }: TooltipProps) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const rootRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown, true);
    };
  }, [open]);

  return (
    <span
      ref={rootRef}
      className="relative inline-flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        aria-label={label}
        aria-describedby={open ? id : undefined}
        aria-expanded={open}
        // A tap both focuses and clicks, so clicking only opens; Escape, blur or an outside tap closes it.
        onClick={() => setOpen(true)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        className="-my-3 flex size-11 items-center justify-center rounded-full text-muted hover:text-secondary"
      >
        <HelpCircle className="size-4" aria-hidden />
      </button>
      {open && (
        <span
          id={id}
          role="tooltip"
          className="absolute top-full left-1/2 z-10 mt-1 w-max max-w-60 -translate-x-1/2 rounded-sm bg-ink px-3 py-2 text-caption text-white shadow-overlay"
        >
          {children}
        </span>
      )}
    </span>
  );
}
