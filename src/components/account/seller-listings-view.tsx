"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { PackageOpen, Plus } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { getMyListings } from "@/lib/api/me";
import type { Transaction } from "@/lib/types";
import {
  ListingGrid,
  ListingGridSkeleton,
} from "@/components/shared/listing-grid";
import { EmptyState } from "@/components/shared/empty-state";
import { ReviewPromptDialog } from "@/components/shared/review-prompt-dialog";
import { SellerListingActions } from "./seller-listing-actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const TABS = ["all", "active", "expired", "draft", "reserved", "sold"] as const;
type Tab = (typeof TABS)[number];

const TAB_LABEL: Record<Tab, string> = {
  all: "listing.filter.all",
  active: "listing.filter.active",
  expired: "listing.filter.expired",
  draft: "listing.filter.draft",
  reserved: "listing.filter.reserved",
  sold: "listing.filter.sold",
};

// An "expired" listing is an active one past its 30-day run. It lives under the
// Expired tab (not Active), so the two tabs are mutually exclusive.
function matchesTab(l: { status: string; expired?: boolean }, tab: Tab): boolean {
  if (tab === "all") return true;
  if (tab === "expired") return l.status === "active" && !!l.expired;
  if (tab === "active") return l.status === "active" && !l.expired;
  return l.status === tab;
}

export function SellerListingsView() {
  const t = useTranslations();
  const [tab, setTab] = useState<Tab>("all");
  // REV2: a sale that recorded a real buyer → rate them straight away. Owned
  // HERE, not by the card: marking an item sold drops it out of the Active tab
  // as soon as the grid refetches, and a prompt living in that card would be
  // unmounted with it before the seller could rate anyone.
  const [reviewTxn, setReviewTxn] = useState<Transaction | null>(null);
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ["my-listings"],
    queryFn: getMyListings,
  });

  const all = useMemo(() => data ?? [], [data]);
  const filtered = useMemo(
    () => all.filter((l) => matchesTab(l, tab)),
    [all, tab],
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {t("sidebar.myListings")}
          </h1>
          {!isPending && (
            <p className="text-sm text-muted-foreground">
              {t("listing.shopCount", { count: all.length })}
            </p>
          )}
        </div>
        <Button asChild>
          <Link href="/listings/new">
            <Plus className="size-4" />
            {t("sidebar.createListing")}
          </Link>
        </Button>
      </div>

      {/* Status tabs */}
      <div className="mb-6 flex flex-wrap gap-2 border-b pb-3">
        {TABS.map((key) => {
          const count = all.filter((l) => matchesTab(l, key)).length;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={cn(
                "rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
                tab === key
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              {t(TAB_LABEL[key])}
              {count > 0 ? ` (${count})` : ""}
            </button>
          );
        })}
      </div>

      {isError ? (
        // The house error pattern (same as Hidden/Saved/Recently-viewed/Chat):
        // friendly message + a retry, never a bare "Error". This screen is where
        // a seller ACTS on their listings, so a failed load must not dead-end
        // them into a manual page reload.
        <EmptyState
          icon={PackageOpen}
          title={t("common.errorTitle")}
          description={t("common.errorDescription")}
          action={{ label: t("common.retry"), onClick: () => refetch() }}
        />
      ) : isPending ? (
        // `withFooter`: every card here carries the inline action row, so the
        // placeholder has to reserve its height or all 10 cards jump taller the
        // moment the query resolves.
        <ListingGridSkeleton count={10} withFooter />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={PackageOpen}
          title={
            all.length === 0
              ? t("listing.emptyAll.title")
              : t("listing.emptyFiltered.title", { status: t(TAB_LABEL[tab]) })
          }
          description={
            all.length === 0 ? t("listing.emptyAll.description") : undefined
          }
          action={
            all.length === 0
              ? { label: t("sidebar.createListing"), href: "/listings/new" }
              : undefined
          }
        />
      ) : (
        <ListingGrid
          listings={filtered}
          showStatus
          showSave={false}
          hrefFor={(l) => `/my-listings/${l.id}`}
          // Inline lifecycle quick-actions: publish/reserve/sold/renew/delete
          // without opening the listing (the card body still links to detail).
          footerFor={(l) => (
            <SellerListingActions listing={l} onSaleRecorded={setReviewTxn} />
          )}
        />
      )}

      {reviewTxn && (
        <ReviewPromptDialog
          transaction={reviewTxn}
          // Only the owner sells, so the caller is always the seller (the
          // lifecycle payload's own `role` is null — no current_user).
          role="seller"
          onClose={() => setReviewTxn(null)}
        />
      )}
    </div>
  );
}
