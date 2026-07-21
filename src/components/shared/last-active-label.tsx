"use client";

import { Clock } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

// Privacy-safe recency bucket → i18n key (Rails only exposes the coarse label,
// never a precise last-seen time).
const KEYS: Record<string, string> = {
  today: "activeRecently.today",
  this_week: "activeRecently.thisWeek",
  this_month: "activeRecently.thisMonth",
};

/**
 * "Active today / this week / this month" seller recency label. Shared by the
 * public seller profile and the listing-detail seller card (mobile parity).
 * Renders nothing when the bucket is absent.
 */
export function LastActiveLabel({
  label,
  className,
}: {
  label?: string | null;
  className?: string;
}) {
  const t = useTranslations("seller");
  const key = label ? KEYS[label] : undefined;
  if (!key) return null;
  return (
    <span
      className={cn(
        "flex items-center gap-1 text-xs text-muted-foreground",
        className,
      )}
    >
      <Clock className="size-3.5 shrink-0" />
      <span>{t(key)}</span>
    </span>
  );
}
