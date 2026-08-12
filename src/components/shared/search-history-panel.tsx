"use client";

/**
 * SearchHistoryPanel — "Recent searches" chips, the web port of the history
 * block in mobile's `BrowseHeader.tsx`.
 *
 * Shared by BOTH web search entry points through `SearchBox` (site header +
 * Bazaar field) so the markup exists once. The caller owns when the panel shows,
 * the history itself (`useSearchHistory`) and the element id (so the field can
 * point `aria-controls` at it) — this component only renders and reports intent:
 *
 *   - clicking a chip's label → `onSelect(term)` (apply that search)
 *   - clicking a chip's X     → `onRemove(term)` (forget just that term)
 *   - "Clear all"             → `onClear()`
 *
 * It always floats under the field as a popover — the caller must give the
 * wrapper `position: relative`. One presentation on purpose: chips are a
 * secondary convenience, so they may cover the page for as long as the buyer is
 * in the field but must never take space from what they came for (results, or
 * the Bazaar's own filters).
 *
 * The chips WRAP: a sideways-scrolling row is a phone gesture, and both web
 * hosts are pointer-first. Chip LABELS shrink and truncate to whatever the panel
 * offers (the remove target never does — see below), and at `lg`+ the panel is
 * allowed to be wider than the field it hangs from: it takes no space in the
 * layout, so a 250px sidebar field can still show a readable history two chips
 * to a row instead of ten stacked ones. The height cap keeps it from covering
 * the whole viewport; past that the list scrolls vertically, which a wheel can
 * reach.
 *
 * Touch/pointer targets: every chip half (label + X) and "Clear all" is 44px
 * tall, and the X holds its 44px WIDTH however long the term is — a truncating
 * label may not eat the control that forgets it (measured at 33px before
 * `shrink-0`, and pinned by the 375px spec). Each half tints on its OWN hover —
 * the label toward the primary ("this runs a search"), the X toward destructive
 * ("this forgets it", same grammar as the saved-search rows in the sidebar) — so
 * a hover never promises the wrong action. The label keeps `text-foreground`
 * through the hover: the tint carries the affordance, and 14px `text-primary` on
 * `primary/10` would land under the 4.5:1 AA floor in light mode.
 */

import { History, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { FLOATING_PANEL_SURFACE } from "@/components/shared/floating-panel";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SearchHistoryPanelProps {
  /** Most-recent-first terms. The panel renders nothing when empty. */
  history: string[];
  onSelect: (term: string) => void;
  onRemove: (term: string) => void;
  onClear: () => void;
  /** Element id — the search field references it via `aria-controls`. */
  panelId: string;
  className?: string;
}

export function SearchHistoryPanel({
  history,
  onSelect,
  onRemove,
  onClear,
  panelId,
  className,
}: SearchHistoryPanelProps) {
  const t = useTranslations();
  const headingId = `${panelId}-heading`;

  if (history.length === 0) return null;

  return (
    <div
      id={panelId}
      data-testid="search-history-panel"
      role="group"
      aria-labelledby={headingId}
      // Pressing inside the panel must not blur the search field: the panel is
      // mounted only while the field has focus, so the blur would unmount it
      // before the click ever landed on a chip — and a relatedTarget check alone
      // can't save us (Safari doesn't focus a pressed <button> at all).
      onMouseDown={(event) => event.preventDefault()}
      className={cn(
        // Anchored to the field's START edge (logical, so it mirrors in RTL).
        //
        // Width is per-breakpoint, and both halves are field-relative so the
        // panel can never overhang the page's content box:
        //  - below `lg` the only field on screen is the header's, already as wide
        //    as the content column, so `w-full` (= the field) is both the widest
        //    useful panel and inherently inside the padding. A `100vw` cap can't
        //    do that job: `100vw` INCLUDES the scrollbar, so it resolves wider
        //    than the box the field sits in.
        //  - at `lg`+ the Bazaar's host column is only 250px, and matching it
        //    turned a full 10-term history into 10 stacked rows, most behind a
        //    scroll. It is a floating popover that takes no layout space, so it
        //    is allowed to be wider than its field: 24rem fits TWO chips per row
        //    at this type scale (measured), which puts the whole capped history
        //    on screen. `max(100%, …)` never narrows a field that is already
        //    wider (the header's is up to `max-w-md`), and at `lg`+ the viewport
        //    is ≥1024px, so 24rem from the column's start edge always fits.
        "absolute start-0 top-full z-50 mt-1 w-full p-3 lg:w-[max(100%,24rem)]",
        // Surface (radius/border/background/shadow) is the shared recipe, so this
        // panel, the location autocomplete and every Radix menu are one object.
        FLOATING_PANEL_SURFACE,
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <span
          id={headingId}
          className="inline-flex min-w-0 items-center gap-1.5 text-xs font-semibold text-muted-foreground"
        >
          <History className="size-3.5 shrink-0" aria-hidden />
          <span className="truncate">{t("browse.recentSearches")}</span>
        </span>
        <Button
          type="button"
          variant="link"
          size="sm"
          onClick={onClear}
          className="h-11 shrink-0 px-2 text-xs"
        >
          {t("browse.clearHistory")}
        </Button>
      </div>

      {/* `-m-1 p-1` gives the chips' 2px focus ring room to draw instead of being
          clipped by the scroll box / panel edge. The height cap
          holds six 44px rows — enough for the full 10-term cap at the two chips
          per row the widened panel gives, with a row of slack for longer terms —
          so a complete history is readable without scrolling. Past that the list
          scrolls vertically (thin scrollbar), which a wheel can reach. */}
      <ul className="-m-1 flex max-h-[19.5rem] flex-wrap gap-2 overflow-y-auto p-1 [scrollbar-width:thin]">
        {history.map((term) => (
          <li
            key={term.toLowerCase()}
            className="inline-flex h-11 max-w-full items-center rounded-full bg-muted"
          >
            <Button
              type="button"
              variant="ghost"
              onClick={() => onSelect(term)}
              title={term}
              // The two halves share one pill, so each takes only its own end's
              // radius — a hover tint then fills exactly the half it belongs to.
              // `ring-offset-0` for the same reason: the Button base offsets its
              // focus ring by 2px of `background`, which on a flush half draws a
              // page-coloured strip THROUGH the middle of the pill and over its
              // sibling. The ring hugging the half is what the arrow-key rove
              // needs to read cleanly.
              className="h-11 min-w-0 rounded-none rounded-s-full px-3 text-sm font-normal text-foreground hover:bg-primary/10 hover:text-foreground focus-visible:ring-offset-0"
            >
              {/* No fixed cap: the term uses whatever the panel has left (up to
                  the field's full width) and only truncates when it must.
                  `min-w-0` is what lets a nowrap flex child shrink at all. */}
              <span className="min-w-0 truncate">{term}</span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => onRemove(term)}
              aria-label={t("browse.removeSearch", { term })}
              // `shrink-0` is load-bearing: the pill is an `inline-flex` capped at
              // the panel width, so without it BOTH halves shrink and a long term
              // squeezes this target to 33px (measured at 375px) — under the 40px
              // floor, on the one control whose mis-tap costs a saved search. It
              // holds its 44px and the label (`min-w-0 truncate`) absorbs all the
              // shrink instead. `ring-offset-0` as on the label half.
              className="size-11 shrink-0 rounded-none rounded-e-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive focus-visible:ring-offset-0"
            >
              <X aria-hidden />
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
