"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * ONE implementation of the "this control cannot honour your tap yet" contract.
 *
 * Several buyer controls on the listing page can be tapped before the answer
 * they need has arrived — the save heart (session probe, then the shared saved
 * list), the message CTA and the Report trigger (session probe). All three owe
 * the buyer the same three things, and all three used to hand-roll them, so a fix
 * to one silently skipped the others:
 *
 *  1. SAY SO VISIBLY. Never render byte-identical to the ready state while a tap
 *     cannot run immediately — and never say it with opacity (see below). The cue
 *     is a GLYPH or a COLOUR, both of which cost nothing:
 *       - the hearts go `text-muted-foreground` while the answer is unknown, and
 *         swap `Heart` → `Loader2` once a tap is held;
 *       - the labelled controls swap the icon they already render
 *         (`MessageCircle`, `Flag`) for `Loader2`, which is the same box.
 *     The ONE documented exception is the sticky bar's compact CTA row, which
 *     renders no icon at all: measured on a 360px phone (the commonest Android
 *     portrait width), the +24px of icon and gap is the difference between the
 *     primary label fitting and being ellipsized, and that row IS the feature.
 *     It stays un-cued until a tap is held, then shows the spinner and lets the
 *     label ellipsize — a held tap is worth the truncation, an idle wait is not.
 *  2. REMEMBER THE TAP and replay it against the RESOLVED answer, so nothing is
 *     swallowed and nothing is guessed (`useQueuedTap` below).
 *  3. `aria-busy` for "not ready", `aria-disabled` for "your tap is already
 *     accepted" — never `disabled`, which would drop the tap and the focus
 *     (`unsettledProps` below).
 *
 * WHY NO OPACITY, EVER (the numbers, from this project's own tokens in
 * globals.css, composited over the sticky bar's `bg-background/95`):
 *  - `opacity-70` on a labelled control dims the LABEL. White
 *    `--primary-foreground` on `--primary` hsl(221 83% 53%), the whole button
 *    composited at 70% over the bar, measures ≈2.0:1 for 14px `text-sm
 *    font-medium` against the 4.5:1 AA floor. (Earlier passes of this comment
 *    said "~3.1:1", which is what you get by dimming the text against an
 *    undimmed fill — not what the class does.)
 *  - `opacity-70` on a heart: the `unknown` glyph (`text-muted-foreground` plus
 *    the dim, two cues stacked) is 2.64:1 light, and the optimistically-filled
 *    `fill-destructive` heart 2.56:1 light / 2.47:1 dark — all under WCAG's 3:1
 *    non-text floor. Undimmed, the colour swap alone clears it (muted 4.52:1,
 *    destructive 3.62:1).
 *  - `animate-pulse` is the same mistake in motion: it troughs at `opacity: .5`,
 *    so the muted heart bottoms out at 1.90:1 — worse than the static dim it
 *    replaced — and on a labelled control it pulses the label to 3.38:1.
 *    `motion-reduce:animate-none` then leaves a `prefers-reduced-motion` viewer
 *    with NO cue at all, which is how a held tap became invisible.
 *  - A `secondary` variant on the pinned CTA is not an option either: it dropped
 *    fill-vs-bar contrast from 4.97:1 to 1.19:1 light / 1.35:1 dark, i.e. it
 *    erased the button shape of the one loud action the sticky bar exists for, on
 *    every signed-in cold load.
 * So: colour and glyph carry the state, opacity never does, and this module owns
 * no class names at all — each caller renders its own glyph, because only the
 * caller knows which glyph it is showing.
 */

/**
 * ARIA for a control in an unsettled state. Spread onto the `Button`; the caller
 * keeps whatever is specific to it (`aria-pressed`, the glyph swap of rule 1).
 *
 * Deliberately returns no `className`: a cue that costs contrast is not a cue
 * (see above), and the only cues left — a colour token on the glyph, a different
 * glyph — belong to the caller that renders it. When this returned a class, the
 * two labelled callers disagreed about rule 1 for a whole cycle and the icon
 * caller shipped an `animate-pulse` that failed the very floor the class was
 * added to respect.
 */
export function unsettledProps({
  unknown = false,
  busy = false,
}: {
  /** The answer this control needs has not arrived (or failed to). */
  unknown?: boolean;
  /** A tap is in flight, or accepted and waiting for `unknown` to clear. */
  busy?: boolean;
}): {
  "aria-busy": true | undefined;
  "aria-disabled": true | undefined;
} {
  return {
    "aria-busy": unknown || busy || undefined,
    "aria-disabled": busy || undefined,
  };
}

/**
 * Hold a tap taken while `pending`, and replay it the moment it clears.
 *
 * `run` is read from the LATEST render, so the replay sees the resolved answer
 * rather than the values that were current when the tap happened — that is the
 * whole point: a tap during bootstrap must not assume "guest" or "not saved".
 *
 * `pending` must therefore be the condition under which `run` would GUESS, not
 * merely the condition under which the control looks busy. A presentational
 * budget that stops painting "pending" (`probeTimedOut`) must not appear here on
 * its own: releasing a held tap into a still-unresolved `run` is how a signed-in
 * buyer's save turned into a /login redirect.
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
