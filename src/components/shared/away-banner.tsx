import { useLocale, useTranslations } from "next-intl";
import { PlaneTakeoff } from "lucide-react";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * AwayBanner — quiet informational banner shown when a seller has set a future
 * "away until" date. Web port of the mobile `AwayBanner` (same fields, same
 * copy). The ONE place the "seller is away" treatment lives — reused on the
 * listing detail seller card, the public seller profile, and the seller's own
 * profile (with a different message key).
 *
 * Renders nothing when:
 *   - awayUntil is null/undefined
 *   - awayUntil is a past date (the backend only surfaces future dates, but we
 *     guard client-side too for robustness)
 *
 * Info-toned (primary) card so it reads as informational, not alarming.
 * RTL-safe via logical layout; dark mode via token colors.
 */
export function AwayBanner({
  awayUntil,
  messageKey = "seller.awayBanner",
  className,
}: {
  /** ISO-8601 datetime of the away-period end, or null/undefined if not away. */
  awayUntil?: string | null;
  /**
   * next-intl key for the message. Receives a `{date}` param. Defaults to the
   * buyer-facing "Seller is away until {date}". Pass "profile.away.youAreAway"
   * for the seller's own profile view.
   */
  messageKey?: string;
  className?: string;
}) {
  const t = useTranslations();
  const locale = useLocale();

  if (!awayUntil) return null;
  const awayDate = new Date(awayUntil);
  if (Number.isNaN(awayDate.getTime()) || awayDate <= new Date()) return null;

  const message = t(messageKey, { date: formatDate(awayUntil, locale) });

  return (
    <div
      role="note"
      aria-label={message}
      className={cn(
        "flex items-center gap-2.5 rounded-xl border border-primary bg-primary/10 px-3.5 py-2.5 text-sm font-medium text-primary",
        className,
      )}
    >
      <PlaneTakeoff className="size-4 shrink-0" />
      <span className="flex-1 text-start">{message}</span>
    </div>
  );
}
