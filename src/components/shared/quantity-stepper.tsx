"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * QuantityStepper — the ONE transactional quantity control. Capped at what is
 * available, and it says why it stopped.
 *
 * ── Why CAP + REASON, and not the two obvious alternatives ──────────────────
 *
 * The number a seller types here decides how much of their stock leaves the
 * shelf, in an app with no payment step to reverse. Three designs were on the
 * table and the other two are both worse:
 *
 *  - SILENT CLAMPING (type 20 of 15, record 15) fails "never a failure the user
 *    cannot see". A seller who believes they sold 20 of 15 has a real
 *    misunderstanding, and rounding it away hides it. This is also how a typo'd
 *    "3" that became "153" once retired a whole batch.
 *  - A FREE-TEXT WARNING beside a raw `<input>` (what web's mark-sold dialog did
 *    until this component landed) explains the problem but still lets an
 *    impossible number sit in the field at confirm time, and it keeps a
 *    hand-rolled number input alive next to this shared one.
 *
 * So: `+` disables at the cap and typing above it snaps back to the cap, and the
 * moment either happens the control EXPLAINS itself — "Only 15 left. Edit the
 * listing if you have more." — which also tells the seller what to do when they
 * genuinely have more stock than the listing declares. That sentence is an
 * explanation, not an error: it is `text-muted-foreground`, not destructive.
 * Amazon and eBay both cap and state the cap; nobody rounds silently.
 *
 * ── The number is tap-to-edit ───────────────────────────────────────────────
 *
 * A stepper alone is wrong for this product's own reference case: 14 clicks to
 * reach 15 is worse than typing two digits. So the middle is a real numeric
 * input, not a label — one click for the common small number, typing for a big
 * one.
 *
 * RTL: the row is a plain flex row, so `−` and `+` mirror with the document
 * direction in ps/fa — the sides swap, the meaning does not.
 *
 * Consumers: the mark-sold dialog, the chat-initiated hold, the sales-ledger row
 * editor, and the buyer's offer. Extend this component; never fork it.
 */
export function QuantityStepper({
  value,
  onChange,
  max,
  min = 1,
  disabled = false,
  id,
  className,
  /**
   * Suppresses the cap sentence. Only for a caller that renders the same fact
   * itself — never to quiet the control down.
   */
  hideReason = false,
}: {
  value: number;
  onChange: (value: number) => void;
  /** The cap — available stock. */
  max: number;
  min?: number;
  disabled?: boolean;
  id?: string;
  className?: string;
  hideReason?: boolean;
}) {
  const t = useTranslations();
  // The cap can be below `min` on a listing whose stock ran out mid-session;
  // clamp the ceiling up so the control is never mathematically impossible
  // (min > max would disable both buttons and trap the value).
  const ceiling = Math.max(min, max);

  // What is IN the box while the seller is typing, which is not always a usable
  // number ("" between clearing and retyping, "20" on the way to being snapped
  // back to 15). The committed value stays in `value` — the parent's — so a
  // half-typed string can never be submitted.
  const [draft, setDraft] = useState(String(value));
  // Set the moment the seller reaches for more than exists, by typing or by
  // holding `+` down. Latched until they choose a number under the cap, so the
  // explanation does not blink away before it has been read.
  const [atCap, setAtCap] = useState(false);

  // Follow the parent when IT changes the value (a reset on close, a different
  // listing, an offer's prefilled quantity). Guarded on inequality so this does
  // not stomp what is being typed.
  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  /**
   * Latch the explanation ON when the seller reaches past the cap, and clear it
   * only when they settle on a number BELOW the cap.
   *
   * Not a plain `setAtCap(next > ceiling)`: that cleared the reason on blur — the
   * seller typed 20, watched it become 15, clicked away to the price field, and
   * the sentence telling them why disappeared. The explanation has to outlive the
   * focus change that follows reading it.
   */
  function noteCap(requested: number) {
    if (requested > ceiling) setAtCap(true);
    else if (requested < ceiling) setAtCap(false);
    // requested === ceiling: leave it as it is. Landing exactly on the cap is
    // both how you arrive there deliberately and where a clamp lands you.
  }

  function commit(next: number) {
    const clamped = Math.min(ceiling, Math.max(min, next));
    noteCap(next);
    setDraft(String(clamped));
    if (clamped !== value) onChange(clamped);
  }

  function onDraftChange(raw: string) {
    setDraft(raw);
    // Empty (or mid-edit junk) is left alone: snapping to `min` on the way
    // through would fight the seller's own backspace.
    if (raw.trim() === "") return;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return;
    const truncated = Math.trunc(parsed);
    noteCap(truncated);
    const clamped = Math.min(ceiling, Math.max(min, truncated));
    if (clamped !== value) onChange(clamped);
  }

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-10 shrink-0"
          disabled={disabled || value <= min}
          aria-label={t("common.decreaseQuantity")}
          onClick={() => commit(value - 1)}
        >
          <Minus className="size-4" />
        </Button>
        <Input
          id={id}
          // One stable hook for every consumer (mark-sold, chat hold, ledger row,
          // buyer offer). The `id` is a generated `useId`, so specs cannot key off
          // it — and giving each call site its own testid would fork the shared
          // component's contract four ways.
          data-testid="quantity-input"
          type="number"
          inputMode="numeric"
          min={min}
          max={ceiling}
          className="h-10 w-20 text-center"
          value={draft}
          disabled={disabled}
          aria-label={t("common.quantity")}
          onChange={(e) => onDraftChange(e.target.value)}
          // A click places a caret rather than replacing, so typing "3" into a
          // field reading "1" produced "13" — or "153" on a prefilled batch,
          // which the old silent clamp then turned into "sold all 15". Select on
          // focus so typing always REPLACES.
          onFocus={(e) => e.currentTarget.select()}
          // Whatever is in the box when focus leaves becomes a real number
          // again: an empty field or an over-cap entry resolves to something
          // submittable instead of sitting there as text.
          onBlur={() => {
            const parsed = Number(draft);
            // An empty field resolves back to the committed value — and passing
            // `value` (not a literal) is what stops the blur from reading as
            // "they asked for the cap" and clearing the explanation.
            commit(
              Number.isFinite(parsed) && draft.trim() !== ""
                ? Math.trunc(parsed)
                : value,
            );
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-10 shrink-0"
          disabled={disabled || value >= ceiling}
          aria-label={t("common.increaseQuantity")}
          // Pressing a disabled `+` is the other way a seller asks for more than
          // exists, so it latches the same explanation the typed path does.
          onClick={() => {
            if (value >= ceiling) setAtCap(true);
            else commit(value + 1);
          }}
        >
          <Plus className="size-4" />
        </Button>
      </div>

      {/* The reason. Shown once the cap has actually been reached for — not
          permanently, which would read as a standing complaint about a number
          the seller has not typed yet. The copy is a typed ICU `{count, number}`
          placeholder, so next-intl localizes the digits itself (ps included, via
          the fa-AF Intl alias) — never a pre-formatted string. */}
      {!hideReason && atCap && (
        <p
          className="text-xs text-muted-foreground"
          data-testid="quantity-cap-reason"
          // Announced when it appears: a seller who typed 20 and watched it
          // become 15 needs the reason read out, not just drawn.
          role="status"
        >
          {t("buyerPicker.quantityAtCapReason", { count: ceiling })}
        </p>
      )}
    </div>
  );
}
