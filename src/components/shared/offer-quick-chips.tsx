"use client";

import { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import { formatPrice } from "@/lib/format";
import { Button } from "@/components/ui/button";

/**
 * OfferQuickChips — three quick-amount suggestion chips (95%, 90%, 85% of the
 * asking price) shown above an offer amount input, so buyers can tap a sensible
 * figure instead of typing a raw number. Web port of mobile's OfferSheet chips
 * (TASK-G083 / B2-OFFER).
 *
 * Purely presentational: tapping a chip fills the amount via `onSelect` but
 * never auto-sends. Renders nothing when the price is missing or non-positive.
 * Reused by the make-offer dialog and (later) the in-thread counter/offer
 * composer.
 */

/** Percentages of the asking price used to derive the three quick-amount chips. */
const CHIP_PERCENTAGES = [0.95, 0.9, 0.85] as const;

/**
 * Compute a quick-amount chip value from an asking price and a percentage.
 * Rounds to the nearest whole number and clamps to at least 1 — identical to
 * mobile's computeChipAmount so both clients suggest the same figures.
 */
export function computeChipAmount(price: number, percent: number): number {
  return Math.max(1, Math.round(price * percent));
}

export function OfferQuickChips({
  price,
  currency,
  value,
  onSelect,
  disabled,
}: {
  /** Asking price — the row is hidden when null/undefined/≤ 0. */
  price?: number | null;
  currency?: string | null;
  /** Current amount input value; the chip matching it renders selected. */
  value: string;
  /** Fill the amount input with the tapped chip's value (no auto-send). */
  onSelect: (amount: string) => void;
  disabled?: boolean;
}) {
  const t = useTranslations();
  const locale = useLocale();

  const chips = useMemo(
    () =>
      price != null && price > 0
        ? CHIP_PERCENTAGES.map((pct) => computeChipAmount(price, pct))
        : [],
    [price],
  );

  if (chips.length === 0) return null;

  return (
    <div className="space-y-1.5">
      <p className="text-xs text-muted-foreground">
        {t("chat.offer.quickChipsHint")}
      </p>
      {/* flex-wrap + gap: chips wrap on narrow widths and mirror under RTL. */}
      <div
        className="flex flex-wrap gap-2"
        role="group"
        aria-label={t("chat.offer.quickChipsHint")}
      >
        {chips.map((chipAmount) => {
          const isSelected = Number(value) === chipAmount;
          return (
            <Button
              key={chipAmount}
              type="button"
              size="sm"
              variant={isSelected ? "default" : "outline"}
              className="rounded-full text-xs font-semibold"
              aria-pressed={isSelected}
              disabled={disabled}
              onClick={() => onSelect(String(chipAmount))}
            >
              {formatPrice(chipAmount, currency, locale)}
            </Button>
          );
        })}
      </div>
    </div>
  );
}
