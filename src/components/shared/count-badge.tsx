"use client";

import { useLocale, useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Counts past this are shown as "9+" (localized): a 3-digit pill blows out the
 * row it sits in, and past a handful the exact number stops changing the
 * decision ("open your chats").
 */
const DEFAULT_MAX = 9;

/**
 * THE count pill — every "how many are waiting on you" number in the app.
 *
 * Three surfaces used to hand-roll this (the header's unread badge, the inbox
 * row's per-thread badge, the owner panel's waiting-chats badge) and all three
 * had drifted: two printed `count > 9 ? "9+" : count` RAW, so on /ps and /fa the
 * header showed a Latin "2" beside Arabic-Indic digits everywhere else (the
 * exact defect `e2e/i18n-digits.spec.ts` exists to fence), and two set their own
 * type scale. One primitive, one digit system, one AA-safe fill.
 *
 * Renders NOTHING at zero (or null/undefined): every count badge in the app
 * hides at zero — Rails always emits the count, and "0" beside a link is
 * discouragement, not a pull.
 *
 * The pill itself is `aria-hidden`: a bare digit is meaningless to a screen
 * reader. Pass `label` for a spelled-out sr-only sentence ("3 unread
 * messages"), or leave it off when the host control already carries the number
 * in its own accessible name.
 */
export function CountBadge({
  count,
  max = DEFAULT_MAX,
  label,
  className,
}: {
  count?: number | null;
  /** Cap; above it the pill shows `max` + the localized "+". Default 9. */
  max?: number;
  /** sr-only sentence naming what the number counts. */
  label?: string;
  className?: string;
}) {
  const t = useTranslations("common");
  const locale = useLocale();
  if (count == null || count <= 0) return null;

  const capped = count > max;
  // Formatted first, then handed to the ICU string: the "+" has to sit on the
  // locale's own digits (۹+), and its side is the translator's call in RTL.
  const digits = formatNumber(capped ? max : count, locale);

  return (
    <>
      <Badge
        variant="count"
        aria-hidden
        data-testid="count-badge"
        className={cn(
          "shrink-0 justify-center px-1.5 font-semibold",
          className,
        )}
      >
        {capped ? t("countOverflow", { count: digits }) : digits}
      </Badge>
      {label && <span className="sr-only">{label}</span>}
    </>
  );
}
