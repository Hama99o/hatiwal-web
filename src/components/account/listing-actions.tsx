"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  CircleCheckBig,
  Clock,
  EyeOff,
  LockOpen,
  RefreshCw,
  Upload,
  type LucideIcon,
} from "lucide-react";
import {
  listingLifecycle,
  deleteMyListing,
  voidMySale,
  type LifecycleAction,
  type LifecycleResult,
} from "@/lib/api/me";
import type { Listing, Transaction } from "@/lib/types";
import { listingExpiryState } from "@/components/shared/expiry-badge";
import { hasOpenHold, hasSoldSome, isLive } from "@/lib/stock";
import { apiErrorMessage } from "@/lib/api/error-codes";
import {
  SellBuyerDialog,
  type PreselectedBuyer,
} from "./sell-buyer-dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

/**
 * THE seller lifecycle brain — the single source of truth for "what can I do to
 * this listing, what is it called, what do I confirm, and what happens when I
 * do it".
 *
 * Imported by BOTH the owner detail screen (`manage-listing-view.tsx`) and the
 * inline card quick-actions (`seller-listing-actions.tsx`) so the two can never
 * drift: the copy map, the transition resolver, the pending-action state
 * machine, the mutation and its prompts all live here. A surface only supplies
 * its own buttons. Never copy any of it into a component — extend it here.
 */

/**
 * Per-transition copy (i18n key suffixes under the `listing.` namespace) + the
 * icon that stands for it. The icons mirror mobile's `useListingLifecycle`
 * action rows one-for-one (sold→CircleCheckBig, reserve→Clock,
 * unpublish→EyeOff, activate→LockOpen) so a seller who uses both clients reads
 * the same glyph for the same move.
 *
 * `activate` KEEPS ITS KEY and its endpoint (`PUT /my/listings/:id/activate`)
 * and changes only what it is CALLED: "Release hold". The route already does
 * exactly the right thing — cancel the open hold, put the listing back to plain
 * `active` — and renaming a working endpoint across three clients would be pure
 * churn. So the wire says `activate`, the seller reads "Release hold", and the
 * two are the same move.
 */
export const LIFECYCLE: Record<
  LifecycleAction,
  { label: string; success: string; title: string; desc: string; Icon: LucideIcon }
> = {
  publish: {
    label: "publish",
    success: "publishSuccess",
    title: "confirmPublish",
    desc: "confirmPublishDescription",
    Icon: Upload,
  },
  unpublish: {
    label: "unpublish",
    success: "unpublishSuccess",
    title: "confirmUnpublish",
    desc: "confirmUnpublishDescription",
    Icon: EyeOff,
  },
  // Reached ONLY from a chat thread now, as "place a hold" — so the copy is
  // hold copy, not the old "Mark as Reserved" state language. The endpoint and
  // the action key are unchanged; a hold is what reserving always meant, and
  // naming it after the person it is for is what the seller understands.
  reserve: {
    label: "placeHold",
    success: "holdPlacedSuccess",
    title: "confirmPlaceHold",
    desc: "confirmPlaceHoldDescription",
    Icon: Clock,
  },
  activate: {
    label: "releaseHold",
    success: "releaseHoldSuccess",
    title: "confirmReleaseHold",
    desc: "confirmReleaseHoldDescription",
    Icon: LockOpen,
  },
  sold: {
    label: "markSold",
    success: "markSoldSuccess",
    title: "confirmMarkSold",
    desc: "markSoldConfirm",
    Icon: CircleCheckBig,
  },
  renew: {
    label: "renew",
    success: "renewSuccess",
    title: "confirmRenew",
    desc: "confirmRenewDescription",
    Icon: RefreshCw,
  },
};

/**
 * Which transitions a listing offers. `primary` is the single most likely next
 * step; `secondary` are the other legal moves.
 *
 * ── THREE PRESENTED STATES, FOUR STORED ─────────────────────────────────────
 *
 * The database keeps all four `status` values — `draft`, `active`, `reserved`,
 * `sold` — and nothing here changes that. What this table decides is what the
 * SELLER is shown, and they are shown three states:
 *
 *   Draft ──publish──▶  LIVE  ──mark sold──▶  Sold
 *                    (active ⇄ reserved)
 *                        ▲            │
 *                        └ release hold ┘   (placed from the chat thread)
 *
 * `active` and `reserved` both fold into **Live**. A hold is a BADGE on a live
 * listing, not a fourth state and not a step on the way to selling.
 *
 *   draft            → Publish     (rest: edit/delete)
 *   Live             → **Mark as Sold**  (rest: release hold?, unpublish, renew)
 *   Live + lapsed    → Renew       (rest: sold, release hold?, unpublish)
 *   sold             → nothing (terminal)
 *
 * ── WHAT CHANGED, AND WHY THE OLD REASONING NO LONGER HOLDS ─────────────────
 *
 * This function used to answer `primary: "reserve"` for an active listing, and
 * argued for it: "real-world order is reserve-while-you-arrange-the-meetup, THEN
 * sold". That premise is retired deliberately, not forgotten. **Selling never
 * requires reserving first** — one tap from any live listing, zero prior steps,
 * which is how OLX / Facebook Marketplace / Vinted / Carousell all behave and
 * what the API has always permitted (`ListingPolicy#sold? = owner? && live?`).
 * The gap was only ever this UI teaching reserve-first.
 *
 * The other half of that old argument — "sold is terminal with no path back, so
 * it shouldn't be the loudest control" — is answered properly now rather than by
 * demoting the button: a mistaken sale is undone from the success toast, or from
 * an editable row in the Sales ledger, both of which restore the stock and
 * re-open the listing. A wrong tap costs one click to reverse.
 *
 * **Reserve is gone from this table entirely.** A hold is for a *person*, and by
 * the time a seller wants one they are already talking to that person — so it is
 * placed from the chat thread (see `conversation-thread.tsx`), never from a
 * listing that has no buyer attached to it. `activate` remains, as the inverse:
 * "Release hold".
 *
 * The SECONDARY set still lacks **Duplicate**, which mobile offers on every
 * status including sold (its relist path). Web has no `?duplicateFrom=` on
 * `/listings/new`, and this brain only speaks `PUT /my/listings/:id/<action>`
 * transitions, so it cannot simply be added to the table. Consequence: a sold
 * listing gives a web seller Edit + Delete and no one-tap relist. Unchanged by
 * this pass, and still the one place web offers a seller less than mobile.
 *
 * Takes the LISTING (status, expiry fields, and its owner-only `sale`), not
 * pre-computed flags, so every surface derives "has it lapsed?" and "is it held?"
 * from the one shared rule. `listingExpiryState()` is the same one `<ExpiryBadge>`
 * renders — callers used to pass the raw server flag, which drifts: Rails leaves
 * `expired: false` until something touches the record, while the badge escalates
 * to "Expired" as soon as `expiresAt` is past. That put a red "Expired" pill
 * inches from a primary offering anything but "Renew". One input, one verdict.
 */
export function actionsFor(
  listing: Pick<Listing, "expiresAt" | "expired" | "sale"> & { status: string },
): { primary?: LifecycleAction; secondary: LifecycleAction[] } {
  const expired = listingExpiryState(listing).kind === "expired";
  if (listing.status === "draft") return { primary: "publish", secondary: [] };
  if (!isLive(listing)) return { secondary: [] }; // sold — terminal

  // Release hold reads the SALE, never the status. A single-item hold does flip
  // the listing to `reserved`, but a multi-unit batch holding units for a buyer
  // deliberately stays `active` — so a status test would offer no way to release
  // a batch's hold at all. `hasOpenHold` is the one check correct for both, and
  // it lines up exactly with the server's own `activate?` policy
  // (`reserved? || (active? && held_units.positive?)`).
  const hold: LifecycleAction[] = hasOpenHold(listing) ? ["activate"] : [];

  // A lapsed listing's most useful move is Renew — but it is still live, so
  // selling it, releasing its hold and taking it down all stay legal. (Dropping
  // those once stranded expired listings with no way to take them down.)
  if (expired)
    return { primary: "renew", secondary: ["sold", ...hold, "unpublish"] };

  return { primary: "sold", secondary: [...hold, "unpublish", "renew"] };
}

/**
 * Whether to offer the Sales ledger for this listing — the moment ANY unit has
 * sold, single-item or batch.
 *
 * Two signals, because they arrive on different payloads: `salesCount` is the
 * authoritative ledger size (a base serializer field), and `hasSoldSome` derives
 * it from stock for a payload fetched before that field existed. Either one being
 * positive means there is a ledger worth opening.
 *
 * Lives here, beside the transition table, so the seller's card and their detail
 * page can never disagree about whether the listing has sales to show — even
 * though the entry itself is a LINK on each surface, not a transition this brain
 * can run.
 */
export function hasSalesToShow(
  listing: Pick<Listing, "quantity" | "availableUnits" | "multiUnit" | "salesCount">,
): boolean {
  return (listing.salesCount ?? 0) > 0 || hasSoldSome(listing);
}

/** What the seller has asked to do, pending confirmation. */
type PendingAction =
  | { kind: "lifecycle"; action: LifecycleAction }
  | { kind: "delete" }
  | null;

/**
 * reserve/sold go through the buyer picker (they record a Transaction, which is
 * what a review hangs off); everything else uses the plain confirm dialog.
 */
function needsBuyerPicker(pending: PendingAction): boolean {
  return (
    pending?.kind === "lifecycle" &&
    (pending.action === "reserve" || pending.action === "sold")
  );
}

/** i18n KEYS for the confirm dialog of a pending action. */
function dialogKeysFor(pending: PendingAction): {
  title: string;
  desc: string;
  confirm: string;
  destructive: boolean;
} | null {
  if (!pending) return null;
  if (pending.kind === "delete") {
    return {
      title: "listing.confirmDelete",
      desc: "listing.confirmDeleteDescription",
      confirm: "listing.delete",
      destructive: true,
    };
  }
  const entry = LIFECYCLE[pending.action];
  return {
    title: `listing.${entry.title}`,
    desc: `listing.${entry.desc}`,
    confirm: `listing.${entry.label}`,
    destructive: false,
  };
}

export type LifecycleController = ReturnType<typeof useListingLifecycle>;

/**
 * Drives one listing through a lifecycle transition (or a delete): which action
 * is awaiting confirmation, the API call, success/error toast, cache
 * invalidation, and a shared `busy` flag so the caller can disable its buttons
 * (no double-submit). Pair it with `<LifecycleDialogs>`, which renders the
 * prompts for whatever is pending.
 *
 * Invalidates the seller list + this listing's detail + this listing's
 * conversations — a buyer-recorded reserve/sold changes what the conversation
 * list shows, same as mobile — plus the public browse caches, because every
 * transition (publish/unpublish/sold/renew) changes whether buyers can see it.
 *
 * `onSaleRecorded` fires when a sale recorded a real buyer (so the seller can
 * rate them). It is a CALLBACK rather than state held here on purpose: the
 * invalidation above can drop the acting card out of a filtered list — a sold
 * listing leaves the Active tab — which would unmount a prompt owned in here
 * before the seller could use it. The owner of the prompt must outlive the card.
 */
export function useListingLifecycle(
  listingId: number,
  opts: {
    /**
     * The listing's title, echoed in every prompt. Pass it from any surface that
     * shows MORE THAN ONE listing (the /my-listings grid, a chat header): the
     * dialog covers the card that was clicked, so without the title "Delete this
     * listing?" gives the seller nothing to check the action against.
     */
    title?: string;
    /**
     * How many units are still available (docs/SPIKE_LISTING_QUANTITY.md).
     * Passed straight to the sold dialog, which asks "how many did you sell?"
     * only when it is > 1 — so a single-item listing is byte-identical to before.
     * Without it a web seller can only ever sell a whole batch at once while a
     * mobile seller can sell 3 of 15, on the same listing.
     */
    remainingQuantity?: number;
    /**
     * Skips the buyer picker: this surface already knows who the deal is with.
     * Set by the chat thread, where the buyer is the other participant by
     * definition — so "Mark sold" there goes straight to a confirm instead of
     * offering a list containing the person on screen.
     */
    preselectedBuyer?: PreselectedBuyer | null;
    /** Terms already agreed in this thread — prefills the sale (see the dialog). */
    agreedQuantity?: number | null;
    agreedPrice?: number | null;
    /** Called after a successful delete (e.g. leave the detail route). */
    onDeleted?: () => void;
    /** Called when a sale recorded a buyer — offer to review them. */
    onSaleRecorded?: (transaction: Transaction) => void;
    /**
     * Called when that sale was then UNDONE from the toast. The surface has to
     * be told, because the review prompt `onSaleRecorded` opened is still on
     * screen pointing at a transaction that no longer exists — submitting it
     * would 404. Dismiss the prompt here.
     */
    onSaleUndone?: () => void;
    /**
     * Called after any successful transition, on top of the cache invalidation
     * below. Only needed by a surface whose listing did NOT come from React
     * Query — the owner panel on the SERVER-rendered `/listings/[id]`, where
     * nothing repaints unless the RSC re-runs (`router.refresh()`).
     */
    onChanged?: () => void;
  } = {},
) {
  const t = useTranslations();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<PendingAction>(null);

  function invalidate(flags: { deleted?: boolean } = {}) {
    qc.invalidateQueries({ queryKey: ["my-listings"] });
    // The detail query is keyed by the route param (a string). A DELETED
    // listing's detail is dropped rather than refetched — the record is gone, so
    // a refetch would 404 the owner page into its error state behind the
    // redirect (and poison the cache if the seller navigates back).
    const detail = { queryKey: ["my-listing", String(listingId)] };
    if (flags.deleted) qc.removeQueries(detail);
    else qc.invalidateQueries(detail);
    qc.invalidateQueries({ queryKey: ["listing-conversations", listingId] });
    // Prefix match: every browse/home/category grid is keyed ["listings", filters].
    qc.invalidateQueries({ queryKey: ["listings"] });
    // Chat caches: a thread pins the listing (status badge + the seller's own
    // reserve/sold button) and the inbox row shows its state, so both go stale
    // the moment the listing moves — whichever surface moved it. Prefix match
    // covers every open thread, not just this listing's.
    qc.invalidateQueries({ queryKey: ["conversation"] });
    qc.invalidateQueries({ queryKey: ["conversations"] });
  }

  /**
   * Show the RIGHT failure message: the localized copy for a tagged 422, and
   * only otherwise the generic one.
   *
   * Every write in here used to `catch { toast.error(t("common.error")) }`, so a
   * seller who lowered a quantity below what they had already sold was told
   * "Something went wrong" — nothing to act on, and indistinguishable from a
   * network blip. Rails names those refusals with a stable `code`; this turns it
   * into the seller's own language. The server's English `errors` prose is never
   * rendered (see lib/api/error-codes.ts).
   */
  function toastFailure(error: unknown) {
    // No `count` to pass: the lifecycle commands cannot return either of the
    // count-bearing refusals (those come from the listing EDIT form, which knows
    // the number). `apiErrorMessage` answers null for anything it cannot render
    // properly, so an unexpected one degrades to the generic message rather than
    // to a broken sentence.
    toast.error(apiErrorMessage(error, t) ?? t("common.error"));
  }

  /**
   * Put a sale back — the toast's "Undo", and the same endpoint the Sales
   * ledger's row Delete calls. Restores the units to stock and re-opens the
   * listing if this sale was what retired it.
   */
  async function undoSale(transactionId: number) {
    try {
      await voidMySale(transactionId);
      toast.success(t("listing.sale.voidedSuccess"));
      invalidate();
      opts.onChanged?.();
      // The review prompt this sale opened is now pointing at nothing.
      opts.onSaleUndone?.();
    } catch (error) {
      toastFailure(error);
    }
  }

  /** Returns the lifecycle payload, or null when the request failed. */
  async function runLifecycle(
    action: LifecycleAction,
    saleOpts?: { buyerId?: number; finalPrice?: number; quantity?: number },
  ): Promise<LifecycleResult | null> {
    setBusy(true);
    try {
      const result = await listingLifecycle(listingId, action, saleOpts);
      const sale = action === "sold" ? result.transaction : null;
      if (sale) {
        // UNDO, not a correction form. Marking sold is now a one-tap primary on
        // every live listing, so the wrong tap has to cost one click to reverse —
        // that is what makes the loud button safe.
        //
        // 30s, not the default ~4s. The seller has to read "sold", decide it was
        // wrong, and reach the action — and on the surfaces that ALSO open a
        // review prompt on the same beat, they have that in front of them first.
        // A window that expires while they are dismissing the prompt is an undo
        // that only works for people who did not hesitate. The Sales ledger's
        // row stays the durable fallback afterwards, so this window is a
        // convenience, not the only recourse — but it is the one a seller finds
        // without being told it exists.
        toast.success(t(`listing.${LIFECYCLE[action].success}`), {
          duration: 30_000,
          action: {
            label: t("common.undo"),
            onClick: () => void undoSale(sale.id),
          },
        });
      } else {
        toast.success(t(`listing.${LIFECYCLE[action].success}`));
      }
      invalidate();
      opts.onChanged?.();
      return result;
    } catch (error) {
      toastFailure(error);
      return null;
    } finally {
      setBusy(false);
    }
  }

  /** Ask before acting: opens the confirm prompt (or the buyer picker). */
  function ask(action: LifecycleAction | "delete") {
    setPending(
      action === "delete" ? { kind: "delete" } : { kind: "lifecycle", action },
    );
  }

  /** Dismiss the open prompt — ignored while a request is in flight. */
  function dismiss() {
    if (!busy) setPending(null);
  }

  /** Confirm path: delete + every non-buyer transition. */
  async function confirmPending() {
    if (!pending) return;
    if (pending.kind === "delete") {
      setBusy(true);
      try {
        await deleteMyListing(listingId);
        toast.success(t("listing.deleteSuccess"));
        invalidate({ deleted: true });
        setPending(null);
        opts.onDeleted?.();
      } catch (error) {
        // Leave the prompt open (with the error toast) so it can be retried.
        toastFailure(error);
      } finally {
        setBusy(false);
      }
      return;
    }
    if (await runLifecycle(pending.action)) setPending(null);
  }

  /** Buyer-picker path: reserve/sold with an optional buyer + final price. */
  async function submitSale(
    buyerId: number | null,
    finalPrice: number | null,
    quantity: number | null = null,
  ) {
    if (pending?.kind !== "lifecycle") return;
    const action = pending.action;
    const result = await runLifecycle(action, {
      buyerId: buyerId ?? undefined,
      finalPrice: finalPrice ?? undefined,
      quantity: quantity ?? undefined,
    });
    if (!result) return;
    setPending(null);
    // Only prompt for a review when there is somebody to review.
    //
    // This used to test `result.transaction` alone, on the premise that "Rails
    // only returns a transaction when a real buyer was identified". That premise
    // is GONE: since SF-B3 an outside-buyer sale ("someone not on Hatiwal")
    // records a real ledger row too — with `buyer: null` — precisely so it can
    // be listed and corrected like any other sale. Testing the transaction alone
    // now opens the review dialog for a sale with no counterparty, which reads
    // `transaction.buyer.name` and crashes the page.
    //
    // So the test is the BUYER, not the transaction. `GET /my/reviews/pending`
    // filters buyer-less rows out server-side for the same reason; this is the
    // one path that does not go through it.
    if (action === "sold" && result.transaction?.buyer) {
      opts.onSaleRecorded?.(result.transaction);
    }
  }

  return {
    listingId,
    title: opts.title,
    remainingQuantity: opts.remainingQuantity,
    preselectedBuyer: opts.preselectedBuyer,
    agreedQuantity: opts.agreedQuantity,
    agreedPrice: opts.agreedPrice,
    busy,
    pending,
    ask,
    dismiss,
    confirmPending,
    submitSale,
  };
}

/**
 * The prompt every lifecycle action goes through: the shared confirm dialog for
 * publish/unpublish/activate/renew/delete, and the buyer picker for
 * reserve/sold (which records the Transaction a review hangs off). Rendered by
 * every surface that offers the actions, so the copy and the
 * confirm-vs-picker rule are decided in one place.
 */
export function LifecycleDialogs({
  lifecycle,
}: {
  lifecycle: LifecycleController;
}) {
  const t = useTranslations();
  const {
    listingId,
    title,
    remainingQuantity,
    preselectedBuyer,
    agreedQuantity,
    agreedPrice,
    pending,
    busy,
    dismiss,
    confirmPending,
    submitSale,
  } = lifecycle;
  const buyerFlow = needsBuyerPicker(pending);
  const keys = dialogKeysFor(pending);

  return (
    <>
      {keys && !buyerFlow && (
        <ConfirmDialog
          open
          title={t(keys.title)}
          // The listing's own title, when the surface passed one: the prompt
          // covers the card that was clicked, so naming the listing is the only
          // way a seller can check they are about to delete the right one.
          description={
            <>
              {t(keys.desc)}
              {title && (
                <span className="mt-1 block font-medium text-foreground">
                  {title}
                </span>
              )}
            </>
          }
          confirmLabel={t(keys.confirm)}
          cancelLabel={t("common.cancel")}
          destructive={keys.destructive}
          loading={busy}
          onConfirm={confirmPending}
          onCancel={dismiss}
        />
      )}

      {buyerFlow && pending?.kind === "lifecycle" && (
        <SellBuyerDialog
          action={pending.action as "reserve" | "sold"}
          listingId={listingId}
          listingTitle={title}
          remainingQuantity={remainingQuantity}
          preselectedBuyer={preselectedBuyer}
          agreedQuantity={agreedQuantity}
          agreedPrice={agreedPrice}
          busy={busy}
          onCancel={dismiss}
          onConfirm={submitSale}
        />
      )}
    </>
  );
}
