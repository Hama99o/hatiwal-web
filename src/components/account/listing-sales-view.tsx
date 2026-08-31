"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { ArrowLeft, Receipt, TriangleAlert, UserX } from "lucide-react";
import { toast } from "sonner";
import { Link } from "@/i18n/navigation";
import { getListingSales, getMyListing } from "@/lib/api/me";
import type { Transaction } from "@/lib/types";
import { EmptyState } from "@/components/shared/empty-state";
import { UserIdentity } from "@/components/shared/user-identity";
import { PriceTag } from "@/components/shared/price-tag";
import { Button } from "@/components/ui/button";
import { formatRelativeDate } from "@/lib/format";
import { hasStockToShow, totalUnitsOf } from "@/lib/stock";
import { SaleRowEditDialog } from "./sale-row-edit-dialog";

/**
 * The SALES LEDGER for one listing — every unit that left the shelf, who took
 * it, and the way to fix any of it.
 *
 * This screen is the durable half of "undo, not correction forms". The mark-sold
 * toast's Undo covers the ten seconds after a mistake; this covers the week
 * after, with the same two endpoints behind it (`PATCH`/`DELETE
 * /my/transactions/:id`). There is deliberately no "correct a sale" form and no
 * "reopen listing" action anywhere in the product: editing a row restores the
 * stock, and Rails re-opens a listing that went sold-out by mistake as part of
 * the same write.
 *
 * MANY BUYERS PER BATCH is the thing this makes visible. A 15-unit listing can
 * be three units to Ahmad, five to Zainab and seven to a walk-in who is not on
 * Hatiwal at all — three rows, each with its own quantity, price and date, the
 * outside sale included (it has no counterparty, not no existence).
 */
export function ListingSalesView({ id }: { id: string }) {
  const t = useTranslations();
  const locale = useLocale();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Transaction | null>(null);

  // The listing itself, for the header tally and the quantity ceiling. Same
  // query key as the owner detail screen and the chat thread's owner probe, and
  // the same one the lifecycle brain invalidates — so a correction made here
  // repaints every one of them.
  const listingQ = useQuery({
    queryKey: ["my-listing", String(id)],
    queryFn: () => getMyListing(id),
  });
  const salesQ = useQuery({
    queryKey: ["listing-sales", String(id)],
    queryFn: () => getListingSales(id),
  });

  const listing = listingQ.data;
  const sales = salesQ.data ?? [];
  const multiUnit = hasStockToShow(listing);
  // Units actually accounted for by the ledger, not `quantity - availableUnits`:
  // the tally has to agree with the rows immediately below it, and after a
  // correction the two can disagree for one render while the listing refetches.
  const soldUnits = sales.reduce((sum, s) => sum + (s.quantity ?? 1), 0);

  function afterCorrection() {
    // Both queries this screen reads, plus everything the seller's other
    // surfaces show — a voided sale can put a sold listing back on the market,
    // which changes My Listings, the public feed and every open chat header.
    qc.invalidateQueries({ queryKey: ["listing-sales", String(id)] });
    qc.invalidateQueries({ queryKey: ["my-listing", String(id)] });
    qc.invalidateQueries({ queryKey: ["my-listings"] });
    qc.invalidateQueries({ queryKey: ["listings"] });
    qc.invalidateQueries({ queryKey: ["conversation"] });
    qc.invalidateQueries({ queryKey: ["conversations"] });
    setEditing(null);
  }

  if (salesQ.isPending || listingQ.isPending) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <div className="space-y-2" data-testid="sales-skeleton">
          {/* Row-shaped, not a spinner: the ledger is a list, and a skeleton that
              matches its shape means the content does not jump when it lands. */}
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="flex items-center gap-3 rounded-lg border p-3"
            >
              <div className="size-10 shrink-0 animate-pulse rounded-full bg-muted" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-32 animate-pulse rounded bg-muted" />
                <div className="h-3 w-20 animate-pulse rounded bg-muted" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (salesQ.isError || listingQ.isError || !listing) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <EmptyState
          icon={TriangleAlert}
          title={t("common.error")}
          action={{
            label: t("common.retry"),
            onClick: () => {
              void salesQ.refetch();
              void listingQ.refetch();
            },
          }}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <Button asChild variant="ghost" size="sm" className="mb-4 -ms-2">
        <Link href={`/my-listings/${id}`}>
          {/* Mirrored in RTL so "back" always points back. */}
          <ArrowLeft className="size-4 rtl:-scale-x-100" />
          {listing.title}
        </Link>
      </Button>

      <div className="mb-6 space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">
          {t("listing.salesScreen.title")}
        </h1>
        {/* The tally is a BATCH question ("how far through my 15 am I?"). A
            single-item listing's one sale needs no "1 of 1 sold". */}
        {multiUnit && (
          <p className="text-sm text-muted-foreground">
            {t("listing.sale.tally", {
              sold: soldUnits,
              total: totalUnitsOf(listing),
            })}
          </p>
        )}
      </div>

      {sales.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title={t("listing.salesScreen.empty")}
          description={t("listing.salesScreen.emptyHint")}
        />
      ) : (
        <ul className="space-y-2">
          {sales.map((sale) => {
            const units = sale.quantity ?? 1;
            return (
              <li key={sale.id}>
                {/* The whole row opens the editor. A row IS its correction
                    affordance — there is no separate edit icon, and no
                    swipe gesture to internationalise for RTL. */}
                <button
                  type="button"
                  data-testid="sale-row"
                  onClick={() => setEditing(sale)}
                  className="flex w-full items-center gap-3 rounded-lg border p-3 text-start transition-colors hover:bg-accent"
                >
                  {sale.buyer ? (
                    <UserIdentity
                      name={sale.buyer.name}
                      avatarUrl={sale.buyer.avatarUrl}
                      size={40}
                      subtitle={formatRelativeDate(
                        sale.completedAt ?? sale.createdAt,
                        locale,
                      )}
                    />
                  ) : (
                    /* Sold outside Hatiwal — a real sale with no counterparty
                       account. It gets its OWN label rather than an empty
                       identity: "no buyer recorded" reads like data was lost,
                       when in fact the seller deliberately said the buyer is
                       not on the app. */
                    <>
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                        <UserX className="size-4" />
                      </span>
                      <div className="min-w-0">
                        <span className="truncate font-semibold text-foreground">
                          {t("listing.sale.outsideBuyer")}
                        </span>
                        <span className="block truncate text-sm text-muted-foreground">
                          {formatRelativeDate(
                            sale.completedAt ?? sale.createdAt,
                            locale,
                          )}
                        </span>
                      </div>
                    </>
                  )}

                  <div className="ms-auto shrink-0 text-end">
                    <PriceTag
                      price={sale.finalPrice}
                      currency={sale.currency}
                      size="sm"
                      perUnit={multiUnit}
                    />
                    {/* Units only where units are a concept. */}
                    {multiUnit && (
                      <span className="block text-xs text-muted-foreground">
                        {t("listing.stock.unitsSoldCount", { count: units })}
                      </span>
                    )}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {editing && (
        <SaleRowEditDialog
          sale={editing}
          listing={listing}
          otherSoldUnits={soldUnits - (editing.quantity ?? 1)}
          onClose={() => setEditing(null)}
          onCorrected={afterCorrection}
          onVoided={() => {
            toast.success(t("listing.sale.voidedSuccess"));
            afterCorrection();
          }}
        />
      )}
    </div>
  );
}
