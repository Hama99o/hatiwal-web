import { useLocale, useTranslations } from "next-intl";
import { priceUnitKey, type PriceUnit } from "@/lib/stays";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";

const SIZE_CLASS = {
  sm: "text-sm",
  md: "text-lg",
  lg: "text-2xl",
} as const;

/**
 * Price colour. Mirrors mobile's `PriceTag` `tone` prop so the two clients stay
 * legible together: `default` is the loud, price-prominent number every live
 * listing gets; `muted` is the archived one a sold listing gets (the
 * `mutedForeground` of DESIGN_SYSTEM §2's `sold` row — the number is history,
 * not an offer).
 */
/**
 * The "each" qualifier's size, per price size — roughly 55–60% of the figure it
 * qualifies (docs/SPIKE_LISTING_QUANTITY.md §12.2), never a fixed step. A flat
 * `text-xs` is right beside a `text-2xl` price and almost the same size as a
 * `text-sm` one, which would make the qualifier compete with the number.
 */
const PER_UNIT_CLASS = {
  sm: "text-[0.625rem]",
  md: "text-xs",
  lg: "text-sm",
} as const;

const TONE_CLASS = {
  default: "text-foreground",
  muted: "text-muted-foreground",
} as const;

interface PriceTagProps {
  price: number | null;
  currency?: string | null;
  size?: keyof typeof SIZE_CLASS;
  tone?: keyof typeof TONE_CLASS;
  /**
   * Multi-quantity — appends a muted "each" after the amount. Mirrors mobile's
   * `perUnit` prop exactly (docs/SPIKE_LISTING_QUANTITY.md §12).
   *
   * It exists to kill the worst ambiguity the quantity feature introduces: on a
   * 15-bag listing a bare "AFN 14,000" reads as the price of one bag OR of all
   * fifteen, and buyer and seller discover they disagreed at the meetup — where
   * there is no payment step or delivery to undo it. Pass
   * `hasStockToShow(listing)`, never a literal `true`.
   */
  perUnit?: boolean;
  /** Stays (api STAYS_DESIGN): "night" → "AFN 1,500 / night", "month" → "/ month".
   *  The same quiet suffix as "each", and it wins over it. */
  unit?: PriceUnit | null;
  className?: string;
}

/** The single source of price rendering. Never format a price inline. */
export function PriceTag({
  price,
  currency,
  size = "md",
  tone = "default",
  perUnit = false,
  unit,
  className,
}: PriceTagProps) {
  const locale = useLocale();
  const t = useTranslations();
  const amount = (
    <span
      className={cn(
        "font-bold tracking-tight tabular-nums",
        TONE_CLASS[tone],
        SIZE_CLASS[size],
        className,
      )}
    >
      {formatPrice(price, currency, locale)}
    </span>
  );

  // No suffix on an absent price — there is nothing for "each" to qualify.
  const unitKey = priceUnitKey(unit);
  if ((!perUnit && !unitKey) || price == null) return amount;

  // The figure keeps its exact size/weight/colour; only a small muted qualifier
  // is added, so price primacy is untouched (§12.2). `items-baseline` keeps the
  // two sitting on one line at every size, and RTL is handled by the document
  // direction — no row-reverse needed on the web.
  return (
    <span className="inline-flex items-baseline gap-1">
      {amount}
      <span
        className={cn(
          "font-normal text-muted-foreground",
          PER_UNIT_CLASS[size],
        )}
      >
        {unitKey ? t(unitKey) : t("listing.stock.each")}
      </span>
    </span>
  );
}
