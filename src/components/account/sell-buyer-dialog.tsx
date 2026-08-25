"use client";

import { useEffect, useId, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Loader2, UserX } from "lucide-react";
import { toast } from "sonner";
import { getConversations } from "@/lib/api/chat";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type Choice = number | "else" | null;

/**
 * Reserve/sold buyer picker (REV/TX). Lets the seller pick which buyer (from
 * this listing's conversations) is reserving/buying + an optional final price,
 * so Rails records a Transaction that both parties can then review. "Sold to
 * someone not on Hatiwal" records no buyer (no review possible) — mirrors the
 * mobile BuyerPickerSheet. The parent owns the lifecycle call + busy state.
 */
export function SellBuyerDialog({
  action,
  listingId,
  listingTitle,
  remainingQuantity,
  busy,
  onCancel,
  onConfirm,
}: {
  action: "reserve" | "sold";
  listingId: number;
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
  const [selected, setSelected] = useState<Choice>(null);
  const [price, setPrice] = useState("");
  // Only for a sale, and only when there is more than one left: reserving is a
  // hold on the whole listing, not a per-unit deduction the backend models.
  const asksQuantity = action === "sold" && (remainingQuantity ?? 1) > 1;
  // Pre-filled with the whole remainder, so "I sold the lot" stays one click.
  const [units, setUnits] = useState(String(remainingQuantity ?? 1));
  // Typed more than exists. Still allowed to confirm (it clamps, and so does the
  // API) — but the seller has to be able to SEE that the number they typed is
  // not the number that will be recorded. Silently clamping is how a typo became
  // a sold-out listing.
  const exceedsStock = asksQuantity && Number(units) > (remainingQuantity ?? 1);
  useEffect(() => {
    setUnits(String(remainingQuantity ?? 1));
  }, [remainingQuantity]);
  const titleId = useId();

  // Page 1 of this listing's threads (20, newest-message-first) — the buyers a
  // seller is actually mid-deal with. The picker deliberately has no load-more:
  // it is a decision surface, not a list to browse.
  const { data: conversations, isPending } = useQuery({
    queryKey: ["listing-conversations", listingId],
    queryFn: () => getConversations(listingId).then((r) => r.items),
  });

  function confirm() {
    const finalPrice = price.trim() ? Number(price) : null;
    if (finalPrice != null && (!Number.isFinite(finalPrice) || finalPrice <= 0)) {
      toast.error(t("invalidPrice"));
      return;
    }
    // Clamp to what is actually left. Rails clamps too, but a client that sends
    // an impossible number is a client bug worth not having.
    const parsedUnits = Number(units);
    const quantity =
      asksQuantity && Number.isFinite(parsedUnits) && parsedUnits > 0
        ? Math.min(Math.trunc(parsedUnits), remainingQuantity ?? 1)
        : null;
    onConfirm(
      selected === "else" ? null : selected,
      finalPrice,
      selected === "else" ? null : quantity,
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
        <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>

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

        {/* Nudge + final price only apply to a real buyer — a sale to "someone
            not on Hatiwal" records no transaction, so the final price has
            nowhere to attach (showing the field there would mislead). */}
        {typeof selected === "number" && (
          <>
            <p className="mb-3 text-xs text-muted-foreground">{t("nudge")}</p>
            {/* Above the price, because "how many" is answered before "for how
                much" — and it is what decides whether the listing stays live. */}
            {asksQuantity && (
              <div className="mb-3 space-y-1.5">
                <label className="text-sm font-medium" htmlFor="soldUnits">
                  {tl("form.howManySold")}
                </label>
                <Input
                  id="soldUnits"
                  type="number"
                  min={1}
                  max={remainingQuantity}
                  inputMode="numeric"
                  value={units}
                  onChange={(e) => setUnits(e.target.value)}
                  // The field is PRE-FILLED with the whole remainder, so a click
                  // just places a caret and typing inserts: a seller meaning 3
                  // produces "153", which the clamp then silently turns into
                  // "sold all 15" — the listing retires and the rest of their
                  // stock is gone. Reproduced on a real device on mobile (QA
                  // run-018: typed 3, recorded 15); the web input has the exact
                  // same shape, so it gets the same fix rather than waiting to
                  // be reported.
                  onFocus={(e) => e.currentTarget.select()}
                />
                <p
                  className={
                    exceedsStock
                      ? "text-xs text-destructive"
                      : "text-xs text-muted-foreground"
                  }
                >
                  {tl("stock.unitsAvailable", { count: remainingQuantity ?? 1 })}
                </p>
              </div>
            )}
            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="finalPrice">
                {t("finalPriceLabel")}
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
