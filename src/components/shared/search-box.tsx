"use client";

/**
 * SearchBox — the one search input the whole web client uses: the site header
 * and the Bazaar sidebar both render THIS, so the field, its clear button, the
 * recent-searches gating, the focus/Escape behaviour and the ARIA wiring exist
 * once instead of twice.
 *
 * The caller stays in charge of what a search DOES (the header navigates to
 * `/bazaar?q=…`, the Bazaar island updates its filters) and of recording a
 * committed term in the shared history (`useSearchHistory().add`) — its own
 * debounce decides when a search has really committed. This component owns only
 * the field UI and the panel's open/close rules:
 *
 *   open  ⇔  the field has focus AND is empty AND there is history
 *
 * Same rule for both entry points, so a chip never covers results the buyer is
 * already reading, and the panel only ever appears in response to a tap/click —
 * which also keeps it out of the page's layout-shift budget.
 */

import { useCallback, useId, useRef, useState } from "react";
import { SearchField } from "@/components/shared/search-field";
import { SearchHistoryPanel } from "@/components/shared/search-history-panel";
import { useSearchHistory } from "@/lib/use-search-history";

interface SearchBoxProps {
  value: string;
  onValueChange: (value: string) => void;
  /** Enter / form submit — apply the typed value immediately. */
  onSubmit: (value: string) => void;
  /**
   * Re-run a recent search. Defaults to `onSubmit`; pass it when applying a
   * stored term goes through a different path than a fresh submit.
   */
  onSelectRecent?: (term: string) => void;
  placeholder: string;
  /** Classes for the <form> element. */
  className?: string;
  /** `dropdown` floats the panel over the page; `inline` keeps it in flow. */
  panelVariant?: "dropdown" | "inline";
  panelLayout?: "wrap" | "scroll";
}

export function SearchBox({
  value,
  onValueChange,
  onSubmit,
  onSelectRecent,
  placeholder,
  className,
  panelVariant = "dropdown",
  panelLayout = "wrap",
}: SearchBoxProps) {
  // Read-only view of the shared store: recording is the caller's job (it knows
  // when its search committed), removing/clearing belongs to the panel.
  const { history, remove, clear } = useSearchHistory();
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelSlotRef = useRef<HTMLDivElement>(null);
  const panelId = `${useId()}-search-history`;

  const open = focused && value === "" && history.length > 0;

  const applyTerm = useCallback(
    (term: string) => {
      setFocused(false);
      onValueChange(term);
      (onSelectRecent ?? onSubmit)(term);
    },
    [onSelectRecent, onSubmit, onValueChange],
  );

  /**
   * Editing the history must not dismiss it: the X (or "Clear all") we just
   * pressed unmounts with its chip, which would drop focus to <body>. Hand
   * focus back to the field first so the caret — and the panel — stay put.
   */
  const keepFocus = useCallback(() => {
    inputRef.current?.focus();
    setFocused(true);
  }, []);

  const removeTerm = useCallback(
    (term: string) => {
      keepFocus();
      remove(term);
    },
    [keepFocus, remove],
  );

  const clearTerms = useCallback(() => {
    keepFocus();
    clear();
  }, [keepFocus, clear]);

  return (
    <form
      role="search"
      className={className}
      onSubmit={(e) => {
        e.preventDefault();
        setFocused(false);
        onSubmit(value);
      }}
      onBlur={(e) => {
        // Keep the panel open while focus stays inside the field + panel.
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
          setFocused(false);
        }
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          setFocused(false);
          return;
        }
        // Keyboard route into the chips (the field keeps the caret otherwise).
        if (e.key === "ArrowDown" && open) {
          const first =
            panelSlotRef.current?.querySelector<HTMLButtonElement>("li button");
          if (first) {
            e.preventDefault();
            first.focus();
          }
        }
      }}
    >
      <div className="relative">
        <SearchField
          ref={inputRef}
          value={value}
          onChange={(e) => onValueChange(e.target.value)}
          onFocus={() => setFocused(true)}
          // Re-open after Escape/Enter closed the panel while the caret stayed
          // in the field: `focus` never fires again on an already-focused
          // input, so without this the chips would be unreachable until the
          // user blurred and came back.
          onClick={() => setFocused(true)}
          onClear={() => {
            onValueChange("");
            setFocused(true);
            inputRef.current?.focus();
          }}
          placeholder={placeholder}
          aria-label={placeholder}
          role="combobox"
          aria-expanded={open}
          aria-controls={panelId}
          autoComplete="off"
        />
        {/* Popup slot — always in the DOM so `aria-controls` stays a valid
            IDREF; the panel itself mounts only while open. */}
        <div id={panelId} ref={panelSlotRef}>
          {open && (
            <SearchHistoryPanel
              variant={panelVariant}
              layout={panelLayout}
              history={history}
              onSelect={applyTerm}
              onRemove={removeTerm}
              onClear={clearTerms}
            />
          )}
        </div>
      </div>
    </form>
  );
}
