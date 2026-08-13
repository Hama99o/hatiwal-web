import { useLocale } from "next-intl";
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
const TONE_CLASS = {
  default: "text-foreground",
  muted: "text-muted-foreground",
} as const;

interface PriceTagProps {
  price: number | null;
  currency?: string | null;
  size?: keyof typeof SIZE_CLASS;
  tone?: keyof typeof TONE_CLASS;
  className?: string;
}

/** The single source of price rendering. Never format a price inline. */
export function PriceTag({
  price,
  currency,
  size = "md",
  tone = "default",
  className,
}: PriceTagProps) {
  const locale = useLocale();
  return (
    <span
      className={cn(
        "font-bold tabular-nums",
        TONE_CLASS[tone],
        SIZE_CLASS[size],
        className,
      )}
    >
      {formatPrice(price, currency, locale)}
    </span>
  );
}
