"use client";

import { useEffect, useId, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Loader2, UserX } from "lucide-react";
import { toast } from "sonner";
import { getConversations } from "@/lib/api/chat";
import { UserAvatar } from "@/components/shared/user-avatar";
import { UserIdentity } from "@/components/shared/user-identity";
import { QuantityStepper } from "@/components/shared/quantity-stepper";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type Choice = number | "else" | null;

/** The one person a hold/sale is already known to be for (the chat path). */
export interface PreselectedBuyer {
  id: number;
  name: string;
  avatarUrl?: string | null;
  verified?: boolean;
}

/**
 * Reserve/sold buyer attribution (REV/TX). Records the Transaction a review
 * hangs off, so both parties can rate each other. Two modes:
 *
 *  - **PICKER** (from a listing surface): choose which of this listing's own
 *    conversation partners bought it, or "someone not on Hatiwal" — a real
 *    ledger row with no counterparty, not a skipped one.
 *  - **CONFIRM** (`preselectedBuyer`, from a chat thread): the buyer is whoever
 *    the seller is already talking to, so there is no list and no choice to
 *    make — just the quantity, the price and one confirm. Selling from a
 *    conversation is the shortest real path to a sale and it must not detour
 *    through a list containing the person already on screen.
 *
 * Mirrors the mobile BuyerPickerSheet, whose `preselectedBuyer` confirm mode is
 * the same mechanism. The parent owns the lifecycle call + busy state.
 */
export function SellBuyerDialog({
  action,
  listingId,
  listingTitle,
  remainingQuantity,
  preselectedBuyer,
  agreedQuantity,
  agreedPrice,
  busy,
  onCancel,
  onConfirm,
}: {
  action: "reserve" | "sold";
  listingId: number;
  /**
   * Skips the picker: this hold/sale is for this person, decided before the
   * dialog opened. Set by the chat thread, where the buyer is the other
   * participant by definition.
   */
  preselectedBuyer?: PreselectedBuyer | null;
  /**
   * Units and price already AGREED with this buyer, read off the offer their
   * `offer_accepted` answered.
   *
   * Without this the seller re-enters terms they settled minutes ago in the same
   * thread, from memory, into a field that defaults to 1 — so accepting an offer
   * for 3 units and then marking sold recorded one, and the batch quietly stayed
   * on the market with two units that were already spoken for. Both stay fully
   * editable; this is a prefill, not a lock.
   */
  agreedQuantity?: number | null;
  agreedPrice?: number | null;
  /**
   * Which listing is being sold. Pass it whenever the picker can be opened from
   * a surface showing several listings (the /my-listings grid) — the dialog
   * covers the card that was clicked, so the title is the seller's only check
   * that they are selling the right thing.
   */
  listingTitle?: string;
  /**
   * How many units are still available. > 1 turns on the "how many did you
   * sell?" field — a partial sale must leave the listing active with the rest
   * still browsable. Omit (or 1) for a single-item listing, which then looks
   * exactly as it did before this feature existed.
   */
  remainingQuantity?: number;
  busy: boolean;
  onCancel: () => void;
  onConfirm: (
    buyerId: number | null,
    finalPrice: number | null,
    quantity: number | null,
  ) => void;
}) {
  const t = useTranslations("buyerPicker");
  const tc = useTranslations("common");
  const tl = useTranslations("listing");
  // Confirm mode starts already decided — the buyer is the person the seller is
  // talking to, so the confirm button is live on open with nothing to pick.
  const [selected, setSelected] = useState<Choice>(preselectedBuyer?.id ?? null);
  const [price, setPrice] = useState(
    agreedPrice != null && agreedPrice > 0 ? String(agreedPrice) : "",
  );
  const confirmMode = preselectedBuyer != null;
  /**
   * A quantity is asked for BOTH a sale and a hold, whenever there is more than
   * one unit.
   *
   * The hold half is new: a reservation used to be all-or-nothing on the whole
   * listing, so "2 held for Ahmad" was impossible to express and every hold on a
   * 15-unit batch recorded as one. Holding two of fifteen is a completely
   * ordinary thing for a seller to be doing, and the API takes the quantity on
   * `reserve` now, so the control belongs here for both.
   */
  const asksQuantity = (remainingQuantity ?? 1) > 1;
  /**
   * ONE, not the whole remainder.
   *
   * Pre-filling the entire stock made "I sold all of them" the outcome of simply
   * confirming, in a flow where a click places a caret rather than replacing —
   * so a seller meaning 3 produced "153", which clamped to "sold all 15" and
   * retired the batch. "I sold one" is what a seller means when they say nothing
   * else; "I sold all fifteen" is a deliberate act and should be stated. A
   * single-item listing is unaffected: its remainder IS one.
   */
  // The agreed quantity when the thread has one, otherwise ONE. Never the whole
  // remainder — see above.
  const defaultUnits = Math.max(1, agreedQuantity ?? 1);
  const [units, setUnits] = useState(defaultUnits);
  useEffect(() => {
    // Re-sync on a stock change too: the point of the reset is that the field
    // never carries a number the seller did not choose for THIS deal — the
    // agreed count from this very thread being the one exception.
    setUnits(defaultUnits);
  }, [remainingQuantity, defaultUnits]);
  const titleId = useId();
  const unitsId = useId();

  // Page 1 of this listing's threads (20, newest-message-first) — the buyers a
  // seller is actually mid-deal with. The picker deliberately has no load-more:
  // it is a decision surface, not a list to browse.
  //
  // Not fetched at all in confirm mode: there is no list to fill, and a chat
  // thread must not pay for a conversations round-trip to sell to the person
  // already on screen.
  const { data: conversations, isPending } = useQuery({
    queryKey: ["listing-conversations", listingId],
    queryFn: () => getConversations(listingId).then((r) => r.items),
    enabled: !confirmMode,
  });

  function confirm() {
    const finalPrice = price.trim() ? Number(price) : null;
    if (finalPrice != null && (!Number.isFinite(finalPrice) || finalPrice <= 0)) {
      toast.error(t("invalidPrice"));
      return;
    }
    // <QuantityStepper> already holds the value inside [1, remainder], so this
    // is a belt-and-braces floor rather than the primary guard. Rails clamps as
    // well; a client that sends an impossible number is still a client bug worth
    // not having.
    const quantity = asksQuantity
      ? Math.min(Math.max(1, Math.trunc(units)), remainingQuantity ?? 1)
      : null;
    onConfirm(
      selected === "else" ? null : selected,
      finalPrice,
      // NOT tied to the buyer: this is how many UNITS were sold, true whoever bought
      // them. Rails reads a missing quantity as the whole remaining stock, so nulling it
      // here retired the listing on every off-platform sale.
      quantity,
    );
  }

  return (
    <Dialog
      open
      onClose={onCancel}
      labelledBy={titleId}
      dismissible={!busy}
      className="flex max-h-[85vh] max-w-sm flex-col"
    >
      <h2 id={titleId} className="text-lg font-semibold">
          {action === "sold" ? t("soldTitle") : t("reserveTitle")}
        </h2>
        {listingTitle && (
          <p className="mt-1 line-clamp-2 text-sm font-medium text-foreground">
            {listingTitle}
          </p>
        )}
        {/* "Select from your conversations on this listing" is untrue in confirm
            mode — there is no list. The identity row below IS the answer to
            "who", so the subtitle is simply dropped rather than replaced with a
            second way of saying the same name. */}
        {!confirmMode && (
          <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
        )}

        {confirmMode ? (
          /* One person, shown not offered: the identity is confirmation of who
             this deal is with, not a control. Through the shared UserIdentity so
             avatar + name + verified read exactly as they do everywhere else. */
          <div className="my-4 rounded-md border border-primary bg-primary/5 px-3 py-2">
            <UserIdentity
              name={preselectedBuyer.name}
              avatarUrl={preselectedBuyer.avatarUrl}
              verified={preselectedBuyer.verified}
              size={36}
            />
          </div>
        ) : (
        <div className="-mx-1 my-4 flex-1 space-y-1.5 overflow-y-auto px-1">
          {isPending ? (
            <div className="flex justify-center py-6">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {(conversations ?? []).map((c) => {
                const buyer = c.buyer ?? c.otherParticipant;
                if (!buyer) return null;
                const isSel = selected === buyer.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelected(buyer.id)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-md border px-3 py-2 text-start transition-colors",
                      isSel
                        ? "border-primary bg-primary/5"
                        : "border-input hover:bg-accent",
                    )}
                  >
                    <UserAvatar
                      name={buyer.name}
                      avatarUrl={buyer.avatarUrl}
                      size={36}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{buyer.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {c.lastMessageBody || t("noMessages")}
                      </p>
                    </div>
                  </button>
                );
              })}

              {(conversations ?? []).length === 0 && (
                <p className="py-3 text-center text-sm text-muted-foreground">
                  {t("noConversations")}
                </p>
              )}

              {/* Sold to someone not on Hatiwal — no buyer, no review. */}
              <button
                type="button"
                onClick={() => setSelected("else")}
                className={cn(
                  "flex w-full items-center gap-3 rounded-md border px-3 py-2 text-start transition-colors",
                  selected === "else"
                    ? "border-primary bg-primary/5"
                    : "border-input hover:bg-accent",
                )}
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  <UserX className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {t("someoneElse")}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {t("someoneElseHint")}
                  </p>
                </div>
              </button>
            </>
          )}
        </div>
        )}

        {/* How many units this deal covers. Asked for a real buyer AND for a sale
            to someone not on Hatiwal: on that path only the BUYER is unknown, the
            count is not — and hiding the field left the seller no way to say it.
            Rails reads a missing quantity as the whole remaining stock, so the
            silence retired the listing. Reported from a device: 50 in stock, one
            sale, "0 of 50 left". Still hidden before anything is selected in
            PICKER mode, which is what the e2e spec asserts on open; in confirm
            mode the buyer is already decided, so it is there from the start.
            Above the price, because "how many" is answered before "for how much".

            CAP + REASON, via the shared <QuantityStepper>: the value cannot
            exceed available stock, and the moment the seller reaches for more
            the control says why it stopped and what to do if they really have
            more ("Only 15 left. Edit the listing if you have more."). This
            replaced a bare numeric <input> whose over-stock feedback was a
            recoloured caption — which explained the problem but still let an
            impossible number sit in the field at confirm time, and kept a
            hand-rolled number input alive beside the shared one. */}
        {selected !== null && asksQuantity && (
          <div className="mb-3 space-y-1.5">
            <label className="text-sm font-medium" htmlFor={unitsId}>
              {action === "sold" ? tl("form.howManySold") : t("holdQuantityLabel")}
            </label>
            <QuantityStepper
              id={unitsId}
              value={units}
              onChange={setUnits}
              max={remainingQuantity ?? 1}
              disabled={busy}
            />
          </div>
        )}

      {/* The NUDGE is about reviewing each other, so it only applies to a real
          buyer — there is nobody to rate on an outside sale. */}
      {typeof selected === "number" && (
        <p className="mb-3 text-xs text-muted-foreground">
          {t(confirmMode ? "nudgeConfirm" : "nudge")}
        </p>
      )}

      {/* FINAL PRICE, for every selection including "someone not on Hatiwal".
          This used to be hidden on that path, on the grounds that such a sale
          "records no transaction, so the final price has nowhere to attach".
          That premise is gone: since SF-B3 an outside sale writes a real ledger
          row (`buyer_id: nil`) carrying its own quantity AND final price, so
          hiding the field just loses a fact the seller knows — the price they
          actually got — from their own sales history. Only the counterparty is
          unknown on that path; the money is not. */}
      {selected !== null && (
        <>
          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="finalPrice">
              {/* "Agreed price" when it was prefilled from an accepted offer —
                  the seller is confirming a figure, not choosing one. */}
              {agreedPrice != null && agreedPrice > 0
                ? t("agreedPrice")
                : t("finalPriceLabel")}
            </label>
            <Input
              id="finalPrice"
              type="number"
              inputMode="numeric"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder={t("finalPricePlaceholder")}
            />
            {/* Multi-unit only: say out loud that this figure is per item.
                "Final price" on a 3-unit deal reads just as easily as the
                total, and the number lands in the sale record and the review. */}
            {asksQuantity && (
              <p className="text-xs text-muted-foreground">
                {t("finalPricePerUnitHint")}
              </p>
            )}
          </div>
        </>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel} disabled={busy}>
            {tc("cancel")}
          </Button>
          <Button onClick={confirm} disabled={busy || selected == null}>
            {busy && <Loader2 className="size-4 animate-spin" />}
            {action === "sold" ? t("confirmSold") : t("confirmReserve")}
          </Button>
        </div>
    </Dialog>
  );
}
