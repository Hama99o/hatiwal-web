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
  /** Nothing to say: not active, or no expiry. */
  | { kind: "none" }
  /** Past its run — pairs with the Renew action. */
  | { kind: "expired" }
  /** Expiring within EXPIRING_SOON_DAYS (warning pill); `days` is 1..3. */
  | { kind: "soon"; days: number }
  /** Still running: a quiet "Expires in N days" (mobile shows it always). */
  | { kind: "later"; days: number };

/** Mobile ExpiryBadge's `expiringSoonDays`: the pill turns warning at 3 days. */
export const EXPIRING_SOON_DAYS = 3;

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
  return days <= EXPIRING_SOON_DAYS ? { kind: "soon", days } : { kind: "later", days };
}

/**
 * Has this LIVE listing run out — for the ACTIONS (Relaunch first) and the
 * Expired tab, not the pill. A held (`reserved`) listing expires too
 * (Rails `expired?` is `live? && …`, and the Expired filter is `live`), so
 * unlike the badge this is not gated on `active`: an expired reserved listing
 * used to get "Mark as sold" and no Relaunch, and sat under Active (parity
 * sweep 2026-10-08; mobile reads `listing.expired` for both).
 */
export function isListingLapsed({ status, expiresAt, expired }: ListingExpiryInput): boolean {
  if (status !== "active" && status !== "reserved") return false;
  if (expired) return true;
  return !!expiresAt && new Date(expiresAt).getTime() <= Date.now();
}

/**
 * Listing expiry pill for seller/owner contexts (mobile ExpiryBadge parity):
 * a quiet "Expires in N days" on every active listing, warning at 3 days or
 * fewer, destructive once expired; nothing when it can't expire. Expiry must
 * never catch a seller by surprise (owner, 2026-10-12, item 1).
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

  // The shared primitive, not a hand-rolled pill: `destructive`, `warning` and
  // `muted` are exactly this treatment, and re-implementing them left this badge
  // at px-2 next to StatusBadge's px-2.5 — the owner's two pills a hair out of
  // register wherever they sit in the same row.
  return (
    <Badge
      variant={isExpired ? "destructive" : state.kind === "soon" ? "warning" : "muted"}
      className={cn("w-fit", className)}
    >
      <AlarmClock className="size-3 shrink-0" />
      {label}
    </Badge>
  );
}
