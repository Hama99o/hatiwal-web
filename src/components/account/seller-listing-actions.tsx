"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { MoreVertical, Pencil, Trash2 } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { isRtl } from "@/i18n/routing";
import type { Listing, Transaction } from "@/lib/types";
import {
  LIFECYCLE,
  actionsFor,
  dialogKeysFor,
  needsBuyerPicker,
  useListingLifecycle,
  type PendingAction,
} from "./listing-actions";
import { SellBuyerDialog } from "./sell-buyer-dialog";
import { ReviewPromptDialog } from "@/components/shared/review-prompt-dialog";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
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
 * Delete. The transitions, labels, confirm copy and the mutation itself all come
 * from the shared brain in ./listing-actions — identical behaviour to the owner
 * detail screen, and mirrors mobile's SellerListingCard.
 */
export function SellerListingActions({ listing }: { listing: Listing }) {
  const t = useTranslations();
  const locale = useLocale();
  const [pending, setPending] = useState<PendingAction>(null);
  // REV2: a sold sale that recorded a real buyer → rate them straight away.
  const [reviewTxn, setReviewTxn] = useState<Transaction | null>(null);
  const { busy, runLifecycle, runDelete } = useListingLifecycle(listing.id);

  const { primary, secondary } = actionsFor(listing.status, !!listing.expired);
  const buyerFlow = needsBuyerPicker(pending);
  const keys = dialogKeysFor(pending);

  // Confirm-dialog path: delete + the non-buyer lifecycle actions.
  async function runPending() {
    if (!pending) return;
    if (pending.kind === "delete") {
      // On success the ['my-listings'] invalidation drops this card entirely;
      // on failure the dialog stays open (with an error toast) to retry.
      if (await runDelete()) setPending(null);
      return;
    }
    if (await runLifecycle(pending.action)) setPending(null);
  }

  // Buyer-picker path: reserve/sold with an optional buyer + final price.
  async function submitSale(buyerId: number | null, finalPrice: number | null) {
    if (pending?.kind !== "lifecycle") return;
    const action = pending.action;
    const result = await runLifecycle(action, {
      buyerId: buyerId ?? undefined,
      finalPrice: finalPrice ?? undefined,
    });
    if (!result) return;
    setPending(null);
    if (action === "sold" && result.transaction) setReviewTxn(result.transaction);
  }

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
          onClick={() => setPending({ kind: "lifecycle", action: primary })}
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
          {secondary.map((action) => (
            <DropdownMenuItem
              key={action}
              onSelect={() => setPending({ kind: "lifecycle", action })}
            >
              {t(`listing.${LIFECYCLE[action].label}`)}
            </DropdownMenuItem>
          ))}
          <DropdownMenuItem asChild>
            <Link href={`/listings/${listing.id}/edit`}>
              <Pencil className="size-4" />
              {t("common.edit")}
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onSelect={() => setPending({ kind: "delete" })}
          >
            <Trash2 className="size-4" />
            {t("common.delete")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {keys && !buyerFlow && (
        <ConfirmDialog
          open
          title={t(keys.title)}
          description={t(keys.desc)}
          confirmLabel={t(keys.confirm)}
          cancelLabel={t("common.cancel")}
          destructive={keys.destructive}
          loading={busy}
          onConfirm={runPending}
          onCancel={() => !busy && setPending(null)}
        />
      )}

      {buyerFlow && pending?.kind === "lifecycle" && (
        <SellBuyerDialog
          action={pending.action as "reserve" | "sold"}
          listingId={listing.id}
          busy={busy}
          onCancel={() => !busy && setPending(null)}
          onConfirm={submitSale}
        />
      )}

      {reviewTxn && (
        <ReviewPromptDialog
          transaction={reviewTxn}
          // Only the owner reserves/sells, so the caller is always the seller
          // (the lifecycle payload's own `role` is null — no current_user).
          role="seller"
          onClose={() => setReviewTxn(null)}
        />
      )}
    </div>
  );
}
