"use client";

import { useTranslations } from "next-intl";
import { AlarmClock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const MS_PER_DAY = 86_400_000;

interface ListingExpiryInput {
  status?: string;
  expiresAt?: string | null;
  expired?: boolean;
}

export type ListingExpiryState =
  /** Nothing to say: not active, no expiry, or more than a week of run left. */
  | { kind: "none" }
  /** Past its run — pairs with the Renew action. */
  | { kind: "expired" }
  /** Expiring within a week; `days` is 1..7. */
  | { kind: "soon"; days: number };

/**
 * THE expiry rule, in one place. `ExpiryBadge` renders it, and callers that have
 * to *agree* with the badge import it — `OwnerListingBar` gates its "Active"
 * badge on it so a listing is never labelled Active and Expired side by side.
 *
 * Only ACTIVE listings have a live expiry clock: a sold/reserved/draft listing
 * still carries its original `expires_at`, so status has to be part of the rule or
 * "Expires in 3 days" would sit next to a SOLD badge.
 */
export function listingExpiryState({
  status,
  expiresAt,
  expired,
}: ListingExpiryInput): ListingExpiryState {
  if (status !== "active") return { kind: "none" };
  // Server flag wins — it's the same `expired?` Rails uses to offer Renew.
  if (expired) return { kind: "expired" };
  if (!expiresAt) return { kind: "none" };
  const days = Math.ceil((new Date(expiresAt).getTime() - Date.now()) / MS_PER_DAY);
  // Timestamp is past but the server flag hasn't caught up — show expired.
  if (days <= 0) return { kind: "expired" };
  return days <= 7 ? { kind: "soon", days } : { kind: "none" };
}

/**
 * Listing expiry pill for seller/owner contexts (mobile ExpiryBadge parity).
 * Renders nothing when the listing isn't expiring soon (>7 days out) or can't
 * expire at all, so it never clutters fresh cards — see `listingExpiryState`.
 */
export function ExpiryBadge({
  status,
  expiresAt,
  expired,
  className,
}: ListingExpiryInput & { className?: string }) {
  const t = useTranslations("listing");
  const state = listingExpiryState({ status, expiresAt, expired });
  if (state.kind === "none") return null;

  const isExpired = state.kind === "expired";
  const label = isExpired
    ? t("expiredBadge")
    : state.days === 1
      ? t("expiresTomorrow")
      : t("expiresInDays", { count: state.days });

  // The shared primitive, not a hand-rolled pill: `destructive` and `warning`
  // are exactly this treatment, and re-implementing them left this badge at
  // px-2 next to StatusBadge's px-2.5 — the owner's two pills a hair out of
  // register wherever they sit in the same row.
  return (
    <Badge
      variant={isExpired ? "destructive" : "warning"}
      className={cn("w-fit", className)}
    >
      <AlarmClock className="size-3 shrink-0" />
      {label}
    </Badge>
  );
}
