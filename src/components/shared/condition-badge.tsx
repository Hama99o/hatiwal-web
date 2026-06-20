import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import type { ListingCondition } from "@/lib/types";

export function ConditionBadge({
  condition,
  className,
}: {
  condition: ListingCondition;
  className?: string;
}) {
  const t = useTranslations("listing.condition");
  return (
    <Badge variant="outline" className={className}>
      {t(condition)}
    </Badge>
  );
}
