"use client";

import { useLocale, useTranslations } from "next-intl";
import { MoreHorizontal, MoreVertical, Pencil, Trash2 } from "lucide-react";
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
 * owner detail screen, and the same two-control shape mobile's
 * SellerListingCard uses (primary + overflow; see the kebab below for the one
 * deliberate difference).
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

  // The listing itself: the card renders an <ExpiryBadge> right above this
  // footer, and both now derive "lapsed" from the same shared rule — so a card
  // can never show the red "Expired" pill over a primary that isn't Renew.
  const { primary, secondary } = actionsFor(listing);

  return (
    <div className="flex items-center gap-2">
      {primary && (
        <Button
          size="sm"
          // `h-auto min-h-10` holds the house 40px tap target (the same floor the
          // Report/Share pair was raised to) while letting a long label WRAP
          // instead of being clipped — "Mark as Sold" and its ps/fa equivalents
          // must stay fully readable in a 2-column grid at 375px.
          //
          // `font-semibold sm:text-sm`: this is the loudest thing in the footer,
          // so it must not be set below the card's own meta line. It matches
          // mobile's primary (13px/700). 14px still wraps inside min-h-10 at the
          // narrowest case (375px, 2 columns).
          className="h-auto min-h-10 min-w-0 flex-1 whitespace-normal px-2 py-1 text-xs font-semibold leading-tight sm:text-sm"
          // Names the listing too: a shop of seven active items would otherwise
          // announce "Mark as Sold" seven times with nothing to tell them apart
          // (the kebab below carries the title for the same reason).
          aria-label={t("listing.detail.actionFor", {
            action: t(`listing.${LIFECYCLE[primary].label}`),
            title: listing.title,
          })}
          disabled={busy}
          onClick={() => ask(primary)}
        >
          {t(`listing.${LIFECYCLE[primary].label}`)}
        </Button>
      )}

      {/* Secondary transitions + Edit + Delete. `dir` keeps Radix's alignment
          mirrored for ps/fa. Two shapes:

          — beside a primary, a bare icon kebab whose aria-label carries the
            listing title (so a screen reader isn't read six identical "More
            options" buttons down the grid). This is a DELIBERATE deviation from
            mobile, which keeps the word in both shapes (SellerListingCard's
            compact More is a 92pt labelled button): a labelled More cannot sit
            beside "Mark as Sold" in a 2-column card at 375px, and the kebab is
            the native web idiom for an overflow menu — do not "restore parity"
            by putting the label back here.
          — on a terminal `sold` card, where it is the ONLY control, it takes the
            whole row and says "More options" (mobile does the same): an
            unlabeled glyph alone in a bordered row reads as a stray artifact and
            hides that Edit and Delete are still reachable. */}
      <DropdownMenu dir={isRtl(locale) ? "rtl" : "ltr"}>
        <DropdownMenuTrigger asChild disabled={busy}>
          <Button
            variant="outline"
            size="sm"
            // Visible text is the accessible name in the full-width shape, so the
            // title-bearing label is only needed for the icon-only one.
            aria-label={
              primary
                ? t("listing.detail.moreOptionsFor", { title: listing.title })
                : undefined
            }
            className={cn(
              primary
                ? "size-10 shrink-0 px-0"
                : "min-h-10 w-full justify-center gap-2",
            )}
          >
            {primary ? (
              <MoreVertical className="size-4" />
            ) : (
              <>
                <MoreHorizontal className="size-4" />
                {t("listing.detail.moreOptions")}
              </>
            )}
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
