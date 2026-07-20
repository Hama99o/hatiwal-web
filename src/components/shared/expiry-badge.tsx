"use client";

import { differenceInCalendarDays, parseISO } from "date-fns";
import { useTranslations } from "next-intl";
import { AlarmClock } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Listing expiry pill for seller/owner contexts (mobile ExpiryBadge parity).
 * Listings run for 30 days; this warns as one nears expiry and flags expired
 * ones (which the seller can renew). Renders NOTHING for a listing that isn't
 * expiring soon, so it never clutters fresh listings.
 */
export function ExpiryBadge({
  expiresAt,
  expired,
  className,
}: {
  expiresAt?: string | null;
  expired?: boolean;
  className?: string;
}) {
  const t = useTranslations("listing");

  let label: string | null = null;
  if (expired) {
    label = t("expiredBadge");
  } else if (expiresAt) {
    const days = differenceInCalendarDays(parseISO(expiresAt), new Date());
    if (days <= 0) label = t("expiresToday");
    else if (days === 1) label = t("expiresTomorrow");
    else if (days <= 7) label = t("expiresInDays", { count: days });
  }
  if (!label) return null;

  return (
    <span
      className={cn(
        "inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        expired
          ? "bg-destructive/10 text-destructive"
          : "bg-warning/10 text-warning",
        className,
      )}
    >
      <AlarmClock className="size-3 shrink-0" />
      {label}
    </span>
  );
}
