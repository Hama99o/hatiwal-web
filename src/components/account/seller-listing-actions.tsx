"use client";

import { useLocale, useTranslations } from "next-intl";
import { MoreVertical, Pencil, Trash2 } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { isRtl } from "@/i18n/routing";
import type { Listing, Transaction } from "@/lib/types";
import {
  LIFECYCLE,
  LifecycleDialogs,
  actionsFor,
  useListingLifecycle,
} from "./listing-actions";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

/**
 * Inline lifecycle quick-actions for one card on /my-listings — the seller acts
 * where they are looking instead of round-tripping through /my-listings/[id].
 *
 * Rendered as the shared ListingCard's `footer`: one primary button (the most
 * likely next step) plus a kebab with the remaining transitions, Edit and
 * Delete. The transitions, labels, confirm copy, prompts and the mutation all
 * come from the shared brain in ./listing-actions — identical behaviour to the
 * owner detail screen, and mirrors mobile's SellerListingCard.
 *
 * `onSaleRecorded` is handed up to the LIST, not handled here: a sold listing
 * drops out of the Active tab the moment the grid refetches, which unmounts
 * this row — the review prompt has to be owned by something that outlives it.
 */
export function SellerListingActions({
  listing,
  onSaleRecorded,
}: {
  listing: Listing;
  onSaleRecorded?: (transaction: Transaction) => void;
}) {
  const t = useTranslations();
  const locale = useLocale();
  // `title` makes every prompt name the listing — the dialog opens over the grid
  // and hides the card that was clicked.
  const lifecycle = useListingLifecycle(listing.id, {
    title: listing.title,
    onSaleRecorded,
  });
  const { busy, ask } = lifecycle;

  const { primary, secondary } = actionsFor(listing.status, !!listing.expired);

  return (
    <div className="flex items-center gap-2">
      {primary && (
        <Button
          size="sm"
          // `h-auto min-h-9` keeps the 36px minimum touch target while letting a
          // long label WRAP instead of being clipped — "Mark as Sold" and its
          // ps/fa equivalents must stay fully readable in a 2-column grid.
          className="h-auto min-h-9 min-w-0 flex-1 whitespace-normal px-2 py-1 text-xs leading-tight"
          disabled={busy}
          onClick={() => ask(primary)}
        >
          {t(`listing.${LIFECYCLE[primary].label}`)}
        </Button>
      )}

      {/* Secondary transitions + Edit + Delete. `dir` keeps Radix's alignment
          mirrored for ps/fa; `ms-auto` parks the kebab at the row's end when a
          sold (terminal) listing has no primary action. The label carries the
          listing title so a screen reader isn't read six identical "More
          options" buttons down the grid. */}
      <DropdownMenu dir={isRtl(locale) ? "rtl" : "ltr"}>
        <DropdownMenuTrigger asChild disabled={busy}>
          <Button
            variant="outline"
            size="sm"
            aria-label={t("listing.detail.moreOptionsFor", {
              title: listing.title,
            })}
            className={cn("size-9 shrink-0 px-0", !primary && "ms-auto")}
          >
            <MoreVertical className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-[11rem]">
          {secondary.map((action) => {
            const { label, Icon } = LIFECYCLE[action];
            return (
              <DropdownMenuItem key={action} onSelect={() => ask(action)}>
                <Icon className="size-4" />
                {t(`listing.${label}`)}
              </DropdownMenuItem>
            );
          })}
          <DropdownMenuItem asChild>
            <Link href={`/listings/${listing.id}/edit`}>
              <Pencil className="size-4" />
              {t("common.edit")}
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onSelect={() => ask("delete")}
          >
            <Trash2 className="size-4" />
            {t("common.delete")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <LifecycleDialogs lifecycle={lifecycle} />
    </div>
  );
}
