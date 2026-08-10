"use client";

/**
 * SearchBox — the one search input the whole web client uses: the site header
 * and the Bazaar sidebar both render THIS, so the field, its clear button, the
 * recent-searches gating, the keyboard behaviour and the focus rules exist once
 * instead of twice.
 *
 * The caller stays in charge of what a search DOES (the header navigates to
 * `/bazaar?q=…`, the Bazaar island updates its filters) and of recording a
 * committed term in the shared history (`useSearchHistory().add`) — its own
 * debounce decides when a search has really committed. This component owns only
 * the field UI and when the recent-searches panel shows:
 *
 *   dropdown (header)  →  the field is FOCUSED, empty, and there is history
 *   inline   (sidebar) →  the field is empty and there is history
 *
 * The difference is deliberate. The header panel floats OVER the page, so it may
 * only appear in response to a tap/click — otherwise it would cover results the
 * buyer is reading. The sidebar panel sits in normal flow above the filters: it
 * covers nothing, so gating it on focus would only make the column jump every
 * time the buyer clicked in or out of the field. (It does cost one post-hydration
 * shift inside that column — the history is client-only, so the server cannot
 * know there is anything to render.)
 *
 * Keyboard: ArrowDown enters the chips, arrows rove between them (RTL-aware),
 * Escape hands focus back to the field.
 */

import { useCallback, useRef, useState } from "react";
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
}

export function SearchBox({
  value,
  onValueChange,
  onSubmit,
  onSelectRecent,
  placeholder,
  className,
  panelVariant = "dropdown",
}: SearchBoxProps) {
  // Read-only view of the shared store: recording is the caller's job (it knows
  // when its search committed), removing/clearing belongs to the panel.
  const { history, remove, clear } = useSearchHistory();
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelSlotRef = useRef<HTMLDivElement>(null);

  const open =
    value === "" &&
    history.length > 0 &&
    (panelVariant === "inline" || focused);

  const applyTerm = useCallback(
    (term: string) => {
      onValueChange(term);
      (onSelectRecent ?? onSubmit)(term);
      // The panel closes on its own (the field is no longer empty), which
      // unmounts the chip that was just clicked — so put the caret back in the
      // field instead of letting focus fall to <body>.
      inputRef.current?.focus();
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

  /**
   * Move focus `delta` steps along the chip controls — every chip's label and X
   * in DOM order, wrapping at both ends. Returns false when there is nothing to
   * rove (so the key keeps its default meaning).
   */
  const roveFocus = useCallback((delta: number) => {
    const buttons = Array.from(
      panelSlotRef.current?.querySelectorAll<HTMLButtonElement>("li button") ??
        [],
    );
    if (buttons.length === 0) return false;
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
    // Coming from the field: enter at the near end (newest chip for ArrowDown).
    buttons[
      index === -1
        ? delta > 0
          ? 0
          : buttons.length - 1
        : (index + delta + buttons.length) % buttons.length
    ].focus();
    return true;
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLFormElement>) => {
      if (e.key === "Escape") {
        // Dismiss the floating panel, and never leave focus stranded on a chip
        // that is about to unmount — the field always gets the caret back.
        setFocused(false);
        inputRef.current?.focus();
        return;
      }
      if (!open) return;

      // From the FIELD, only ArrowDown reaches in: Left/Right belong to the
      // caret, and ArrowUp would jump to the far end of the list.
      if (!panelSlotRef.current?.contains(e.target as Node)) {
        if (e.key === "ArrowDown" && roveFocus(1)) e.preventDefault();
        return;
      }
      // Inside the chips, arrows rove. Horizontal keys follow the writing
      // direction so they match what the buyer sees in Pashto / Dari.
      const rtl = getComputedStyle(e.currentTarget).direction === "rtl";
      let delta = 0;
      if (
        e.key === "ArrowDown" ||
        e.key === (rtl ? "ArrowLeft" : "ArrowRight")
      ) {
        delta = 1;
      } else if (
        e.key === "ArrowUp" ||
        e.key === (rtl ? "ArrowRight" : "ArrowLeft")
      ) {
        delta = -1;
      }
      if (delta !== 0 && roveFocus(delta)) e.preventDefault();
    },
    [open, roveFocus],
  );

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
      onKeyDown={handleKeyDown}
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
          autoComplete="off"
        />
        {/* Panel slot — the chips are a labelled group of buttons that follows
            the field in DOM order (no combobox/listbox wiring to fake: nothing
            here is a value list, and Escape/ArrowDown are handled above). */}
        <div ref={panelSlotRef}>
          {open && (
            <SearchHistoryPanel
              variant={panelVariant}
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
