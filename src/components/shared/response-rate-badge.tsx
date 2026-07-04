import { useTranslations } from "next-intl";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * ResponseRateBadge — seller trust signal shown on the listing-detail seller
 * card and on the public seller profile. Web port of the mobile
 * `ResponseRateBadge` (same fields, same copy).
 *
 * Renders: Clock icon + "XX% reply rate · Usually responds within <label>".
 *
 * Guard rule (mirrors mobile): renders null unless BOTH are truthy —
 *   - responseRatePercent is non-null AND > 0 (a 0%-rate seller is a false
 *     trust signal, so suppress the badge entirely)
 *   - responseTimeLabel is a known bucket
 *
 * RTL flips via logical layout; dark mode via token colors.
 */

const TIME_LABELS = [
  "within_one_hour",
  "within_a_day",
  "within_a_few_days",
] as const;

type ResponseTimeLabel = (typeof TIME_LABELS)[number];

function isTimeLabel(value: string | null | undefined): value is ResponseTimeLabel {
  return !!value && (TIME_LABELS as readonly string[]).includes(value);
}

export function ResponseRateBadge({
  responseRatePercent,
  responseTimeLabel,
  className,
}: {
  responseRatePercent?: number | null;
  responseTimeLabel?: string | null;
  className?: string;
}) {
  const t = useTranslations("profile.sellerProfile");

  if (!responseRatePercent || !isTimeLabel(responseTimeLabel)) return null;

  const ratePart = t("responseRate", { percent: responseRatePercent });
  const timePart = t(`responseTime.${responseTimeLabel}`);

  return (
    <div
      className={cn(
        "mt-2 flex items-center gap-1.5 text-xs text-muted-foreground",
        className,
      )}
    >
      <Clock className="size-3.5 shrink-0" />
      <span>{`${ratePart} · ${timePart}`}</span>
    </div>
  );
}
