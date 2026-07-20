"use client";

import { useTranslations } from "next-intl";
import { AlarmClock } from "lucide-react";
import { cn } from "@/lib/utils";

const MS_PER_DAY = 86_400_000;

/**
 * Listing expiry pill for seller/owner contexts (mobile ExpiryBadge parity).
 * Only ACTIVE listings have a live expiry clock — a sold/reserved/draft listing
 * still carries its original `expires_at`, so we must gate on status or it would
 * read "Expires in N days" next to a SOLD badge. Renders nothing when the
 * listing isn't expiring soon (>7 days out), so it never clutters fresh cards.
 */
export function ExpiryBadge({
  status,
  expiresAt,
  expired,
  className,
}: {
  status?: string;
  expiresAt?: string | null;
  expired?: boolean;
  className?: string;
}) {
  const t = useTranslations("listing");

  // Only active listings expire; drafts/reserved/sold keep a stale expires_at.
  if (status !== "active") return null;

  let label: string | null = null;
  let isExpired = false;

  if (expired) {
    // Server flag: already past its run — pairs with the Renew action.
    label = t("expiredBadge");
    isExpired = true;
  } else if (expiresAt) {
    const days = Math.ceil((new Date(expiresAt).getTime() - Date.now()) / MS_PER_DAY);
    if (days <= 0) {
      // Timestamp is past but the server flag hasn't caught up — show expired.
      label = t("expiredBadge");
      isExpired = true;
    } else if (days === 1) {
      label = t("expiresTomorrow");
    } else if (days <= 7) {
      label = t("expiresInDays", { count: days });
    }
  }
  if (!label) return null;

  return (
    <span
      className={cn(
        "inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        isExpired
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
