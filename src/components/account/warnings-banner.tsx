"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { TriangleAlert } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { getWarnings, markWarningsSeen } from "@/lib/api/warnings";
import { formatRelativeDate } from "@/lib/format";
import { Button } from "@/components/ui/button";

// Warning categories reuse the report-reason vocabulary, so translate via the
// existing `report.reasons.*` keys; fall back to the raw value otherwise.
const KNOWN_CATEGORIES = new Set([
  "spam",
  "inappropriate",
  "fraud",
  "wrong_category",
  "prohibited_item",
  "other",
]);

/** Moderation warnings banner on the profile — shown only when active > 0. */
export function WarningsBanner() {
  const t = useTranslations();
  const locale = useLocale();
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

  const active = data.warnings.filter((w) => w.active);

  return (
    <div className="rounded-lg border border-warning/40 bg-warning/10 p-4">
      <div className="flex items-start gap-2">
        <TriangleAlert className="mt-0.5 size-5 shrink-0 text-warning" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">
            {t("warnings.title")}
          </p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {t("warnings.body", {
              count: data.activeCount,
              threshold: data.threshold,
            })}
          </p>

          <ul className="mt-3 space-y-2">
            {active.map((w) => (
              <li key={w.id} className="rounded-md bg-background/60 p-2 text-sm">
                <span className="font-medium">
                  {KNOWN_CATEGORIES.has(w.category)
                    ? t(`report.reasons.${w.category}`)
                    : w.category}
                </span>
                {w.reason ? (
                  <span className="text-muted-foreground"> — {w.reason}</span>
                ) : null}
                <span className="block text-xs text-muted-foreground">
                  {formatRelativeDate(w.createdAt, locale)}
                </span>
              </li>
            ))}
          </ul>

          <Button
            variant="outline"
            size="sm"
            className="mt-3"
            disabled={seenMut.isPending}
            onClick={() => seenMut.mutate()}
          >
            {t("warnings.acknowledge")}
          </Button>
        </div>
      </div>
    </div>
  );
}
