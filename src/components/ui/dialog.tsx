"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

// Stack of currently-open dialogs (innermost last). Escape and the Tab
// focus-trap act only for the TOP-most dialog, so a nested dialog (e.g. the
// safety-tips sheet opened from inside the meetup dialog) doesn't tear down the
// parent when it's dismissed.
const openDialogs: string[] = [];

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
 *
 * PORTALLED to <body>: a dialog must never be a DOM descendant of the thing that
 * opened it. A host that animates (`transform`/`backdrop-filter` make an element
 * the containing block for its `position: fixed` children), hides itself
 * (`opacity-0` + `inert`, `lg:hidden`) or stacks below something else (a `z-40`
 * host caps its `z-50` child) would otherwise drag the open dialog off screen
 * with it — which is exactly what the sticky <ListingActionBar> did to its
 * message/offer dialogs. React still owns the subtree, so state, context (auth,
 * next-intl, React Query) and event bubbling are unaffected; only the DOM
 * position changes.
 *
 * KEYBOARD (iOS Safari): `position: fixed; inset: 0` is the LAYOUT viewport,
 * which does not shrink when the on-screen keyboard opens, so a centred card
 * with an input (invite by email, report, offer, review…) sat under the
 * keyboard. While open, the overlay is sized to `window.visualViewport` (the
 * part actually visible) and the card scrolls inside it, so the input, its
 * error and the action button stay on screen.
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
  const token = useId();
  // Keep the latest onClose/dismissible without re-running the open effect.
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const dismissRef = useRef(dismissible);
  dismissRef.current = dismissible;
  const [viewport, setViewport] = useState<{ top: number; height: number } | null>(null);

  useEffect(() => {
    const vv = typeof window !== "undefined" ? window.visualViewport : null;
    if (!open || !vv) return;
    const sync = () => setViewport({ top: vv.offsetTop, height: vv.height });
    sync();
    vv.addEventListener("resize", sync);
    vv.addEventListener("scroll", sync);
    return () => {
      vv.removeEventListener("resize", sync);
      vv.removeEventListener("scroll", sync);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    restoreRef.current = document.activeElement as HTMLElement | null;
    openDialogs.push(token);

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const card = cardRef.current;
    const first = card?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? card)?.focus();

    const onKey = (e: KeyboardEvent) => {
      // Only the top-most open dialog handles keys — otherwise a nested dialog's
      // Escape would also close its parent, and Tab could wrap into it.
      if (openDialogs[openDialogs.length - 1] !== token) return;
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
      const i = openDialogs.lastIndexOf(token);
      if (i !== -1) openDialogs.splice(i, 1);
      document.body.style.overflow = prevOverflow;
      restoreRef.current?.focus?.();
    };
  }, [open, token]);

  // `document` is browser-only; a dialog is always opened by a client
  // interaction, so rendering nothing on the server costs nothing (and the
  // portal contributes no markup in place, so there is nothing to mismatch).
  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-x-0 top-0 z-50 flex h-dvh items-center justify-center p-4"
      style={viewport ? { top: viewport.top, height: viewport.height } : undefined}
      data-testid="dialog-viewport"
    >
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
          "relative z-10 max-h-full w-full overflow-y-auto rounded-lg border bg-card p-6 shadow-lg focus:outline-none",
          className,
        )}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
