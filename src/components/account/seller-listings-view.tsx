"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useFormatter, useTranslations } from "next-intl";
import { PackageOpen, Plus } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { getMyListings } from "@/lib/api/me";
import type { Transaction } from "@/lib/types";
import {
  ListingGrid,
  ListingGridSkeleton,
} from "@/components/shared/listing-grid";
import { EmptyState } from "@/components/shared/empty-state";
import { listingExpiryState } from "@/components/shared/expiry-badge";
import { isLive } from "@/lib/stock";
import { ReviewPromptDialog } from "@/components/shared/review-prompt-dialog";
import { SegmentedControl } from "@/components/shared/segmented-control";
import { SellerListingActions } from "./seller-listing-actions";
import { Button } from "@/components/ui/button";

/**
 * THREE presented states, plus the two slices a seller actually navigates by.
 *
 * "Reserved" is deliberately NOT a tab. A held listing is Live with a badge on
 * it, not a fourth place to look — putting it in its own tab is what made a
 * seller's own held stock vanish from Active, so they had to know a hold existed
 * before they could find the listing it was on. It now sits under Active,
 * carrying its hold badge, exactly as the server's own "active" status filter
 * (`live.not_expired`) returns it.
 *
 * Note this list is filtered CLIENT-side over the seller's whole shop (see
 * `getMyListings`), so unlike mobile there was no backend tab query to widen in
 * lockstep — dropping the tab here is the entire change.
 */
const TABS = ["all", "active", "expired", "draft", "sold"] as const;
type Tab = (typeof TABS)[number];

const TAB_LABEL: Record<Tab, string> = {
  all: "listing.filter.all",
  active: "listing.filter.active",
  expired: "listing.filter.expired",
  draft: "listing.filter.draft",
  sold: "listing.filter.sold",
};

// An "expired" listing is an active one past its run. It lives under the Expired
// tab (not Active), so the two tabs are mutually exclusive.
//
// "Has it lapsed?" comes from the SHARED rule — the same `listingExpiryState()`
// the card's <ExpiryBadge> and `actionsFor()` use — never from the raw server
// flag. Rails leaves `expired: false` until something touches the record, so
// trusting the flag here filed a lapsed listing under Active while its own card
// showed a red "Expired" pill and offered Renew: the seller was told nothing had
// expired while looking at an expired card, and the Expired tab read (0).
function matchesTab(
  l: { status: string; expiresAt?: string | null; expired?: boolean },
  tab: Tab,
): boolean {
  if (tab === "all") return true;
  const lapsed = listingExpiryState(l).kind === "expired";
  if (tab === "expired") return lapsed;
  // LIVE, not `status === "active"`: both `active` and `reserved` are on the
  // market and belong in this tab. Testing the raw status left every held
  // listing with no tab to appear under once Reserved was removed.
  if (tab === "active") return isLive(l) && !lapsed;
  return l.status === tab;
}

export function SellerListingsView() {
  const t = useTranslations();
  const format = useFormatter();
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
  // One option per status, each carrying its own count. Counts are LOCALIZED
  // (`format.number`) so they match the "{count} listings" line above them —
  // Pashto and Dari render their own digits. A zero count shows no number rather
  // than "(0)": six zeros is noise on a shop the seller has just started.
  const tabOptions = useMemo(
    () =>
      TABS.map((key) => {
        const count = all.filter((l) => matchesTab(l, key)).length;
        return {
          value: key,
          label:
            count > 0
              ? `${t(TAB_LABEL[key])} (${format.number(count)})`
              : t(TAB_LABEL[key]),
        };
      }),
    [all, t, format],
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {t("sidebar.myListings")}
          </h1>
          {/* Gated on real DATA, not `!isPending`: in TanStack v5 `isPending` is
              false in the error state too, and `all` falls back to [] — so a
              failed load used to print "0 listings" directly above "Something
              went wrong". On the seller's inventory of record, a transport error
              must never be phrased as "you have nothing for sale". */}
          {data && (
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

      {/* Status tabs — the shared SegmentedControl (`wrap`, because six options
          with counts do not fit one row on a phone), not a hand-rolled pill row:
          it carries the tablist/tab/aria-selected roles a screen reader needs to
          tell six same-shaped buttons apart, the focus ring, and the same 40px
          tap target this screen enforces on every other control.

          Hidden on error — there is nothing to filter, no counts to show, and the
          error state should own the viewport (same as Hidden/Saved). */}
      {!isError && (
        <SegmentedControl<Tab>
          className="mb-6"
          wrap
          ariaLabel={t("listing.filter.label")}
          value={tab}
          onChange={setTab}
          options={tabOptions}
        />
      )}

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
          // This is the ONE surface that names a missing photo: the seller who
          // can fix it is the one reading the card. Buyer-facing grids (including
          // the public seller profile's Sold tab, which also sets `showStatus`)
          // keep the quiet placeholder.
          nameMissingPhoto
          showSave={false}
          hrefFor={(l) => `/my-listings/${l.id}`}
          // Inline lifecycle quick-actions: publish / mark sold / release hold /
          // renew / delete without opening the listing (the card body still links
          // to detail). No "reserve" — a hold is placed from the chat thread, for
          // the person it is for.
          footerFor={(l) => (
            <SellerListingActions
              listing={l}
              onSaleRecorded={setReviewTxn}
              // Undoing the sale from its toast must take the review prompt with
              // it: the transaction it points at no longer exists, so leaving it
              // open offers the seller a rating that would 404 on submit.
              onSaleUndone={() => setReviewTxn(null)}
            />
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
