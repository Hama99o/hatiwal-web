"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { TriangleAlert } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { Link } from "@/i18n/navigation";
import { getWarnings, markWarningsSeen } from "@/lib/api/warnings";
import { formatRelativeDate } from "@/lib/format";

// Warning categories reuse the report-reason vocabulary, so a non-prohibited
// strike is named via the existing `report.reasons.*` keys; unknown → nothing.
const KNOWN_CATEGORIES = new Set(["spam", "inappropriate", "fraud", "wrong_category", "other"]);
import { Button } from "@/components/ui/button";

export interface WarningsCardItem {
  category: string;
  reason: string;
  createdAt?: string;
  /** The taken-down listing's title, when the API names it (shop warnings). */
  listingTitle?: string | null;
}

/**
 * The ONE "you have warnings" card (account AND shop), mirroring mobile's
 * WarningBanner: the count first ("1 of 3"), what each strike was for, what
 * happens at the threshold, and a link to what is not allowed. Calm, warning
 * toned; renders nothing at 0. Digits follow the locale (ICU `number`).
 */
export function WarningsCard({
  scope,
  activeCount,
  threshold,
  warnings,
  action,
}: {
  scope: "account" | "shop";
  activeCount: number;
  threshold: number;
  warnings: WarningsCardItem[];
  /** An extra control beside the rules link (the account's "I understand"). */
  action?: React.ReactNode;
}) {
  const t = useTranslations("warnings");
  const tRoot = useTranslations();
  const locale = useLocale();
  if (!(activeCount > 0)) return null;

  return (
    <div role="alert" className="rounded-lg border border-warning/40 bg-warning/10 p-4" data-testid={`warnings-card-${scope}`}>
      <div className="flex items-start gap-2">
        <TriangleAlert className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-base font-semibold text-foreground" data-testid="warnings-card-title">
            {t(scope === "shop" ? "shopTitle" : "title", { count: activeCount, threshold })}
          </p>

          {warnings.length > 0 && (
            <ul className="mt-3 space-y-2">
              {warnings.map((w, i) => {
                const lead =
                  w.category === "prohibited_item"
                    ? w.listingTitle
                      ? t("removedProhibitedTitled", { title: w.listingTitle })
                      : t("removedProhibited")
                    : KNOWN_CATEGORIES.has(w.category)
                      ? tRoot(`report.reasons.${w.category}`)
                      : null;
                return (
                  <li key={i} className="rounded-md bg-background/60 p-2 text-sm" data-testid="warnings-card-item">
                    {lead && <span className="block font-medium">{lead}</span>}
                    {w.reason && <span className="block text-muted-foreground">{w.reason}</span>}
                    {w.createdAt && (
                      <span className="block text-xs text-muted-foreground">{formatRelativeDate(w.createdAt, locale)}</span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          <p className="mt-3 text-sm text-foreground" data-testid="warnings-card-rule">
            {t(scope === "shop" ? "ruleShop" : "ruleAccount", { threshold })}
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm" data-testid="warnings-card-rules">
              <Link href="/prohibited-items">{t("rulesLink")}</Link>
            </Button>
            {action}
          </div>
        </div>
      </div>
    </div>
  );
}

/** The signed-in user's own warnings on the profile — shown only when active > 0. */
export function WarningsBanner() {
  const t = useTranslations();
  const { status } = useAuth();
  const qc = useQueryClient();

  const { data } = useQuery({
    queryKey: ["warnings"],
    queryFn: getWarnings,
    enabled: status === "authed",
  });

  const seenMut = useMutation({
    mutationFn: markWarningsSeen,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["warnings"] }),
  });

  if (!data || data.activeCount === 0) return null;

  return (
    <WarningsCard
      scope="account"
      activeCount={data.activeCount}
      threshold={data.threshold}
      warnings={data.warnings.filter((w) => w.active)}
      action={
        <Button variant="outline" size="sm" disabled={seenMut.isPending} onClick={() => seenMut.mutate()}>
          {t("warnings.acknowledge")}
        </Button>
      }
    />
  );
}
