"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

const FOCUSABLE =
  'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

/**
 * THE modal primitive — one accessible implementation every in-app dialog uses
 * (review prompt, buyer picker, report, offer/meetup/counter, safety tips), so
 * the scrim markup and a11y aren't re-rolled per dialog. Provides: scrim +
 * centered card, Escape to close, focus-on-open, a Tab focus-trap, body
 * scroll-lock, focus restore on close, and `role="dialog"` + `aria-modal` +
 * `aria-labelledby`. Callers render their own header/body/footer as children
 * and point `labelledBy` at their heading's id.
 *
 * `dismissible={false}` (e.g. while a request is in flight) blocks Escape and
 * backdrop-close so the user can't dismiss mid-action.
 */
export function Dialog({
  open,
  onClose,
  labelledBy,
  className,
  dismissible = true,
  children,
}: {
  open: boolean;
  onClose: () => void;
  labelledBy?: string;
  className?: string;
  dismissible?: boolean;
  children: ReactNode;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);
  // Keep the latest onClose/dismissible without re-running the open effect.
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const dismissRef = useRef(dismissible);
  dismissRef.current = dismissible;

  useEffect(() => {
    if (!open) return;
    restoreRef.current = document.activeElement as HTMLElement | null;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const card = cardRef.current;
    const first = card?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? card)?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (dismissRef.current) closeRef.current();
        return;
      }
      if (e.key !== "Tab" || !card) return;
      const items = Array.from(card.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (!items.length) return;
      const firstEl = items[0];
      const lastEl = items[items.length - 1];
      if (e.shiftKey && document.activeElement === firstEl) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    };
    document.addEventListener("keydown", onKey);

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      restoreRef.current?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={() => dismissible && onClose()}
      />
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        className={cn(
          "relative z-10 w-full rounded-lg border bg-card p-6 shadow-lg focus:outline-none",
          className,
        )}
      >
        {children}
      </div>
    </div>
  );
}
