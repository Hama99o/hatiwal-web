import { useLocale } from "next-intl";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";

const SIZE_CLASS = {
  sm: "text-sm",
  md: "text-lg",
  lg: "text-2xl",
} as const;

interface PriceTagProps {
  price: number | null;
  currency?: string | null;
  size?: keyof typeof SIZE_CLASS;
  className?: string;
}

/** The single source of price rendering. Never format a price inline. */
export function PriceTag({
  price,
  currency,
  size = "md",
  className,
}: PriceTagProps) {
  const locale = useLocale();
  return (
    <span
      className={cn(
        "font-bold tabular-nums text-foreground",
        SIZE_CLASS[size],
        className,
      )}
    >
      {formatPrice(price, currency, locale)}
    </span>
  );
}
