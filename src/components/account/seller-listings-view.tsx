"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { PackageOpen, Plus } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { getMyListings } from "@/lib/api/me";
import type { ListingStatus } from "@/lib/types";
import {
  ListingGrid,
  ListingGridSkeleton,
} from "@/components/shared/listing-grid";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const TABS = ["all", "active", "draft", "reserved", "sold"] as const;
type Tab = (typeof TABS)[number];

const TAB_LABEL: Record<Tab, string> = {
  all: "listing.filter.all",
  active: "listing.filter.active",
  draft: "listing.filter.draft",
  reserved: "listing.filter.reserved",
  sold: "listing.filter.sold",
};

export function SellerListingsView() {
  const t = useTranslations();
  const [tab, setTab] = useState<Tab>("all");
  const { data, isPending, isError } = useQuery({
    queryKey: ["my-listings"],
    queryFn: getMyListings,
  });

  const all = useMemo(() => data ?? [], [data]);
  const filtered = useMemo(
    () => (tab === "all" ? all : all.filter((l) => l.status === (tab as ListingStatus))),
    [all, tab],
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {t("profile.quickActions.myListings")}
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
            {t("listing.postListing")}
          </Link>
        </Button>
      </div>

      {/* Status tabs */}
      <div className="mb-6 flex flex-wrap gap-2 border-b pb-3">
        {TABS.map((key) => {
          const count =
            key === "all" ? all.length : all.filter((l) => l.status === key).length;
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
        <EmptyState icon={PackageOpen} title={t("common.error")} />
      ) : isPending ? (
        <ListingGridSkeleton count={10} />
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
              ? { label: t("listing.postListing"), href: "/listings/new" }
              : undefined
          }
        />
      ) : (
        <ListingGrid
          listings={filtered}
          showStatus
          hrefFor={(l) => `/my-listings/${l.id}`}
        />
      )}
    </div>
  );
}
