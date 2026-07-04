import { useTranslations } from "next-intl";
import { TrendingDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * PriceDropBadge — signals a recent price reduction (mirrors mobile N804).
 *
 * A price drop is *good news for the buyer*, so it reads in the success/green
 * tone (matching mobile's `colors.success`), never destructive/red.
 *
 * Variants:
 *   'detail' — full pill with a TrendingDown icon + "15% price drop". Sits
 *              beside the PriceTag on the listing detail page.
 *   'card'   — compact "-15%" pill overlaid on the card thumbnail. Uses a
 *              solid success fill so it stays legible over any photo.
 */
export function PriceDropBadge({
  percent,
  variant = "detail",
  className,
}: {
  percent: number;
  variant?: "detail" | "card";
  className?: string;
}) {
  const t = useTranslations("listing.priceDrop");

  if (percent <= 0) return null;

  if (variant === "card") {
    return (
      <Badge
        variant="success"
        className={cn(
          "gap-0.5 border-transparent bg-success px-1.5 py-0 text-[10px] font-bold text-success-foreground",
          className,
        )}
      >
        {t("badgeCardShort", { percent })}
      </Badge>
    );
  }

  return (
    <Badge variant="success" className={cn("border-success", className)}>
      <TrendingDown className="size-3" />
      {t("badge", { percent })}
    </Badge>
  );
}
