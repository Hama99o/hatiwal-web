"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import {
  Eye,
  Loader2,
  MessageSquare,
  Pencil,
  Receipt,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { Link, useRouter } from "@/i18n/navigation";
import { getMyListing } from "@/lib/api/me";
import type { Transaction } from "@/lib/types";
import {
  LIFECYCLE,
  LifecycleDialogs,
  actionsFor,
  hasSalesToShow,
  useListingLifecycle,
} from "./listing-actions";
import { ReviewPromptDialog } from "@/components/shared/review-prompt-dialog";
import { ListingGallery } from "@/components/listing/listing-gallery";
import { ListingViewsChart } from "./listing-views-chart";
import { PriceTag } from "@/components/shared/price-tag";
import { StatusBadge } from "@/components/shared/status-badge";
import { ConditionBadge } from "@/components/shared/condition-badge";
import { ExpiryBadge } from "@/components/shared/expiry-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { availableUnitsOf, hasStockToShow } from "@/lib/stock";
import { StockBadge } from "@/components/shared/stock-badge";

export function ManageListingView({ id }: { id: string }) {
  const t = useTranslations();
  const router = useRouter();
  const {
    data: listing,
    isPending,
    isError,
  } = useQuery({ queryKey: ["my-listing", id], queryFn: () => getMyListing(id) });

  // After a sale with a buyer, prompt the seller to review them right away.
  const [reviewTxn, setReviewTxn] = useState<Transaction | null>(null);
  // The shared lifecycle brain owns the pending-action state, the API call,
  // toasts, cache invalidation and the busy flag (see ./listing-actions).
  const lifecycle = useListingLifecycle(listing?.id ?? 0, {
    title: listing?.title,
    remainingQuantity: availableUnitsOf(listing),
    onDeleted: () => router.push("/my-listings"),
    onSaleRecorded: setReviewTxn,
    // An undone sale takes its review prompt with it — the transaction it points
    // at is gone, so submitting the rating would 404.
    onSaleUndone: () => setReviewTxn(null),
  });
  const { busy, ask } = lifecycle;

  if (isPending) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (isError || !listing) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <EmptyState icon={TriangleAlert} title={t("common.error")} />
      </div>
    );
  }

  // The listing itself, so the transition agrees with the <ExpiryBadge> a few
  // lines above it: both read the shared `listingExpiryState` rule (a lapsed
  // `active` listing offers Renew, never "Mark as Sold" beside a red pill).
  const { primary, secondary } = actionsFor(listing);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="grid gap-8 lg:grid-cols-2">
        <ListingGallery images={listing.images} title={listing.title} />

        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={listing.status} />
            <ExpiryBadge
              status={listing.status}
              expiresAt={listing.expiresAt}
              expired={listing.expired}
            />
            {listing.condition && <ConditionBadge condition={listing.condition} />}
          </div>

          <div className="space-y-2">
            <PriceTag
              price={listing.price}
              currency={listing.currency}
              size="lg"
              perUnit={hasStockToShow(listing)}
            />
            {/* Owner phrasing ("12 of 15 left"): the seller's question is "how
                do I know when they're all gone?", not "how many can I buy?". */}
            <StockBadge listing={listing} owner />
            <h1 className="text-pretty text-xl font-bold sm:text-2xl">
              {listing.title}
            </h1>
          </div>

          {/* Two counts on one line, so it is the row where a digit-set
              disagreement is most visible (`e2e/i18n-digits.spec.ts` asserts the
              whole row, hence the testid): `viewsCount` is a typed `{count,
              number}` placeholder and `conversationsCount` a plural `#`, and both
              have to land on the locale's own digits beside the PriceTag above. */}
          <div
            data-testid="manage-listing-stats"
            className="flex flex-wrap gap-4 text-sm text-muted-foreground"
          >
            <span className="inline-flex items-center gap-1.5">
              <Eye className="size-4" />
              {t("listing.viewsCount", { count: listing.viewsCount })}
            </span>
            <Link
              href={`/conversations?listing=${listing.id}`}
              className="inline-flex items-center gap-1.5 text-primary hover:underline"
            >
              <MessageSquare className="size-4" />
              {t("listing.conversationsCount", {
                count: listing.conversationsCount ?? 0,
              })}
            </Link>
          </div>

          {/* Lifecycle actions */}
          <div className="space-y-2">
            {primary && (
              <Button
                className="w-full"
                disabled={busy}
                onClick={() => ask(primary)}
              >
                {t(`listing.${LIFECYCLE[primary].label}`)}
              </Button>
            )}
            {secondary.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {secondary.map((a) => {
                  // Same glyph per transition as the card kebab and mobile.
                  const { label, Icon } = LIFECYCLE[a];
                  return (
                    <Button
                      key={a}
                      variant="outline"
                      size="sm"
                      disabled={busy}
                      onClick={() => ask(a)}
                    >
                      <Icon className="size-4" />
                      {t(`listing.${label}`)}
                    </Button>
                  );
                })}
              </div>
            )}
          </div>

          {/* The sales ledger — many buyers per batch, each its own editable
              row, and the durable way to fix a mistake once the mark-sold
              toast's Undo has gone. Offered the moment any unit has sold. */}
          {hasSalesToShow(listing) && (
            <Button asChild variant="outline" className="w-full">
              <Link href={`/my-listings/${listing.id}/sales`}>
                <Receipt className="size-4" />
                {t("listing.viewSales")}
              </Link>
            </Button>
          )}

          <div className="flex gap-2 border-t pt-4">
            <Button asChild variant="secondary" className="flex-1">
              <Link href={`/listings/${listing.id}/edit`}>
                <Pencil className="size-4" />
                {t("common.edit")}
              </Link>
            </Button>
            <Button
              variant="ghost"
              className="text-destructive hover:text-destructive"
              disabled={busy}
              onClick={() => ask("delete")}
            >
              <Trash2 className="size-4" />
              {t("common.delete")}
            </Button>
          </div>
        </div>
      </div>

      {listing.description && (
        <section className="mt-8 max-w-3xl">
          <h2 className="mb-2 text-lg font-semibold">
            {t("listing.detail.description")}
          </h2>
          <p className="whitespace-pre-line text-sm leading-relaxed text-foreground">
            {listing.description}
          </p>
        </section>
      )}

      <ListingViewsChart id={listing.id} />

      <LifecycleDialogs lifecycle={lifecycle} />

      {reviewTxn && (
        <ReviewPromptDialog
          transaction={reviewTxn}
          // The caller here is always the seller (only the owner reserves/sells),
          // and the lifecycle payload's own `role` is null (serialized without a
          // current_user), so state it explicitly.
          role="seller"
          onClose={() => setReviewTxn(null)}
        />
      )}
    </div>
  );
}
