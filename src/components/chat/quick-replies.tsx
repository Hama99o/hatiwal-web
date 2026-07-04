"use client";

/**
 * QuickReplies — a horizontally scrollable row of canned-phrase chips shown
 * above the message composer. Tapping a chip inserts the localized phrase into
 * the draft (the parent appends it and focuses the input) — no auto-send.
 *
 * Mirrors the mobile `QuickReplies` component and reuses the same
 * `chat.quickReplies.*` i18n keys so both clients stay legible together.
 *
 *   role     — "buyer" or "seller"; selects which phrase set is shown.
 *   onSelect — called with the localized phrase when a chip is clicked.
 *
 * RTL: `dir` is set on <html>, so the flex row and horizontal scroll mirror
 * automatically. Colors are token classes only; correct in light and dark.
 */

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

export type QuickRepliesRole = "buyer" | "seller";

const BUYER_KEYS = [
  "chat.quickReplies.buyer.stillAvailable",
  "chat.quickReplies.buyer.lowestPrice",
  "chat.quickReplies.buyer.whereMeet",
  "chat.quickReplies.buyer.morePhotos",
  "chat.quickReplies.buyer.negotiable",
] as const;

const SELLER_KEYS = [
  "chat.quickReplies.seller.yesAvailable",
  "chat.quickReplies.seller.meetAtPlace",
  "chat.quickReplies.seller.priceFirm",
  "chat.quickReplies.seller.whenFree",
  "chat.quickReplies.seller.sendMorePhotos",
] as const;

export function QuickReplies({
  role,
  onSelect,
  className,
}: {
  role: QuickRepliesRole;
  onSelect: (phrase: string) => void;
  className?: string;
}) {
  const t = useTranslations();
  const keys = role === "seller" ? SELLER_KEYS : BUYER_KEYS;

  return (
    <div
      role="toolbar"
      aria-label={t("chat.quickReplies.toolbarLabel")}
      className={cn(
        "flex items-center gap-2 overflow-x-auto border-t bg-card px-3 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        className,
      )}
    >
      {keys.map((key) => {
        const phrase = t(key);
        return (
          <button
            key={key}
            type="button"
            onClick={() => onSelect(phrase)}
            className="shrink-0 whitespace-nowrap rounded-full border bg-background px-3.5 py-1.5 text-sm text-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            {phrase}
          </button>
        );
      })}
    </div>
  );
}
