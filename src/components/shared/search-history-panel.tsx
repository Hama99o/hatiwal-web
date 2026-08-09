"use client";

/**
 * SearchHistoryPanel — "Recent searches" chips, the web port of the history
 * block in mobile's `BrowseHeader.tsx`.
 *
 * Shared by BOTH web search entry points through `SearchBox` (site header +
 * Bazaar sidebar) so the markup exists once. The caller owns the open/close
 * logic (focus, empty value, Escape) and the history itself
 * (`useSearchHistory`) — this component only renders and reports intent:
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
 * `layout="wrap"` (default) wraps the chips onto as many rows as needed — right
 * for the wide header dropdown. `layout="scroll"` keeps them on ONE horizontally
 * scrollable row (mirrors mobile's `ScrollView horizontal`) — right for the
 * narrow Bazaar sidebar, where it also guarantees the chips can never widen the
 * page.
 *
 * Touch targets: every chip (label + X) and "Clear all" is 44px tall — the
 * whole point of the panel is being tappable on a phone.
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
  layout?: "wrap" | "scroll";
  className?: string;
}

export function SearchHistoryPanel({
  history,
  onSelect,
  onRemove,
  onClear,
  variant = "dropdown",
  layout = "wrap",
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
          "absolute inset-x-0 top-full z-50 mt-1 rounded-xl border bg-popover p-3 text-popover-foreground shadow-md",
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

      <ul
        className={cn(
          "flex gap-2",
          layout === "wrap" && "flex-wrap",
          // One row that scrolls sideways — the chips can never widen the
          // sidebar (mirrors mobile's horizontal ScrollView).
          layout === "scroll" &&
            "-mb-1 overflow-x-auto pb-1 [scrollbar-width:thin]",
        )}
      >
        {history.map((term) => (
          <li
            key={term.toLowerCase()}
            // Hover has to be visible in BOTH themes: --muted and --accent are
            // the same value here, so `hover:bg-accent` would be a no-op. The
            // pill tints toward the primary instead, and the label follows.
            className={cn(
              "group inline-flex h-11 max-w-full items-center rounded-full border border-transparent bg-muted transition-colors hover:border-primary/40 hover:bg-primary/10",
              layout === "scroll" && "shrink-0",
            )}
          >
            <Button
              type="button"
              variant="ghost"
              onClick={() => onSelect(term)}
              title={term}
              className="h-11 min-w-0 rounded-full px-3 text-sm font-normal text-foreground hover:bg-transparent group-hover:text-primary"
            >
              <span className="max-w-[9rem] truncate">{term}</span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => onRemove(term)}
              aria-label={t("browse.removeSearch", { term })}
              className="size-11 rounded-full text-muted-foreground hover:bg-transparent hover:text-destructive"
            >
              <X aria-hidden />
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
