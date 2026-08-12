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
 *  1. `aria-busy` for "not ready", `aria-disabled` for "your tap is already
 *     accepted" — never `disabled`, which would drop the tap and the focus.
 *  2. Remember the tap and replay it against the RESOLVED answer, so nothing is
 *     swallowed and nothing is guessed (`useQueuedTap` below).
 *  3. Say so visibly wherever a cue can be shown without costing contrast or the
 *     control's own affordance — which is not everywhere, and `UnsettledTone`
 *     below is where that is decided ONCE rather than per caller.
 */

/**
 * Which visible "not ready" cue this control can carry.
 *
 * NEITHER tone dims. `opacity-70` was measured against this project's own tokens,
 * composited on the sticky bar's `bg-background/95`, and it fails on both sides:
 *  - text: white `--primary-foreground` on `--primary` hsl(221 83% 53%) at 70% is
 *    ~3.1:1 for 14px `text-sm font-medium`, against the 4.5:1 AA floor.
 *  - icon: the `unknown` heart (`text-muted-foreground` + `opacity-70`, two cues
 *    stacked) is 2.64:1 light, and the optimistically-filled `fill-destructive`
 *    heart 2.56:1 light / 2.47:1 dark — all under WCAG's 3:1 non-text floor, and
 *    `animate-pulse` dips further. (An earlier version of this comment claimed
 *    ~6.5:1; that holds only for a `text-foreground` glyph, which is exactly the
 *    glyph the unknown branch replaces.) Undimmed, the colour swap alone clears
 *    the floor — muted 4.52:1, destructive 3.62:1 — so the COLOUR is the cue.
 *
 * What the tone actually selects is how a HELD tap says "I heard you":
 *  `icon`  — an icon-only control (the hearts) has no room beside its glyph, so
 *            it pulses.
 *  `text`  — a labelled control swaps its icon for a spinner, rendered by the
 *            caller (`report-button.tsx`, `start-conversation-button.tsx`), so
 *            this module adds no class for it. Before a tap it is deliberately
 *            UN-CUED, and that is the decision, not an omission: nothing is
 *            misleading, because the tap is queued and replayed against the
 *            resolved answer, and `aria-busy` carries the state for assistive
 *            tech. Anything louder costs more than it buys — a `secondary`
 *            variant on the pinned CTA dropped fill-vs-bar contrast from 4.97:1
 *            to 1.19:1 light / 1.35:1 dark, i.e. it erased the button shape of
 *            the one loud action the sticky bar exists for, on every signed-in
 *            cold load.
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
  return {
    "aria-busy": unknown || busy || undefined,
    "aria-disabled": busy || undefined,
    className: cn(
      // The `unknown` and in-flight states already carry their own cue — the
      // muted glyph, then the heart flipped optimistically. This is for a tap
      // that is HELD, not running, and only an icon-only control needs it (a
      // labelled one shows a spinner instead — see `UnsettledTone`).
      tone === "icon" && queued && "animate-pulse motion-reduce:animate-none",
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
