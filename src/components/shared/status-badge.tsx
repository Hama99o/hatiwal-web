import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import type { ListingStatus } from "@/lib/types";

const STATUS_VARIANT: Record<
  ListingStatus,
  "muted" | "success" | "warning" | "secondary"
> = {
  draft: "muted",
  active: "success",
  reserved: "warning",
  sold: "secondary",
};

/** Lifecycle badge — same status→color mapping as mobile. */
export function StatusBadge({
  status,
  className,
}: {
  status: ListingStatus;
  className?: string;
}) {
  const t = useTranslations("listing.status");
  return (
    <Badge variant={STATUS_VARIANT[status]} className={className}>
      {t(status)}
    </Badge>
  );
}
