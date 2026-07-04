"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { PackageOpen, ShoppingBag, Tag } from "lucide-react";
import { getSoldListings } from "@/lib/api/listings";
import type { Listing } from "@/lib/types";
import {
  ListingGrid,
  ListingGridSkeleton,
} from "@/components/shared/listing-grid";
import { EmptyState } from "@/components/shared/empty-state";
import { SegmentedControl } from "@/components/shared/segmented-control";

type Tab = "active" | "sold";

/**
 * Active / Sold segmented control for the public seller profile (F742, mobile
 * parity). The Active grid is server-rendered and passed in; the Sold grid is
 * lazy-loaded via TanStack Query the first time the Sold tab is opened (matching
 * the mobile per-tab fetch), reusing the guest-accessible
 * `GET /users/:id/sold_listings` endpoint. Sold cards show a dimmed status badge.
 */
export function SellerListingsTabs({
  sellerId,
  activeListings,
}: {
  sellerId: number;
  activeListings: Listing[];
}) {
  const t = useTranslations();
  const [tab, setTab] = useState<Tab>("active");

  const {
    data: sold,
    isPending: soldPending,
    isError: soldError,
  } = useQuery({
    queryKey: ["seller-sold-listings", sellerId],
    queryFn: () => getSoldListings(sellerId),
    enabled: tab === "sold",
  });

  return (
    <div className="mt-8">
      <SegmentedControl<Tab>
        className="max-w-sm"
        fullWidth
        ariaLabel={t("seller.tabs.label")}
        value={tab}
        onChange={setTab}
        options={[
          { value: "active", label: t("seller.tabs.active"), icon: ShoppingBag },
          { value: "sold", label: t("seller.tabs.sold"), icon: Tag },
        ]}
      />

      <div className="mt-6">
        {tab === "active" ? (
          activeListings.length > 0 ? (
            <ListingGrid listings={activeListings} priorityCount={5} />
          ) : (
            <EmptyState icon={PackageOpen} title={t("seller.noListings")} />
          )
        ) : soldError ? (
          <EmptyState icon={PackageOpen} title={t("common.error")} />
        ) : soldPending ? (
          <ListingGridSkeleton count={5} />
        ) : sold && sold.items.length > 0 ? (
          <ListingGrid listings={sold.items} showStatus priorityCount={5} />
        ) : (
          <EmptyState icon={Tag} title={t("seller.noSoldListings")} />
        )}
      </div>
    </div>
  );
}
