"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { StartConversationButton } from "@/components/chat/start-conversation-button";
import { useAuth } from "@/components/auth/auth-provider";
import { PriceTag } from "@/components/shared/price-tag";
import { SaveButton } from "@/components/shared/save-button";
import { cn } from "@/lib/utils";
import type { ListingStatus } from "@/lib/types";

/** Matches the `lg:hidden` breakpoint — the bar is a phone/tablet affordance. */
const COMPACT_VIEWPORT = "(max-width: 1023px)";

/**
 * Sticky bottom action bar for the listing detail page (phones/tablets only).
 *
 * On a phone the inline buyer CTA sits below the gallery, the price, the map and
 * the seller card — two-plus screens down — so the price anchor and "Message
 * seller" are both gone by the time a buyer has read the listing. This pins them
 * to the bottom of the viewport: price on the inline-start side, the SAME
 * `StartConversationButton` (message + offer, one conversation per buyer+listing)
 * and `SaveButton` on the inline-end side. Nothing about those flows is
 * re-implemented here — both components are reused, so state (saved heart) and
 * behaviour (conversation resolution) are identical to the inline block.
 *
 * Visibility: an IntersectionObserver watches the inline actions block; the bar
 * is hidden while that block is on screen and slides in whenever it is not.
 * Hidden for the listing's own seller and for non-active (reserved/sold)
 * listings, which show an inline notice instead.
 *
 * Implementation note — the slide animation uses `bottom`, NOT `translate`: a
 * transform/translate on this element would make it the containing block for its
 * `position: fixed` descendants, which would break the message/offer dialogs
 * rendered inside `StartConversationButton`.
 */
export function ListingActionBar({
  listingId,
  sellerId,
  status,
  price,
  currency,
  negotiable,
  initialSaved,
  sentinelId,
}: {
  listingId: number;
  /** The listing's seller — the bar hides on your own listing. */
  sellerId?: number;
  status: ListingStatus;
  price: number | null;
  currency?: string | null;
  /** false = firm price: the offer affordance is hidden (mirrors mobile N071). */
  negotiable?: boolean;
  initialSaved?: boolean;
  /** DOM id of the inline actions block that toggles this bar. */
  sentinelId: string;
}) {
  const t = useTranslations();
  const { user } = useAuth();
  const [compact, setCompact] = useState(false);
  const [pinned, setPinned] = useState(false);

  // Only mount below `lg` — at desktop widths the inline column CTA is always in
  // reach, and keeping the bar out of the DOM avoids duplicate controls there.
  useEffect(() => {
    const mql = window.matchMedia(COMPACT_VIEWPORT);
    const apply = () => setCompact(mql.matches);
    apply();
    mql.addEventListener("change", apply);
    return () => mql.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    if (!compact) return;
    const el = document.getElementById(sentinelId);
    // No sentinel (shouldn't happen for an active listing) → keep the CTA pinned
    // rather than silently losing it.
    if (!el) {
      setPinned(true);
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      const entry = entries[0];
      if (entry) setPinned(!entry.isIntersecting);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [compact, sentinelId]);

  if (!compact) return null;
  // reserved / sold / draft show an inline notice — no buyer CTA to pin.
  if (status !== "active") return null;
  // Your own listing: the inline block hides its actions too.
  if (user && sellerId != null && user.id === sellerId) return null;

  return (
    <div
      role="region"
      aria-label={t("listing.detail.actionBarLabel")}
      // Keeps the hidden bar out of the a11y tree and un-focusable.
      inert={!pinned}
      className={cn(
        "fixed inset-x-0 z-40 border-t px-4 pt-3 lg:hidden",
        // Honour the iOS home-indicator inset on top of the base padding.
        "pb-[calc(0.75rem+env(safe-area-inset-bottom))]",
        "transition-[bottom,opacity] duration-200 ease-out motion-reduce:transition-none",
        pinned ? "bottom-0 opacity-100" : "pointer-events-none -bottom-40 opacity-0",
      )}
    >
      {/* The frosted background is its own layer on purpose: `backdrop-filter`
          (like `transform`) makes an element the containing block for its
          `position: fixed` descendants, which would tear the message/offer
          dialogs out of the viewport. Keeping the blur on a sibling layer keeps
          the look without capturing the dialogs. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-background/95 backdrop-blur"
      />
      {/* Flex row mirrors itself in RTL: the price sits on the inline-start
          side, the actions on the inline-end side, in every locale. The price is
          `shrink-0` — a truncated price would misinform the buyer, so the CTA
          gives up width first. */}
      <div className="mx-auto flex max-w-6xl items-center gap-3">
        <PriceTag
          price={price}
          currency={currency}
          className="shrink-0 whitespace-nowrap"
        />
        <StartConversationButton
          listingId={listingId}
          sellerId={sellerId}
          price={price}
          currency={currency}
          negotiable={negotiable}
          layout="bar"
        />
        <SaveButton
          listingId={listingId}
          initialSaved={initialSaved}
          ownerId={sellerId}
          className="shrink-0 border"
        />
      </div>
    </div>
  );
}
