import { Star } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

/**
 * Read-only 5-star row. Filled stars use the `warning` (gold) token; empty
 * stars are muted — strong contrast in both light and dark. Announced to
 * screen readers as "N out of 5 stars" (raw glyphs are meaningless to them).
 * RTL-safe: the row is symmetric and star fill reads outside-in either way.
 */
export function StarRating({
  rating,
  size = 16,
  className,
}: {
  rating: number;
  size?: number;
  className?: string;
}) {
  const t = useTranslations("reviews");
  const rounded = Math.round(rating);

  return (
    <div
      className={cn("flex items-center gap-0.5", className)}
      role="img"
      aria-label={t("starsAria", { rating })}
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          style={{ width: size, height: size }}
          className={cn(
            "shrink-0",
            n <= rounded ? "fill-warning text-warning" : "fill-muted text-muted",
          )}
          aria-hidden
        />
      ))}
    </div>
  );
}
