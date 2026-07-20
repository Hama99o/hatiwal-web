"use client";

import { useId, useState } from "react";
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
  busy,
  onCancel,
  onConfirm,
}: {
  action: "reserve" | "sold";
  listingId: number;
  busy: boolean;
  onCancel: () => void;
  onConfirm: (buyerId: number | null, finalPrice: number | null) => void;
}) {
  const t = useTranslations("buyerPicker");
  const tc = useTranslations("common");
  const [selected, setSelected] = useState<Choice>(null);
  const [price, setPrice] = useState("");
  const titleId = useId();

  const { data: conversations, isPending } = useQuery({
    queryKey: ["listing-conversations", listingId],
    queryFn: () => getConversations(listingId),
  });

  function confirm() {
    const finalPrice = price.trim() ? Number(price) : null;
    if (finalPrice != null && (!Number.isFinite(finalPrice) || finalPrice <= 0)) {
      toast.error(t("invalidPrice"));
      return;
    }
    onConfirm(selected === "else" ? null : selected, finalPrice);
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
