"use client";

import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createReview } from "@/lib/api/reviews";
import { StarRatingInput } from "./star-rating-input";
import { UserAvatar } from "./user-avatar";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import type { Review, Transaction } from "@/lib/types";

/**
 * Leave-a-review modal for a completed sale (write side of REV2). POSTs the
 * rating/comment, then explains the double-blind rule — mirrors the mobile
 * ReviewPromptSheet. The caller mounts/unmounts this; `onClose` dismisses.
 *
 * `role` is the CALLER's side of the sale. It's required from the post-sale
 * (lifecycle) path because that transaction payload is serialized without a
 * current_user, so its own `role` is null — falling back to it would point the
 * prompt at the caller themselves. The pending-reviews list DOES carry `role`,
 * so there it can be omitted.
 */
export function ReviewPromptDialog({
  transaction,
  role,
  onClose,
  onSubmitted,
}: {
  transaction: Transaction;
  role?: "buyer" | "seller";
  onClose: () => void;
  onSubmitted?: () => void;
}) {
  const t = useTranslations("reviews");
  const iAmSeller = (role ?? transaction.role) === "seller";
  // The reviewer is always the OTHER side: a seller rates the buyer, a buyer
  // rates the seller.
  const counterparty = iAmSeller ? transaction.buyer : transaction.seller;
  const titleKey = iAmSeller ? "promptSellerTitle" : "promptBuyerTitle";

  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState<Review | null>(null);
  const titleId = useId();
  const commentId = useId();

  async function submit() {
    if (rating < 1) return;
    setBusy(true);
    try {
      const review = await createReview(transaction.id, {
        rating,
        comment: comment.trim() || undefined,
      });
      setSaved(review);
      onSubmitted?.();
    } catch {
      toast.error(t("error"));
      setBusy(false);
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      labelledBy={titleId}
      dismissible={!busy}
      className="max-w-sm space-y-4"
    >
      {saved ? (
        <>
          <h2 id={titleId} className="text-lg font-semibold">
            {t("submittedPendingTitle")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {/* A review is created hidden; it only reveals immediately if the
                counterparty had already rated. Show the right copy for each. */}
            {saved.visible
              ? t("thanks")
              : t("submittedPendingBody", { name: counterparty.name })}
          </p>
          <div className="flex justify-end">
            <Button onClick={onClose}>{t("gotIt")}</Button>
          </div>
        </>
      ) : (
        <>
          <div className="flex items-center gap-3">
            <UserAvatar
              name={counterparty.name}
              avatarUrl={counterparty.avatarUrl}
              size={40}
            />
            <div className="min-w-0">
              <h2 id={titleId} className="text-base font-semibold">
                {t(titleKey, { name: counterparty.name })}
              </h2>
              <p className="truncate text-xs text-muted-foreground">
                {transaction.listing.title}
              </p>
            </div>
          </div>

          <div className="space-y-1.5">
            <p className="text-sm font-medium">{t("ratingLabel")}</p>
            <StarRatingInput value={rating} onChange={setRating} />
          </div>

          <div className="space-y-1.5">
            <label htmlFor={commentId} className="text-sm font-medium">
              {t("commentLabel")}
            </label>
            <textarea
              id={commentId}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder={t("commentPlaceholder")}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          <p className="text-xs text-muted-foreground">{t("blindNotice")}</p>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose} disabled={busy}>
              {t("skip")}
            </Button>
            <Button onClick={submit} disabled={busy || rating < 1}>
              {busy && <Loader2 className="size-4 animate-spin" />}
              {t("submit")}
            </Button>
          </div>
        </>
      )}
    </Dialog>
  );
}
