"use client";

import { useLocale, useTranslations } from "next-intl";
import { UserAvatar } from "@/components/shared/user-avatar";
import { formatNumber } from "@/lib/format";
import type { TeamMemberNumbers, TeamNumbers } from "@/lib/api/analytics";

const KEYS = ["posted", "active", "expired", "sold"] as const;

function Numbers({ row, testId }: { row: TeamNumbers; testId: string }) {
  const t = useTranslations("seller.analytics.team");
  const locale = useLocale();
  return (
    <div className="mt-2 grid grid-cols-4 text-center">
      {KEYS.map((key) => (
        <div key={key} data-testid={`${testId}-${key}`}>
          <div className="text-base font-extrabold">{formatNumber(row[key], locale)}</div>
          <div className="truncate text-[11px] text-muted-foreground">{t(key)}</div>
        </div>
      ))}
    </div>
  );
}

/**
 * "Team" on a shop's numbers page (owner, 2026-10-08; mobile TeamBreakdown):
 * per member, products POSTED, active / expired of those, and the sales they
 * RECORDED. Every member sees the whole team. "Unknown or former member" only
 * when it holds something.
 */
export function TeamBreakdown({
  team,
  unattributed,
  meId,
}: {
  team: TeamMemberNumbers[];
  unattributed?: TeamNumbers | null;
  meId?: number;
}) {
  const t = useTranslations();
  const showOther = !!unattributed && KEYS.some((k) => unattributed[k] > 0);
  return (
    <section className="space-y-3" data-testid="analytics-team">
      <h2 className="text-base font-semibold">{t("seller.analytics.team.title")}</h2>
      {team.map((m) => (
        <div key={m.user.id} className="rounded-xl border bg-card p-3" data-testid={`analytics-team-${m.user.id}`}>
          <div className="flex items-center gap-2">
            <UserAvatar name={m.user.name} avatarUrl={m.user.avatarUrl} size={32} />
            <span className="min-w-0 flex-1 truncate text-sm font-bold" dir="auto">
              {m.user.id === meId ? t("seller.analytics.team.you") : m.user.name}
            </span>
            <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
              {t(`shops.roles.${m.role}`)}
            </span>
          </div>
          <Numbers row={m} testId={`analytics-team-${m.user.id}`} />
        </div>
      ))}
      {showOther && unattributed ? (
        <div className="rounded-xl border bg-card p-3" data-testid="analytics-team-other">
          <div className="text-sm font-semibold text-muted-foreground">{t("seller.analytics.team.other")}</div>
          <Numbers row={unattributed} testId="analytics-team-other" />
        </div>
      ) : null}
    </section>
  );
}
