"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  CircleCheckBig,
  Clock,
  EyeOff,
  RefreshCw,
  RotateCcw,
  Upload,
  type LucideIcon,
} from "lucide-react";
import {
  listingLifecycle,
  deleteMyListing,
  type LifecycleAction,
  type LifecycleResult,
} from "@/lib/api/me";
import type { Transaction } from "@/lib/types";
import { listingExpiryState } from "@/components/shared/expiry-badge";
import { SellBuyerDialog } from "./sell-buyer-dialog";
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
 * unpublish→EyeOff, activate→RotateCcw) so a seller who uses both clients reads
 * the same glyph for the same move.
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
  reserve: {
    label: "markReserved",
    success: "reserveSuccess",
    title: "confirmReserve",
    desc: "confirmReserveDescription",
    Icon: Clock,
  },
  activate: {
    label: "activate",
    success: "activateSuccess",
    title: "confirmActivate",
    desc: "confirmActivateDescription",
    Icon: RotateCcw,
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
 * The PRIMARY of each status matches mobile's shared hook exactly —
 * `hatiwal-mobile/src/hooks/useListingLifecycle.ts` (`primaryAction` +
 * `moreActions`), the hook behind both SellerListingCard and MyListingDetail:
 *
 *   draft     → Publish            (rest: edit/delete)
 *   active    → Mark as Reserved   (rest: sold, unpublish, renew)
 *   lapsed    → Renew              (rest: sold, reserve, unpublish)
 *   reserved  → Mark as Sold       (rest: activate)
 *   sold      → nothing (terminal)
 *
 * The SECONDARY set is mobile's minus one action, and the gap is worth naming
 * because it is a dead end: mobile's `moreActions` also offers **Duplicate** for
 * every status *including sold* (its relist path), which web has nowhere — there
 * is no `?duplicateFrom=` on `/listings/new` yet, and this brain only speaks the
 * `POST /listings/:id/<action>` transitions, so `duplicate` cannot simply be
 * added to the table. Consequence: a SOLD listing gives a web seller Manage +
 * Edit + Chats and no way to put the item back on sale, while the same seller on
 * mobile gets one tap. Closing it needs the duplicate flow first; until then this
 * is the one place web offers a seller strictly less than mobile.
 *
 * `active → reserve` is the one worth spelling out: web used to promote `sold`
 * there. Real-world order is reserve-while-you-arrange-the-meetup, THEN sold, and
 * `sold` is terminal in this brain (no duplicate/relist on web yet), so making it
 * the loudest control on a seller's own public listing page put the button with no
 * path back at the top of the column. It stays one click away in `secondary`.
 *
 * Takes the LISTING (status + its expiry fields), not a pre-computed `expired`
 * flag, so that every surface derives "has it lapsed?" from the one shared rule
 * — `listingExpiryState()`, the same one `<ExpiryBadge>` renders. Callers used to
 * pass the raw server flag, which drifts: Rails leaves `expired: false` until
 * something touches the record, while the badge escalates to "Expired" as soon
 * as `expiresAt` is past. That put a red "Expired" pill inches from a primary
 * button offering anything but "Renew". One input, one verdict.
 */
export function actionsFor(listing: {
  status: string;
  expiresAt?: string | null;
  expired?: boolean;
}): { primary?: LifecycleAction; secondary: LifecycleAction[] } {
  const { status } = listing;
  const expired = listingExpiryState(listing).kind === "expired";
  if (status === "draft") return { primary: "publish", secondary: [] };
  if (status === "reserved")
    return { primary: "sold", secondary: ["activate"] };
  // An expired listing's most useful move is Renew, but it is still a live
  // `active` record: reserving or unpublishing it stays legal (mobile parity —
  // dropping them here stranded expired listings with no way to take them down).
  if (status === "active" && expired)
    return { primary: "renew", secondary: ["sold", "reserve", "unpublish"] };
  if (status === "active")
    return { primary: "reserve", secondary: ["sold", "unpublish", "renew"] };
  return { secondary: [] }; // sold — terminal
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
    /** Called after a successful delete (e.g. leave the detail route). */
    onDeleted?: () => void;
    /** Called when a sale recorded a buyer — offer to review them. */
    onSaleRecorded?: (transaction: Transaction) => void;
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

  /** Returns the lifecycle payload, or null when the request failed. */
  async function runLifecycle(
    action: LifecycleAction,
    saleOpts?: { buyerId?: number; finalPrice?: number },
  ): Promise<LifecycleResult | null> {
    setBusy(true);
    try {
      const result = await listingLifecycle(listingId, action, saleOpts);
      toast.success(t(`listing.${LIFECYCLE[action].success}`));
      invalidate();
      opts.onChanged?.();
      return result;
    } catch {
      toast.error(t("common.error"));
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
      } catch {
        // Leave the prompt open (with the error toast) so it can be retried.
        toast.error(t("common.error"));
      } finally {
        setBusy(false);
      }
      return;
    }
    if (await runLifecycle(pending.action)) setPending(null);
  }

  /** Buyer-picker path: reserve/sold with an optional buyer + final price. */
  async function submitSale(buyerId: number | null, finalPrice: number | null) {
    if (pending?.kind !== "lifecycle") return;
    const action = pending.action;
    const result = await runLifecycle(action, {
      buyerId: buyerId ?? undefined,
      finalPrice: finalPrice ?? undefined,
    });
    if (!result) return;
    setPending(null);
    // Rails only returns a transaction when a real buyer was identified, so a
    // sale to "someone not on Hatiwal" correctly prompts for nothing.
    if (action === "sold" && result.transaction) {
      opts.onSaleRecorded?.(result.transaction);
    }
  }

  return {
    listingId,
    title: opts.title,
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
  const { listingId, title, pending, busy, dismiss, confirmPending, submitSale } =
    lifecycle;
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
          busy={busy}
          onCancel={dismiss}
          onConfirm={submitSale}
        />
      )}
    </>
  );
}
