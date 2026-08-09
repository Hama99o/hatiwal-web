"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  listingLifecycle,
  deleteMyListing,
  type LifecycleAction,
  type LifecycleResult,
} from "@/lib/api/me";

/**
 * THE seller lifecycle brain — the single source of truth for "what can I do to
 * this listing, what is it called, and what happens when I do it".
 *
 * Imported by BOTH the owner detail screen (`manage-listing-view.tsx`) and the
 * inline card quick-actions (`seller-listing-actions.tsx`) so the two can never
 * drift. Never copy the map or the resolver into a component — extend it here.
 */

/** i18n key suffixes (under the `listing.` namespace) for each transition. */
export const LIFECYCLE: Record<
  LifecycleAction,
  { label: string; success: string; title: string; desc: string }
> = {
  publish: {
    label: "publish",
    success: "publishSuccess",
    title: "confirmPublish",
    desc: "confirmPublishDescription",
  },
  unpublish: {
    label: "unpublish",
    success: "unpublishSuccess",
    title: "confirmUnpublish",
    desc: "confirmUnpublishDescription",
  },
  reserve: {
    label: "markReserved",
    success: "reserveSuccess",
    title: "confirmReserve",
    desc: "confirmReserveDescription",
  },
  activate: {
    label: "activate",
    success: "activateSuccess",
    title: "confirmActivate",
    desc: "confirmActivateDescription",
  },
  sold: {
    label: "markSold",
    success: "markSoldSuccess",
    title: "confirmMarkSold",
    desc: "markSoldConfirm",
  },
  renew: {
    label: "renew",
    success: "renewSuccess",
    title: "confirmRenew",
    desc: "confirmRenewDescription",
  },
};

/**
 * Which transitions a listing offers, given its status (+ whether its 30-day
 * run has lapsed). `primary` is the single most likely next step; `secondary`
 * are the other legal moves. Mirrors mobile's SellerListingCard.
 */
export function actionsFor(
  status: string,
  expired: boolean,
): { primary?: LifecycleAction; secondary: LifecycleAction[] } {
  if (status === "draft") return { primary: "publish", secondary: [] };
  if (status === "reserved")
    return { primary: "sold", secondary: ["activate"] };
  if (status === "active" && expired)
    return { primary: "renew", secondary: ["sold"] };
  if (status === "active")
    return { primary: "sold", secondary: ["reserve", "unpublish", "renew"] };
  return { secondary: [] }; // sold — terminal
}

/** What the seller has asked to do, pending confirmation. */
export type PendingAction =
  | { kind: "lifecycle"; action: LifecycleAction }
  | { kind: "delete" }
  | null;

/**
 * reserve/sold go through the buyer picker (they record a Transaction, which is
 * what a review hangs off); everything else uses the plain confirm dialog.
 */
export function isBuyerAction(action: LifecycleAction): boolean {
  return action === "reserve" || action === "sold";
}

export function needsBuyerPicker(pending: PendingAction): boolean {
  return pending?.kind === "lifecycle" && isBuyerAction(pending.action);
}

/**
 * i18n KEYS for the confirm dialog of a pending action (the caller runs them
 * through `t`, so this stays a pure function usable anywhere).
 */
export function dialogKeysFor(pending: PendingAction): {
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

/**
 * Runs a lifecycle transition (or a delete) for one listing: success/error
 * toast, cache invalidation, and a shared `busy` flag so the caller can disable
 * its buttons (no double-submit).
 *
 * Invalidates the seller list + this listing's detail + this listing's
 * conversations — a buyer-recorded reserve/sold changes what the conversation
 * list shows, same as mobile.
 */
export function useListingLifecycle(listingId: number) {
  const t = useTranslations();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);

  function invalidate() {
    qc.invalidateQueries({ queryKey: ["my-listings"] });
    // The detail query is keyed by the route param (a string).
    qc.invalidateQueries({ queryKey: ["my-listing", String(listingId)] });
    qc.invalidateQueries({ queryKey: ["listing-conversations", listingId] });
  }

  /** Returns the lifecycle payload, or null when the request failed. */
  async function runLifecycle(
    action: LifecycleAction,
    opts?: { buyerId?: number; finalPrice?: number },
  ): Promise<LifecycleResult | null> {
    setBusy(true);
    try {
      const result = await listingLifecycle(listingId, action, opts);
      toast.success(t(`listing.${LIFECYCLE[action].success}`));
      invalidate();
      return result;
    } catch {
      toast.error(t("common.error"));
      return null;
    } finally {
      setBusy(false);
    }
  }

  /** Returns true when the listing was deleted. */
  async function runDelete(): Promise<boolean> {
    setBusy(true);
    try {
      await deleteMyListing(listingId);
      toast.success(t("listing.deleteSuccess"));
      invalidate();
      return true;
    } catch {
      toast.error(t("common.error"));
      return false;
    } finally {
      setBusy(false);
    }
  }

  return { busy, runLifecycle, runDelete };
}
