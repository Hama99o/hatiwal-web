"use client";

import { useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { TriangleAlert } from "lucide-react";
import { Link, useRouter } from "@/i18n/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import { useSellingIdentity } from "@/components/shops/use-selling-identity";
import { UserAvatar } from "@/components/shared/user-avatar";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { formatNumber } from "@/lib/format";
import { useSellerAnalytics } from "./use-seller-analytics";
import { TeamBreakdown } from "./team-breakdown";

type Tab = "active" | "expired" | "sold" | "all";

/**
 * Seller numbers — ONE identity: Me or one shop the user is on (owner,
 * 2026-10-12; hatiwal-mobile docs/design/SELLER_ANALYTICS.md). Never global.
 * `?shop=<id>` (from the shop page), `?shop=me`, or none: whoever the user
 * sells as now (from Profile). Web twin of mobile's SellerAnalytics screen.
 */
export function SellerAnalyticsView() {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const { user } = useAuth();
  const { sellingAs, shops, switchToAsync } = useSellingIdentity();
  const param = useSearchParams().get("shop");
  const shopId =
    param === "me" ? null : param && /^\d+$/.test(param) ? Number(param) : sellingAs?.id ?? null;
  const shopCard = shopId != null ? shops.find((s) => s.id === shopId) ?? null : null;

  const { data, isPending, isError, refetch, relaunchAll } = useSellerAnalytics(shopId);
  const [confirming, setConfirming] = useState(false);

  const name = shopId != null ? data?.shop?.name ?? shopCard?.name ?? "" : t("shops.me");
  const logo = shopId != null ? data?.shop?.logoUrl ?? shopCard?.logoUrl ?? null : user?.avatarUrl ?? null;
  const n = (v: number) => formatNumber(v, locale);

  // A tile opens its My listings tab — as this identity, switching first.
  async function openTab(tab: Tab) {
    if ((sellingAs?.id ?? null) !== shopId) await switchToAsync(shopId);
    router.push(`/my-listings?status=${tab}`);
  }

  const tile = (tab: Tab, label: string, value: number, extra?: ReactNode) => (
    <div className="flex flex-col gap-1 rounded-xl border bg-card p-4" data-testid={`analytics-tile-${tab}`}>
      <button
        type="button"
        onClick={() => void openTab(tab)}
        className="flex flex-col items-start gap-1 text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={`${label}: ${n(value)}`}
      >
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
        <span className="text-2xl font-extrabold" data-testid={`analytics-value-${tab}`}>
          {n(value)}
        </span>
      </button>
      {extra}
    </div>
  );

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-8" data-testid="seller-analytics">
      <h1 className="text-title font-extrabold">{t("seller.analytics.title")}</h1>

      {/* Whose numbers these are — never ambiguous. */}
      <div className="flex items-center gap-3" data-testid="analytics-identity">
        <UserAvatar variant={shopId != null ? "shop" : "user"} name={name || "?"} avatarUrl={logo} size={48} />
        <div className="min-w-0">
          <p className="truncate text-lg font-semibold">{name}</p>
          <p className="text-sm text-muted-foreground">
            {shopId != null ? t("seller.analytics.forShop") : t("seller.analytics.forMe")}
          </p>
        </div>
      </div>

      {isPending ? (
        <div className="grid grid-cols-2 gap-3" data-testid="analytics-loading">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : isError || !data ? (
        <EmptyState
          icon={TriangleAlert}
          title={t("common.error")}
          action={{ label: t("common.retry"), onClick: () => void refetch() }}
        />
      ) : (
        <>
          <section className="space-y-3">
            <h2 className="text-base font-semibold">{t("seller.analytics.listings")}</h2>
            <div className="grid grid-cols-2 gap-3">
              {tile("active", t("seller.analytics.active"), data.active)}
              {tile(
                "sold",
                t("seller.analytics.sold"),
                data.sold,
                data.sales > data.sold ? (
                  <span className="text-xs text-muted-foreground">
                    {t("seller.analytics.sales", { count: data.sales })}
                  </span>
                ) : null,
              )}
              {tile(
                "expired",
                t("seller.analytics.expired"),
                data.expired,
                data.expired > 0 ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-1 w-fit"
                    disabled={relaunchAll.isPending}
                    onClick={() => setConfirming(true)}
                    data-testid="analytics-relaunch-all"
                  >
                    {t("seller.analytics.relaunchAll")}
                  </Button>
                ) : null,
              )}
              {tile(
                "all",
                t("seller.analytics.total"),
                data.total,
                data.draft > 0 ? (
                  <span className="text-xs text-muted-foreground">
                    {t("seller.analytics.drafts", { count: data.draft })}
                  </span>
                ) : null,
              )}
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold">{t("seller.analytics.reach")}</h2>
            <div className="grid grid-cols-2 divide-x rounded-xl border bg-card py-4 text-center rtl:divide-x-reverse">
              <div data-testid="analytics-views">
                <div className="text-xl font-extrabold">{n(data.views)}</div>
                <div className="text-xs text-muted-foreground">{t("seller.analytics.views")}</div>
              </div>
              <div data-testid="analytics-chats">
                <div className="text-xl font-extrabold">{n(data.chats)}</div>
                <div className="text-xs text-muted-foreground">{t("seller.analytics.chats")}</div>
              </div>
            </div>
          </section>

          {/* A shop: who on the team did what (owner, 2026-10-08). */}
          {data.team && data.team.length > 0 ? (
            <TeamBreakdown team={data.team} unattributed={data.teamUnattributed} meId={user?.id} />
          ) : null}

          <ConfirmDialog
            open={confirming}
            title={t("seller.analytics.relaunchAllTitle", { count: data.expired })}
            description={t("seller.analytics.relaunchAllBody")}
            confirmLabel={t("seller.analytics.relaunchAll")}
            cancelLabel={t("common.cancel")}
            loading={relaunchAll.isPending}
            onConfirm={() => relaunchAll.mutate(undefined, { onSettled: () => setConfirming(false) })}
            onCancel={() => setConfirming(false)}
          />
        </>
      )}

      <p className="text-sm">
        <Link href="/my-listings" className="text-primary hover:underline">
          {t("seller.analytics.openListings")}
        </Link>
      </p>
    </div>
  );
}
