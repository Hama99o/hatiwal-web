"use client";

import { useId, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Store, User as UserIcon } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import { useSellingIdentity } from "@/components/shops/use-selling-identity";
import { duplicateMyListing, moveMyListing } from "@/lib/api/me";
import { apiErrorMessage } from "@/lib/api/error-codes";
import { hasOpenHold } from "@/lib/stock";
import type { Listing } from "@/lib/types";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

/** A selling identity: `shopId` null = Me. */
export interface Place {
  shopId: number | null;
  name: string;
}

type PlaceListing = Pick<Listing, "id" | "status" | "sale"> &
  Partial<Pick<Listing, "shop" | "shopId" | "seller" | "title">>;

/**
 * Owner, 2026-10-12 (hatiwal-mobile docs/OWNER_ITEMS_2026-10-12.md, item 5),
 * the web twin of mobile's useListingLifecycle place picker:
 *
 * - **Move to shop**: every other open shop the user is on, and Me only for the
 *   shop's owner or the listing's poster (docs/SHOPS.md). Only a draft or a live
 *   listing with no hold. The chats stay where they are (Rails tells and closes
 *   them), so the confirm says so.
 * - **Duplicate**: Rails makes a DRAFT with COPIES of the photos
 *   (`POST /my/listings/:id/duplicate`) in the place picked — with a shop it
 *   asks where: here first, then every other identity. Another place also
 *   switches who they sell as; then the draft opens in the edit form.
 *
 * Returns the two menu actions' availability and handlers, plus `dialogs`, to
 * render once beside the menu.
 */
export function useListingPlaces(
  listing: PlaceListing | null | undefined,
  opts: { onChanged?: () => void } = {},
) {
  const t = useTranslations();
  const qc = useQueryClient();
  const router = useRouter();
  const { user } = useAuth();
  const { shops, sellingAs, switchToAsync } = useSellingIdentity();
  const [asking, setAsking] = useState<"move" | "duplicate" | null>(null);
  const [confirming, setConfirming] = useState<Place | null>(null);
  const [busy, setBusy] = useState(false);

  const me: Place = { shopId: null, name: t("shops.me") };
  const hereShopId = listing?.shop?.id ?? listing?.shopId ?? null;
  const nameOf = (shopId: number | null) =>
    shopId == null ? me.name : shops.find((s) => s.id === shopId)?.name ?? me.name;

  // Undefined while the caller's own query loads (hooks run before its early returns).
  const movable =
    !!listing && (listing.status === "draft" || listing.status === "active") && !hasOpenHold(listing);
  const moveTargets: Place[] = [];
  if (movable && shops.length > 0) {
    if (hereShopId != null) {
      const ownerHere = shops.find((s) => s.id === hereShopId)?.role === "owner";
      const postedByMe = listing?.seller?.id != null && listing.seller.id === user?.id;
      if (ownerHere || postedByMe) moveTargets.push(me);
    }
    for (const s of shops) if (s.id !== hereShopId) moveTargets.push({ shopId: s.id, name: s.name });
  }

  const duplicatePlaces: Place[] = (() => {
    const all: Place[] = [me, ...shops.map((s) => ({ shopId: s.id, name: s.name }))];
    const here = all.find((p) => p.shopId === hereShopId) ?? all[0];
    return [here, ...all.filter((p) => p !== here)];
  })();

  async function duplicateTo(place: Place) {
    if (!listing) return;
    setAsking(null);
    setBusy(true);
    try {
      const copy = await duplicateMyListing(listing.id, place.shopId);
      qc.invalidateQueries({ queryKey: ["my-listings"] });
      if (place.shopId !== (sellingAs?.id ?? null)) await switchToAsync(place.shopId);
      toast.success(t("listing.duplicated"));
      router.push(`/listings/${copy.id}/edit`);
    } catch (error) {
      toast.error(apiErrorMessage(error, t) ?? t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  async function move(place: Place) {
    if (!listing) return;
    setBusy(true);
    try {
      await moveMyListing(listing.id, place.shopId);
      toast.success(t("listing.move.success", { name: place.name }));
      qc.invalidateQueries({ queryKey: ["my-listings"] });
      qc.invalidateQueries({ queryKey: ["my-listing", String(listing.id)] });
      qc.invalidateQueries({ queryKey: ["listings"] });
      qc.invalidateQueries({ queryKey: ["conversations"] });
      setConfirming(null);
      opts.onChanged?.();
    } catch (error) {
      toast.error(apiErrorMessage(error, t) ?? t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  const places = asking === "move" ? moveTargets : asking === "duplicate" ? duplicatePlaces : [];

  const dialogs = (
    <>
      <PlaceDialog
        open={asking !== null}
        title={asking === "move" ? t("listing.move.title") : t("listing.duplicateWhere")}
        places={places}
        labelFor={(p, i) =>
          asking === "duplicate" && i === 0 ? t("listing.duplicateHere", { name: p.name }) : p.name
        }
        testIdPrefix={asking === "move" ? "move-to" : "duplicate-to"}
        cancelLabel={t("common.cancel")}
        onPick={(p) => {
          if (asking === "move") {
            setAsking(null);
            setConfirming(p);
          } else {
            void duplicateTo(p);
          }
        }}
        onClose={() => setAsking(null)}
      />
      <ConfirmDialog
        open={confirming !== null}
        title={t("listing.move.confirmTitle", { name: confirming?.name ?? "" })}
        description={t("listing.move.confirmDescription", { here: nameOf(hereShopId) })}
        confirmLabel={t("listing.move.confirm")}
        cancelLabel={t("common.cancel")}
        loading={busy}
        onConfirm={() => confirming && void move(confirming)}
        onCancel={() => !busy && setConfirming(null)}
      />
    </>
  );

  return {
    canMove: moveTargets.length > 0,
    askMove: () => setAsking("move"),
    /** With no shop there is nothing to ask: copied as Me, straight to the form. */
    askDuplicate: () => (shops.length === 0 ? void duplicateTo(me) : setAsking("duplicate")),
    busy,
    dialogs,
  };
}

/** "Move to…" / "Duplicate to…": one button per place. */
function PlaceDialog({
  open,
  title,
  places,
  labelFor,
  testIdPrefix,
  cancelLabel,
  onPick,
  onClose,
}: {
  open: boolean;
  title: string;
  places: Place[];
  labelFor: (p: Place, index: number) => string;
  testIdPrefix: string;
  cancelLabel: string;
  onPick: (p: Place) => void;
  onClose: () => void;
}) {
  const titleId = useId();
  return (
    <Dialog open={open} onClose={onClose} labelledBy={titleId} className="max-w-sm">
      <h2 id={titleId} className="text-lg font-semibold">
        {title}
      </h2>
      <div className="mt-4 flex flex-col gap-2">
        {places.map((p, i) => {
          const Icon = p.shopId == null ? UserIcon : Store;
          return (
            <Button
              key={p.shopId ?? "me"}
              variant="outline"
              className="h-auto min-h-10 justify-start gap-2 whitespace-normal py-2 text-start"
              data-testid={`${testIdPrefix}-${p.shopId ?? "me"}`}
              onClick={() => onPick(p)}
            >
              <Icon className="size-4 shrink-0" />
              <span>{labelFor(p, i)}</span>
            </Button>
          );
        })}
      </div>
      <div className="mt-4 flex justify-end">
        <Button variant="ghost" onClick={onClose}>
          {cancelLabel}
        </Button>
      </div>
    </Dialog>
  );
}
