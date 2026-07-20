"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Star } from "lucide-react";
import { getPendingReviews } from "@/lib/api/reviews";
import { ReviewPromptDialog } from "@/components/shared/review-prompt-dialog";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";
import type { Transaction } from "@/lib/types";

/**
 * "Rate your recent deals" card on the profile — sold transactions the caller
 * still owes a review on (REV2). Renders nothing when there's nothing pending
 * (or on error): a nudge must never show an error where a value is expected.
 * Tapping a row opens the ReviewPromptDialog; a submitted review refetches so
 * the row drops off.
 */
export function PendingReviewsNudge() {
  const t = useTranslations("reviews");
  const qc = useQueryClient();
  const [active, setActive] = useState<Transaction | null>(null);
  const { data } = useQuery({
    queryKey: ["pending-reviews"],
    queryFn: getPendingReviews,
  });

  if (!data || data.length === 0) return null;

  return (
    <div className="space-y-3 rounded-lg border bg-card p-4">
      <div className="flex items-center gap-2">
        <Star className="size-4 fill-warning text-warning" />
        <h2 className="text-sm font-semibold">{t("pendingTitle")}</h2>
      </div>
      <ul className="space-y-2">
        {data.map((txn) => {
          const counterparty =
            txn.role === "seller" ? txn.buyer : txn.seller;
          return (
            <li key={txn.id} className="flex items-center gap-3">
              <UserAvatar
                name={counterparty.name}
                avatarUrl={counterparty.avatarUrl}
                size={36}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {counterparty.name}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {txn.listing.title}
                </p>
              </div>
              <Button size="sm" onClick={() => setActive(txn)}>
                {t("rate")}
              </Button>
            </li>
          );
        })}
      </ul>
      {active && (
        <ReviewPromptDialog
          transaction={active}
          onClose={() => setActive(null)}
          onSubmitted={() =>
            qc.invalidateQueries({ queryKey: ["pending-reviews"] })
          }
        />
      )}
    </div>
  );
}
