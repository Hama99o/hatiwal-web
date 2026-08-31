"use client";

import { useId, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Loader2, UserX } from "lucide-react";
import { getConversations } from "@/lib/api/chat";
import { correctMySale, voidMySale } from "@/lib/api/me";
import { apiErrorMessage, isReviewedSaleRefusal } from "@/lib/api/error-codes";
import type { Listing, Transaction } from "@/lib/types";
import { UserAvatar } from "@/components/shared/user-avatar";
import { UserIdentity } from "@/components/shared/user-identity";
import { QuantityStepper } from "@/components/shared/quantity-stepper";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { hasStockToShow } from "@/lib/stock";
import { cn } from "@/lib/utils";

/**
 * Edit ONE recorded sale — quantity, buyer, price — or remove it entirely.
 *
 * A separate component from `SellBuyerDialog` on purpose: that sheet PICKS a new
 * buyer for a sale that is about to happen, this one CORRECTS a sale that
 * already did. Different question, different defaults (this one starts from the
 * recorded values, not from a blank slate), different destructive action. It is
 * composed from the same shared pieces — `QuantityStepper`, `UserIdentity`, the
 * shared `Dialog`/`ConfirmDialog` — rather than forked from it.
 *
 * ── The one deliberate refusal ──────────────────────────────────────────────
 *
 * A sale that already carries a REVIEW cannot be voided or reassigned: doing
 * either would make a real review someone wrote vanish, or silently
 * re-attribute it to a different person. Rails refuses with
 * `code: "sale_has_review"`, and this dialog reacts STRUCTURALLY rather than by
 * only printing a sentence — Delete goes away, "Change buyer" freezes, and
 * quantity and price stay editable, because correcting a typo'd count is
 * exactly what the seller came here to do and it harms nothing.
 *
 * The error is shown INLINE, never as a toast: this dialog sits above the page,
 * and a toast explaining why the button under the seller's cursor did nothing
 * belongs next to that button.
 */
export function SaleRowEditDialog({
  sale,
  listing,
  otherSoldUnits,
  onClose,
  onCorrected,
  onVoided,
}: {
  sale: Transaction;
  listing: Listing;
  /**
   * Units sold on this listing by every OTHER row. The ceiling for this row is
   * whatever the batch has left over once they are accounted for — so a seller
   * can raise 3 to 5 on a 15-unit listing with 8 sold elsewhere, but not to 9.
   * Re-validated server-side regardless; this is what keeps the control honest
   * before the request.
   */
  otherSoldUnits: number;
  onClose: () => void;
  onCorrected: () => void;
  onVoided: () => void;
}) {
  const t = useTranslations();
  const tb = useTranslations("buyerPicker");
  const titleId = useId();
  const unitsId = useId();
  const priceId = useId();

  const multiUnit = hasStockToShow(listing);
  const capacity = Math.max(1, (listing.quantity ?? 1) - otherSoldUnits);

  const [units, setUnits] = useState(sale.quantity ?? 1);
  const [price, setPrice] = useState(
    sale.finalPrice != null ? String(sale.finalPrice) : "",
  );
  // `undefined` = "buyer unchanged". A real id reassigns; `null` reassigns to
  // "someone not on Hatiwal". Three states, so an untouched buyer is never sent.
  const [newBuyerId, setNewBuyerId] = useState<number | null | undefined>(
    undefined,
  );
  const [pickingBuyer, setPickingBuyer] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmVoid, setConfirmVoid] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Latched from a 422: once the server has said this sale carries a review, the
  // controls that cannot work are withdrawn instead of failing again.
  const [reviewed, setReviewed] = useState(false);

  const { data: conversations, isPending: loadingBuyers } = useQuery({
    queryKey: ["listing-conversations", listing.id],
    queryFn: () => getConversations(listing.id).then((r) => r.items),
    enabled: pickingBuyer,
  });

  // What the buyer column shows right now: the reassignment if one is staged,
  // otherwise what is on record.
  const stagedBuyer =
    newBuyerId === undefined
      ? sale.buyer
      : newBuyerId === null
        ? null
        : ((conversations ?? [])
            .map((c) => c.buyer ?? c.otherParticipant)
            .find((b) => b?.id === newBuyerId) ?? sale.buyer);

  function handleFailure(err: unknown) {
    if (isReviewedSaleRefusal(err)) {
      setReviewed(true);
      setPickingBuyer(false);
      // Drop the staged reassignment: it is the thing that was refused, and
      // leaving it on screen would show a buyer who is not the buyer of record.
      setNewBuyerId(undefined);
    }
    // Only `sale_has_review` can reach here, and it needs no count.
    setError(apiErrorMessage(err, t) ?? t("common.error"));
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const parsedPrice = price.trim() ? Number(price) : undefined;
      if (parsedPrice != null && (!Number.isFinite(parsedPrice) || parsedPrice <= 0)) {
        setError(t("buyerPicker.invalidPrice"));
        return;
      }
      await correctMySale(sale.id, {
        quantity: units,
        finalPrice: parsedPrice,
        ...(newBuyerId === undefined
          ? {}
          : newBuyerId === null
            ? { clearBuyer: true }
            : { buyerId: newBuyerId }),
      });
      onCorrected();
    } catch (err) {
      handleFailure(err);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      await voidMySale(sale.id);
      onVoided();
    } catch (err) {
      setConfirmVoid(false);
      handleFailure(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Dialog
        open
        onClose={onClose}
        labelledBy={titleId}
        dismissible={!busy}
        className="flex max-h-[85vh] max-w-sm flex-col"
      >
        <h2 id={titleId} className="text-lg font-semibold">
          {t("listing.sale.editSale")}
        </h2>
        <p className="mt-1 line-clamp-2 text-sm font-medium text-foreground">
          {listing.title}
        </p>

        <div className="-mx-1 my-4 flex-1 space-y-4 overflow-y-auto px-1">
          {/* WHO */}
          <div className="space-y-2">
            {stagedBuyer ? (
              <UserIdentity
                name={stagedBuyer.name}
                avatarUrl={stagedBuyer.avatarUrl}
                size={36}
              />
            ) : (
              <div className="flex items-center gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  <UserX className="size-4" />
                </span>
                <span className="truncate font-semibold text-foreground">
                  {t("listing.sale.outsideBuyer")}
                </span>
              </div>
            )}

            {/* Frozen on a reviewed sale — reassigning is what would orphan the
                review, so the control is withdrawn rather than left to fail. */}
            {!reviewed &&
              (pickingBuyer ? (
                <div className="space-y-1.5">
                  {loadingBuyers ? (
                    <div className="flex justify-center py-3">
                      <Loader2 className="size-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    <>
                      {(conversations ?? []).map((c) => {
                        const buyer = c.buyer ?? c.otherParticipant;
                        if (!buyer) return null;
                        return (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => {
                              setNewBuyerId(buyer.id);
                              setPickingBuyer(false);
                            }}
                            className={cn(
                              "flex w-full items-center gap-3 rounded-md border px-3 py-2 text-start transition-colors",
                              newBuyerId === buyer.id
                                ? "border-primary bg-primary/5"
                                : "border-input hover:bg-accent",
                            )}
                          >
                            <UserAvatar
                              name={buyer.name}
                              avatarUrl={buyer.avatarUrl}
                              size={32}
                            />
                            <span className="truncate text-sm font-medium">
                              {buyer.name}
                            </span>
                          </button>
                        );
                      })}
                      <button
                        type="button"
                        onClick={() => {
                          setNewBuyerId(null);
                          setPickingBuyer(false);
                        }}
                        className="flex w-full items-center gap-3 rounded-md border border-input px-3 py-2 text-start text-sm transition-colors hover:bg-accent"
                      >
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                          <UserX className="size-3.5" />
                        </span>
                        {tb("someoneElse")}
                      </button>
                    </>
                  )}
                </div>
              ) : (
                <Button
                  variant="link"
                  size="sm"
                  className="h-auto p-0"
                  disabled={busy}
                  onClick={() => setPickingBuyer(true)}
                >
                  {t("listing.sale.changeBuyer")}
                </Button>
              ))}
          </div>

          {/* HOW MANY — batches only. A single-item sale has no count to fix;
              its only possible correction is removing it, which the button
              below does. */}
          {multiUnit && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor={unitsId}>
                {t("listing.form.howManySold")}
              </label>
              <QuantityStepper
                id={unitsId}
                value={units}
                onChange={setUnits}
                max={capacity}
                disabled={busy}
              />
            </div>
          )}

          {/* FOR HOW MUCH */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor={priceId}>
              {tb("finalPriceLabel")}
            </label>
            <Input
              id={priceId}
              type="number"
              inputMode="numeric"
              value={price}
              disabled={busy}
              onChange={(e) => setPrice(e.target.value)}
              placeholder={tb("finalPricePlaceholder")}
            />
            {multiUnit && (
              <p className="text-xs text-muted-foreground">
                {tb("finalPricePerUnitHint")}
              </p>
            )}
          </div>

          {error && (
            <p
              role="alert"
              data-testid="sale-edit-error"
              className="text-sm text-destructive"
            >
              {error}
            </p>
          )}
        </div>

        <div className="flex items-center justify-between gap-2">
          {/* Withdrawn on a reviewed sale. */}
          {!reviewed ? (
            <Button
              variant="ghost"
              className="text-destructive hover:text-destructive"
              disabled={busy}
              onClick={() => setConfirmVoid(true)}
            >
              {t("common.delete")}
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={busy}>
              {t("common.cancel")}
            </Button>
            <Button onClick={save} disabled={busy}>
              {busy && <Loader2 className="size-4 animate-spin" />}
              {t("common.save")}
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Removing a sale puts its units back on the shelf and, if this sale was
          what retired the listing, puts the listing back on the market. Worth
          confirming, and worth SAYING both consequences — a seller reading only
          "remove this sale?" cannot tell whether their stock comes back. */}
      <ConfirmDialog
        open={confirmVoid}
        title={t("listing.sale.voidConfirm")}
        description={t("listing.sale.voidConfirmDescription")}
        confirmLabel={t("common.delete")}
        cancelLabel={t("common.cancel")}
        destructive
        loading={busy}
        onConfirm={remove}
        onCancel={() => setConfirmVoid(false)}
      />
    </>
  );
}
