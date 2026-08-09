"use client";

/**
 * SearchHistoryPanel — "Recent searches" chips, the web port of the history
 * block in mobile's `BrowseHeader.tsx`.
 *
 * Shared by BOTH web search entry points (site header + Bazaar sidebar) so the
 * markup exists once. The caller owns the open/close logic (focus, empty value,
 * Escape) and the history itself (`useSearchHistory`) — this component only
 * renders and reports intent:
 *
 *   - clicking a chip's label → `onSelect(term)` (apply that search)
 *   - clicking a chip's X     → `onRemove(term)` (forget just that term)
 *   - "Clear all"             → `onClear()`
 *
 * `variant="dropdown"` (default) floats the panel under the field — the caller
 * must give the wrapper `position: relative`. `variant="inline"` renders it in
 * normal flow, for narrow columns where an overlay would be clipped.
 *
 * `layout="wrap"` (default) wraps the chips onto as many rows as needed — right
 * for the wide header dropdown. `layout="scroll"` keeps them on ONE horizontally
 * scrollable row (mirrors mobile's `ScrollView horizontal`) — right for the
 * narrow Bazaar sidebar, where it also guarantees the chips can never widen the
 * page.
 */

import { History, X } from "lucide-react";
import { useTranslations } from "next-intl";
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
  id?: string;
}

export function SearchHistoryPanel({
  history,
  onSelect,
  onRemove,
  onClear,
  variant = "dropdown",
  layout = "wrap",
  className,
  id,
}: SearchHistoryPanelProps) {
  const t = useTranslations();

  if (history.length === 0) return null;

  return (
    <div
      id={id}
      data-testid="search-history-panel"
      // Pressing inside the panel must not blur the search field. The dropdown
      // variant is mounted only while the field has focus, so a blur would
      // unmount it before the click ever landed on a chip — and a relatedTarget
      // check alone can't save us (Safari doesn't focus a pressed <button> at
      // all). Harmless for the inline variant, which keeps the caret put.
      onMouseDown={(event) => event.preventDefault()}
      className={cn(
        "rounded-xl border bg-popover p-3 text-popover-foreground",
        variant === "dropdown" &&
          "absolute inset-x-0 top-full z-50 mt-1 shadow-md",
        variant === "inline" && "mt-2",
        className,
      )}
    >
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="inline-flex min-w-0 items-center gap-1.5 text-xs font-semibold text-muted-foreground">
          <History className="size-3.5 shrink-0" aria-hidden />
          <span className="truncate">{t("browse.recentSearches")}</span>
        </span>
        <button
          type="button"
          onClick={onClear}
          className="shrink-0 rounded-md text-xs font-medium text-primary transition-colors hover:text-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          {t("browse.clearHistory")}
        </button>
      </div>

      <ul
        className={cn(
          "flex gap-2",
          layout === "wrap" && "flex-wrap",
          // One row that scrolls sideways — the chips can never widen the
          // sidebar (mirrors mobile's horizontal ScrollView).
          layout === "scroll" && "-mb-1 overflow-x-auto pb-1 [scrollbar-width:thin]",
        )}
      >
        {history.map((term) => (
          <li
            key={term.toLowerCase()}
            className={cn(
              "inline-flex max-w-full items-center gap-1 rounded-full bg-muted py-1 pe-1.5 ps-3 transition-colors hover:bg-accent",
              layout === "scroll" && "shrink-0",
            )}
          >
            <button
              type="button"
              onClick={() => onSelect(term)}
              title={term}
              className="min-w-0 max-w-[9rem] truncate rounded-full text-start text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              {term}
            </button>
            <button
              type="button"
              onClick={() => onRemove(term)}
              aria-label={t("browse.removeSearch", { term })}
              className="grid size-5 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <X className="size-3" aria-hidden />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
