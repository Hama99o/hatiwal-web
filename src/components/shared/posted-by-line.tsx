"use client";

import { useTranslations } from "next-intl";
import { UserRound } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import type { Listing } from "@/lib/types";

/**
 * "Posted by <member>" / "Posted by you" on a SHOP product, for its team
 * (owner, 2026-10-08; mobile PostedByLine). The API sends `postedBy` only on
 * member-scoped payloads (my/listings), so this renders nothing for buyers or
 * on a personal listing.
 */
export function PostedByLine({ postedBy, testId = "posted-by" }: { postedBy?: Listing["postedBy"]; testId?: string }) {
  const t = useTranslations("listing");
  const { user } = useAuth();
  if (!postedBy) return null;
  const mine = user != null && Number(user.id) === Number(postedBy.id);
  return (
    <p className="flex items-center gap-1 text-xs text-muted-foreground" data-testid={testId}>
      <UserRound className="size-3 shrink-0" aria-hidden />
      <span className="truncate" dir="auto">
        {mine ? t("postedByYou") : t("postedBy", { name: postedBy.name })}
      </span>
    </p>
  );
}
