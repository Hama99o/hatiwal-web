"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * ONE implementation of the "this control cannot honour your tap yet" contract.
 *
 * Several buyer controls on the listing page can be tapped before the answer
 * they need has arrived — the save heart (session probe, then the shared saved
 * list) and the message CTA (session probe). Both owe the buyer the same three
 * things, and both used to hand-roll them, so a fix to one silently skipped the
 * other:
 *
 *  1. Never render byte-identical to the ready state while a tap cannot run
 *     immediately — a dead control that looks alive is worse than a disabled one.
 *  2. `aria-busy` for "not ready", `aria-disabled` for "your tap is already
 *     accepted" — never `disabled`, which would drop the tap and the focus.
 *  3. Remember the tap and replay it against the RESOLVED answer, so nothing is
 *     swallowed and nothing is guessed (`useQueuedTap` below).
 */

/**
 * Whether the "not ready" cue may touch the control's own opacity.
 *
 * `icon`  — icon-only controls (the hearts). Dimming is judged against WCAG's
 *           3:1 non-text rule, which `opacity-70` clears.
 * `text`  — controls with a visible label (the primary CTA). Dimming these fails
 *           AA: measured, white `--primary-foreground` on `--primary`
 *           hsl(221 83% 53%) at 70% over the bar's `bg-background/95` is ~3.1:1
 *           for 14px `text-sm font-medium`, against a 4.5:1 floor — and it is the
 *           pinned primary action on every cold load. A text control must signal
 *           "not ready" with chrome that leaves the label alone: a `secondary`
 *           variant for the window, or a spinner beside the label.
 */
export type UnsettledTone = "icon" | "text";

/**
 * ARIA + class names for a control in an unsettled state. Spread onto the
 * `Button`; the caller keeps whatever is specific to it (`aria-pressed`, a
 * variant swap, a spinner).
 */
export function unsettledProps({
  unknown = false,
  busy = false,
  queued = false,
  tone = "icon",
}: {
  /** The answer this control needs has not arrived (or failed to). */
  unknown?: boolean;
  /** A tap is in flight, or accepted and waiting for `unknown` to clear. */
  busy?: boolean;
  /** A tap has been accepted but cannot run yet — needs an "I heard you" cue. */
  queued?: boolean;
  tone?: UnsettledTone;
}): {
  "aria-busy": true | undefined;
  "aria-disabled": true | undefined;
  className: string;
} {
  const dim = tone === "icon";
  return {
    "aria-busy": unknown || busy || undefined,
    "aria-disabled": busy || undefined,
    className: cn(
      dim && (unknown || busy) && "opacity-70",
      // The in-flight case already has its own cue (the heart flipped
      // optimistically); this is for a tap that is held, not running.
      dim && queued && "animate-pulse motion-reduce:animate-none",
    ),
  };
}

/**
 * Hold a tap taken while `pending`, and replay it the moment it clears.
 *
 * `run` is read from the LATEST render, so the replay sees the resolved answer
 * rather than the values that were current when the tap happened — that is the
 * whole point: a tap during bootstrap must not assume "guest" or "not saved".
 */
export function useQueuedTap(
  pending: boolean,
  run: () => void,
): { queued: boolean; queue: () => void; release: () => void } {
  const [queued, setQueued] = useState(false);
  const runRef = useRef(run);
  // Declared BEFORE the replay effect so it has already refreshed the ref by the
  // time the replay runs on the commit where `pending` flips false.
  useEffect(() => {
    runRef.current = run;
  });
  useEffect(() => {
    if (!queued || pending) return;
    setQueued(false);
    runRef.current();
  }, [queued, pending]);
  return {
    queued,
    queue: useCallback(() => setQueued(true), []),
    release: useCallback(() => setQueued(false), []),
  };
}
