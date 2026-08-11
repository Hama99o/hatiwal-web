"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { StartConversationButton } from "@/components/chat/start-conversation-button";
import { useIsOwner } from "@/components/auth/owner-gate";
import { PriceTag } from "@/components/shared/price-tag";
import { SaveButton } from "@/components/shared/save-button";
import { cn } from "@/lib/utils";
import type { ListingStatus } from "@/lib/types";

/**
 * The exact complement of Tailwind's `lg` (`min-width: 64rem`), so this JS gate
 * and the `lg:hidden` on the markup can never disagree about where the bar
 * belongs. It is written in `rem`, not `px`: inside a media query `rem` resolves
 * against the browser's INITIAL root font-size — the same basis Tailwind's own
 * `64rem` query uses — so a page that restyles `html { font-size }`, or a
 * text-only zoom, moves both breakpoints together. A hardcoded `1023px` moved
 * only this one, and at the widths in between the layout was single-column with
 * no sticky CTA at all.
 */
const COMPACT_VIEWPORT = "(max-width: 63.999rem)";

/** Same set the shared <Dialog> treats as focusable. */
const FOCUSABLE =
  'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

/**
 * Sticky bottom action bar for the listing detail page (phones/tablets only).
 *
 * On a phone the inline buyer CTA sits below the gallery, the price, the map and
 * the seller card — two-plus screens down — so the price anchor and "Message
 * seller" are both gone by the time a buyer has read the listing. This pins them
 * to the bottom of the viewport: price on the inline-start side, the SAME
 * `StartConversationButton` (message + offer, one conversation per buyer+listing)
 * and `SaveButton` on the inline-end side. Nothing about those flows is
 * re-implemented here — both components are reused, so state (saved heart, which
 * lives in one shared cache entry) and behaviour (conversation resolution) are
 * identical to the inline block.
 *
 * Visibility: one IntersectionObserver watches two things, and the bar shows only
 * when neither is on screen —
 *  1. the inline actions block, because duplicating a CTA the buyer is already
 *     looking at just covers the page for no gain;
 *  2. the site footer, because a `fixed` bar would sit on top of its last rows
 *     (the privacy / delete-account links) with no way to scroll them clear.
 *
 * The PRICE is governed separately (`priceAnchorId`), and only the price: it is
 * rendered here only while the hero price is off screen, so the bar can never
 * show "AFN 30,000" 120px under the identical hero price. It is deliberately NOT
 * in the hide set above — measured on listing 2 at 390x760, the hero price block
 * ends at y=651 and the inline actions block starts at y=1201, a 550px gap
 * inside a 760px viewport (742px with a location map, still short). Hiding the
 * whole bar whenever the price is visible would therefore leave NO scroll
 * position where it appears at all, deleting the feature. So the bar keeps the
 * CTA pinned from the first paint — which is also what mobile does, with no price
 * in its sticky bar at all (ListingDetail.tsx: offer + contact only) — and the
 * price fades in as an extra anchor once the real one is gone.
 *
 * Hidden for the listing's own seller (`useIsOwner` — the same one rule every
 * buyer control on the page uses) and for non-active (reserved/sold) listings,
 * which show an inline notice plus recovery CTAs instead. Because the bar decides
 * that for itself, it also renders the spacer that keeps it off the page's last
 * rows — a viewer who gets no bar must not get its reserved space either.
 *
 * Half-typed messages: the shared `Dialog` is portalled to <body>, so hiding
 * this bar can no longer fade/inert an open message or offer dialog. What CAN
 * still destroy one is UNMOUNTING this component — crossing `lg` mid-compose by
 * rotating a tablet, or dragging a desktop window across 1024px — so while it
 * hosts an open dialog the bar stays mounted (`dialogOpen` below) even at desktop
 * widths, where `lg:hidden` keeps it invisible. Nothing is duplicated: the bar's
 * own controls are unreachable, only the portalled dialog is on screen.
 */
export function ListingActionBar({
  listingId,
  sellerId,
  status,
  price,
  currency,
  initialSaved,
  sentinelId,
  priceAnchorId,
}: {
  listingId: number;
  /** The listing's seller — the bar hides on your own listing. */
  sellerId?: number;
  status: ListingStatus;
  price: number | null;
  currency?: string | null;
  initialSaved?: boolean;
  /** DOM id of the inline actions block that toggles this bar. */
  sentinelId: string;
  /**
   * DOM id of the hero price block. While it is on screen the bar shows no
   * price — see the header note on why this governs the price only, never the
   * whole bar. Omit it and the price is always shown.
   */
  priceAnchorId?: string;
}) {
  const t = useTranslations();
  const isOwner = useIsOwner(sellerId);
  const [compact, setCompact] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  // Assumed ON SCREEN until the observer says otherwise, so the very first paint
  // can never be the one that shows the price twice.
  const [heroPriceOnScreen, setHeroPriceOnScreen] = useState(true);
  // The bar reserves its own space with a spacer, and the spacer takes its height
  // from the bar itself rather than a hand-computed constant — see below.
  const barRef = useRef<HTMLDivElement | null>(null);
  const [barHeight, setBarHeight] = useState<number | null>(null);
  // Read inside the dialog callback, which must not re-create itself on every
  // scroll tick (its identity is a dep of the child's report effect).
  const visibleRef = useRef(false);
  visibleRef.current = compact && pinned;
  // Last state the child reported, so the focus handoff below fires on a real
  // open→close transition only (the child re-reports on every dep change).
  const reportedRef = useRef(false);

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
    // Things that REPLACE this bar: while either is on screen it gets out of the
    // way entirely.
    const hide = [
      document.getElementById(sentinelId),
      document.querySelector("[data-site-footer]"),
    ].filter((el): el is Element => el != null);
    // The hero price: governs the bar's own price only (see header note).
    const priceAnchor = priceAnchorId
      ? document.getElementById(priceAnchorId)
      : null;
    const watched = priceAnchor ? [...hide, priceAnchor] : hide;
    // Nothing to watch (shouldn't happen for an active listing) → keep the CTA
    // pinned rather than silently losing it, and stop withholding the price.
    if (watched.length === 0) {
      setPinned(true);
      setHeroPriceOnScreen(false);
      return;
    }
    // One observer, several targets: track which are on screen, then derive both
    // rules from that one set.
    const onScreen = new Set<Element>();
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) onScreen.add(entry.target);
        else onScreen.delete(entry.target);
      }
      setPinned(!hide.some((el) => onScreen.has(el)));
      setHeroPriceOnScreen(priceAnchor != null && onScreen.has(priceAnchor));
    });
    watched.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [compact, sentinelId, priceAnchorId]);

  // The spacer must be exactly as tall as the bar. A hand-written
  // `calc(4rem + safe-area)` was 1px short of the real 65px (12 + 40 + 12 + the
  // 1px border) and would have drifted silently the next time anything was added
  // to the row, so the bar publishes its measured height instead. `display: none`
  // at `lg` measures 0, which is exactly right — no bar, no reserved space.
  useEffect(() => {
    const el = barRef.current;
    if (!el) return;
    const measure = () => setBarHeight(el.getBoundingClientRect().height);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [compact, dialogOpen]);

  const onDialogOpenChange = useCallback(
    (open: boolean) => {
      const wasOpen = reportedRef.current;
      reportedRef.current = open;
      setDialogOpen(open);
      if (open || !wasOpen || visibleRef.current) return;
      // The dialog just closed and this bar is NOT on screen (the inline block
      // scrolled into view, or the viewport crossed `lg` mid-compose). The shared
      // <Dialog> restores focus to the button that opened it — a button that is
      // about to be `inert`, or already `display: none` — which drops the caret
      // at <body> and makes the next Tab restart at the top of the document. Hand
      // it to the inline control that replaces us instead; it is on screen
      // whenever we are not.
      const inline = document
        .getElementById(sentinelId)
        ?.querySelector<HTMLElement>(FOCUSABLE);
      inline?.focus({ preventScroll: true });
    },
    [sentinelId],
  );

  // reserved / sold / draft show an inline notice — no buyer CTA to pin.
  if (status !== "active") return null;
  // Your own listing: the inline block hides its actions too.
  if (isOwner) return null;
  // Desktop — except while we host an open dialog, which unmounting would take
  // with it (see the header note); `lg:hidden` keeps the bar itself invisible.
  if (!compact && !dialogOpen) return null;

  // Shown when the observer says so, and while this bar hosts an open dialog:
  // sliding out from under the scrim, only to slide back in on close, is noise.
  const shown = (compact && pinned) || dialogOpen;

  return (
    <>
      {/* The bar is `fixed`, so it takes up no space in the flow and would sit on
          top of the page's last rows (the last rail, the report link) with no way
          to scroll them clear. This spacer reserves its height — MEASURED from the
          bar (padding + buttons + border + the iOS home-indicator inset), not
          hand-computed, so nothing added to the row later can desync it — and it
          ships with the bar rather than as padding on the page because only this
          component knows whether a bar exists at all: desktop, a sold/reserved
          listing and the seller's own listing all return above, and none of them
          may get a strip of dead space above the footer. The class is the
          first-paint fallback until the measurement lands. The page's own bottom
          padding supplies the gap between content and bar. */}
      <div
        aria-hidden
        data-testid="action-bar-spacer"
        style={barHeight != null ? { height: barHeight } : undefined}
        className="h-[calc(4.0625rem+env(safe-area-inset-bottom))] lg:hidden"
      />
      <div
        ref={barRef}
        role="region"
        aria-label={t("listing.detail.actionBarLabel")}
        // Keeps the hidden bar out of the a11y tree and un-focusable.
        inert={!shown}
        className={cn(
          "fixed inset-x-0 z-40 border-t px-4 pt-3 lg:hidden",
          // Frosted, like the site header. Safe on this element now that the
          // dialogs are portalled to <body>: `backdrop-filter` (like `transform`)
          // makes an element the containing block for its `position: fixed`
          // descendants, which used to tear the message/offer dialogs out of the
          // viewport — so this lived on a separate layer.
          "bg-background/95 backdrop-blur",
          // Honour the iOS home-indicator inset on top of the base padding.
          "pb-[calc(0.75rem+env(safe-area-inset-bottom))]",
          "transition-[bottom,opacity] duration-200 ease-out motion-reduce:transition-none",
          shown
            ? "bottom-0 opacity-100"
            : "pointer-events-none -bottom-40 opacity-0",
        )}
      >
        {/* Flex row mirrors itself in RTL: the price sits on the inline-start
            side, the actions on the inline-end side, in every locale. The price is
            `shrink-0` — a truncated price would misinform the buyer, so the CTA
            gives up width first. */}
        <div className="mx-auto flex max-w-6xl items-center gap-3">
          {/* Only once the hero price is gone: the buyer needs ONE price on
              screen, not the same number twice 120px apart (header note). Until
              then the CTA takes the width instead — the same trade mobile makes,
              whose sticky bar carries no price at all. */}
          {!heroPriceOnScreen && (
            <PriceTag
              price={price}
              currency={currency}
              className="shrink-0 whitespace-nowrap"
            />
          )}
          {/* No `negotiable`: `layout="bar"` carries the Message CTA alone. The
              offer affordance stays in the inline block (see that component's
              note — a second control here clipped the primary label on a 360px
              phone), so a firm-price flag would have nothing to gate. */}
          <StartConversationButton
            listingId={listingId}
            sellerId={sellerId}
            price={price}
            currency={currency}
            layout="bar"
            onDialogOpenChange={onDialogOpenChange}
          />
          {/* `bar` chrome, not the photo-overlay circle: in a solid toolbar the
              heart has to read as a sibling of the Message button beside it. */}
          <SaveButton
            listingId={listingId}
            initialSaved={initialSaved}
            ownerId={sellerId}
            variant="bar"
          />
        </div>
      </div>
    </>
  );
}
