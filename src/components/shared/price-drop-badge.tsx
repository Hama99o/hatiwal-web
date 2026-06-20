import { useTranslations } from "next-intl";
import { TrendingDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function PriceDropBadge({
  percent,
  className,
}: {
  percent: number;
  className?: string;
}) {
  const t = useTranslations("listing.priceDrop");
  return (
    <Badge variant="destructive" className={className}>
      <TrendingDown className="size-3" />
      {t("badge", { percent })}
    </Badge>
  );
}
