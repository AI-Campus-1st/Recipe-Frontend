"use client";

import { X } from "lucide-react";
import { useEffect, useId, useRef, useState, type AnimationEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Upper bound for the close animation (200ms) before unmounting anyway, e.g. if `animationend` never fires. */
const CLOSE_FALLBACK_MS = 300;

/**
 * Open modals, bottom → top. Escape, the focus trap and scrim clicks only apply to the top-most one,
 * so a modal opened on top of another (MEAL-001 recipe picker) closes alone.
 */
const modalStack: string[] = [];
const isTopModal = (id: string) => modalStack[modalStack.length - 1] === id;

/** Body scroll lock shared by nested modals: released when the last one closes. */
let scrollLocks = 0;
let originalBodyOverflow = "";
function lockBodyScroll() {
  if (scrollLocks === 0) {
    originalBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  }
  scrollLocks += 1;
}
function unlockBodyScroll() {
  scrollLocks = Math.max(0, scrollLocks - 1);
  if (scrollLocks === 0) document.body.style.overflow = originalBodyOverflow;
}

function hasAnimation(element: HTMLElement) {
  const style = getComputedStyle(element);
  return !!style.animationName && style.animationName !== "none" && parseFloat(style.animationDuration || "0") > 0;
}

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  /** Action area — by default `취소` and the primary action. */
  footer?: ReactNode;
  /** Block closing while the primary action is running. */
  busy?: boolean;
  /** `auto` (default): content height up to 90dvh. `tall`: fixed 80dvh, only the body scrolls. */
  size?: "auto" | "tall";
  /** Called after the close animation finishes and the modal unmounts. */
  onExited?: () => void;
}

/**
 * Bottom sheet modal. Slides up on open (250ms ease-out) and down on close (200ms ease-in) with a scrim fade,
 * and stays mounted until the close animation ends. No animation under `prefers-reduced-motion: reduce`.
 */
export function Modal({ open, onClose, title, description, children, footer, busy = false, size = "auto", onExited }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const modalId = useId();
  const titleId = useId();
  const descriptionId = useId();
  const onCloseRef = useRef(onClose);
  const onExitedRef = useRef(onExited);
  const busyRef = useRef(busy);
  const [rendered, setRendered] = useState(open);

  // Mount as soon as `open` turns on; unmounting waits for the close animation (`finishClose`).
  if (open && !rendered) setRendered(true);
  const closing = rendered && !open;

  useEffect(() => {
    onCloseRef.current = onClose;
    onExitedRef.current = onExited;
    busyRef.current = busy;
  });

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    const focusables = panel?.querySelectorAll<HTMLElement>(FOCUSABLE);
    const firstField = panel?.querySelector<HTMLElement>("input, textarea, select");
    (firstField ?? focusables?.[0] ?? panel)?.focus();

    modalStack.push(modalId);
    lockBodyScroll();

    const onKeyDown = (event: KeyboardEvent) => {
      if (!isTopModal(modalId)) return;
      if (event.key === "Escape") {
        event.stopPropagation();
        if (!busyRef.current) onCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || !panel) return;
      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      const index = modalStack.lastIndexOf(modalId);
      if (index !== -1) modalStack.splice(index, 1);
      unlockBodyScroll();
      previouslyFocused?.focus?.();
    };
  }, [open, modalId]);

  // Closing: wait for the slide-down, or unmount right away when no animation applies (reduced motion).
  useEffect(() => {
    if (!closing) return;
    const panel = panelRef.current;
    const timer = window.setTimeout(
      () => {
        setRendered(false);
        onExitedRef.current?.();
      },
      panel && hasAnimation(panel) ? CLOSE_FALLBACK_MS : 0,
    );
    return () => window.clearTimeout(timer);
  }, [closing]);

  const onPanelAnimationEnd = (event: AnimationEvent<HTMLDivElement>) => {
    if (!closing || event.target !== event.currentTarget) return;
    setRendered(false);
    onExitedRef.current?.();
  };

  if (!rendered || typeof document === "undefined") return null;

  return createPortal(
    <div
      className={cn("fixed inset-0 z-50 flex items-end justify-center", closing && "pointer-events-none")}
      inert={closing}
      aria-hidden={closing || undefined}
    >
      <div
        className={cn(
          "absolute inset-0 bg-scrim motion-reduce:animate-none",
          closing ? "animate-modal-scrim-out" : "animate-modal-scrim-in",
        )}
        aria-hidden
        onClick={() => !busy && isTopModal(modalId) && onClose()}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        onAnimationEnd={onPanelAnimationEnd}
        className={cn(
          "relative flex w-full max-w-[var(--app-max-width)] flex-col rounded-t-xl bg-canvas shadow-overlay outline-none motion-reduce:animate-none",
          size === "tall" ? "h-[80dvh]" : "max-h-[90dvh]",
          closing ? "animate-modal-panel-out" : "animate-modal-panel-in",
        )}
      >
        <div className="flex items-start gap-3 px-5 pt-5 pb-3">
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-heading-md text-ink">
              {title}
            </h2>
            {description && (
              <div id={descriptionId} className="mt-1 text-body-md text-body">
                {description}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="닫기"
            className="-mr-2 -mt-2 flex size-11 items-center justify-center rounded-full text-muted hover:bg-surface-soft disabled:opacity-40"
          >
            <X className="size-5" aria-hidden />
          </button>
        </div>
        {children && <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4">{children}</div>}
        {footer && (
          <div className="flex gap-2 border-t border-hairline px-5 pt-3 pb-[calc(12px+env(safe-area-inset-bottom))] [&>*]:flex-1">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

/**
 * Keeps a modal's subject (`entry`, `item`, `true` …) after it is cleared so the modal can slide down with its
 * content, then drops it on `onExited`. Pass `value` as `null`/`undefined`/`false` while closed.
 *
 * ```tsx
 * const presence = useModalPresence(item);
 * if (!presence.value) return null;
 * return <Body key={presence.value.id} item={presence.value} open={presence.open} onExited={presence.onExited} />;
 * ```
 */
/** Props a modal body receives from `useModalPresence`. */
export interface ModalPresenceProps {
  open: boolean;
  onExited: () => void;
}

export function useModalPresence<T>(value: T | null | undefined | false) {
  const current = value === false || value === undefined ? null : value;
  const [shown, setShown] = useState<T | null>(current);
  if (current !== null && current !== shown) setShown(current);
  return { value: current ?? shown, open: current !== null, onExited: () => setShown(null) };
}
