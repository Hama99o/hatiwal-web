import { useTranslations } from "next-intl";
import { Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * FirmPriceBadge — signals that the seller is NOT open to offers (mirrors
 * mobile N071). Shown only when `listing.negotiable === false`; when the flag
 * is absent or true the listing is negotiable and this renders nothing.
 *
 * A quiet trust signal, so it reads in the neutral `muted` tone (matching
 * mobile's `variant="muted"`), never a loud accent. When firm, the caller must
 * also hide/disable the make-offer affordance.
 */
export function FirmPriceBadge({
  negotiable,
  className,
}: {
  negotiable?: boolean;
  className?: string;
}) {
  const t = useTranslations("listing");

  // Negotiable by default: only firm when explicitly false.
  if (negotiable !== false) return null;

  return (
    <Badge variant="muted" className={cn("gap-1", className)}>
      <Lock className="size-3" />
      {t("firmPrice")}
    </Badge>
  );
}
