"use client";

/**
 * SearchHistoryPanel — "Recent searches" chips, the web port of the history
 * block in mobile's `BrowseHeader.tsx`.
 *
 * Shared by BOTH web search entry points through `SearchBox` (site header +
 * Bazaar sidebar) so the markup exists once. The caller owns when the panel
 * shows and the history itself (`useSearchHistory`) — this component only
 * renders and reports intent:
 *
 *   - clicking a chip's label → `onSelect(term)` (apply that search)
 *   - clicking a chip's X     → `onRemove(term)` (forget just that term)
 *   - "Clear all"             → `onClear()`
 *
 * `variant="dropdown"` (default) floats the panel under the field as a popover
 * — the caller must give the wrapper `position: relative`. `variant="inline"`
 * renders it flat in normal flow (no card of its own, so it never reads as a
 * card inside a card) for narrow columns where an overlay would be clipped.
 *
 * The chips always WRAP: a sideways-scrolling row is a phone gesture, and both
 * web hosts are mouse-first (the Bazaar field is desktop-only). Wrapping also
 * means the block can never widen its column — chips shrink and truncate. The
 * row cap keeps a 10-term history from pushing the filters far down the page;
 * past that the list scrolls vertically, which a wheel can actually reach.
 *
 * Touch/pointer targets: every chip half (label + X) and "Clear all" is 44px
 * tall. Each half tints on its OWN hover — the label toward the primary ("this
 * runs a search"), the X toward destructive ("this forgets it", same grammar as
 * the saved-search rows below it in the sidebar) — so a hover never promises the
 * wrong action.
 */

import { useId } from "react";
import { History, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SearchHistoryPanelProps {
  /** Most-recent-first terms. The panel renders nothing when empty. */
  history: string[];
  onSelect: (term: string) => void;
  onRemove: (term: string) => void;
  onClear: () => void;
  variant?: "dropdown" | "inline";
  className?: string;
}

export function SearchHistoryPanel({
  history,
  onSelect,
  onRemove,
  onClear,
  variant = "dropdown",
  className,
}: SearchHistoryPanelProps) {
  const t = useTranslations();
  const headingId = `${useId()}-recent-searches`;

  if (history.length === 0) return null;

  return (
    <div
      data-testid="search-history-panel"
      role="group"
      aria-labelledby={headingId}
      // Pressing inside a FLOATING panel must not blur the search field: the
      // dropdown is mounted only while the field has focus, so the blur would
      // unmount it before the click ever landed on a chip — and a relatedTarget
      // check alone can't save us (Safari doesn't focus a pressed <button> at
      // all). The inline panel needs no such trick, and swallowing mousedown
      // there would only cost it the browser's native focus behaviour.
      onMouseDown={
        variant === "dropdown" ? (event) => event.preventDefault() : undefined
      }
      className={cn(
        variant === "dropdown" &&
          "absolute inset-x-0 top-full z-50 mt-1 rounded-xl border border-border bg-popover p-3 text-popover-foreground shadow-md",
        // Flat in flow — the sidebar already provides the surface.
        variant === "inline" && "mt-1",
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

      {/* `-m-1 p-1` gives the chips' focus ring (2px + 2px offset) room to draw
          instead of being clipped by the scroll box / panel edge. */}
      <ul className="-m-1 flex max-h-[13.5rem] flex-wrap gap-2 overflow-y-auto p-1 [scrollbar-width:thin]">
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
              className="h-11 min-w-0 rounded-none rounded-s-full px-3 text-sm font-normal text-foreground hover:bg-primary/10 hover:text-primary"
            >
              <span className="max-w-[9rem] truncate">{term}</span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => onRemove(term)}
              aria-label={t("browse.removeSearch", { term })}
              className="size-11 rounded-none rounded-e-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            >
              <X aria-hidden />
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
