"use client";

/**
 * SearchBox — the one search input the whole web client uses: the site header
 * and the Bazaar page both render THIS, so the field, its clear button, the
 * recent-searches gating, the keyboard behaviour and the focus rules exist once
 * instead of twice.
 *
 * The caller stays in charge of what a search DOES (the header navigates to
 * `/bazaar?q=…`, the Bazaar island updates its filters) and of recording a
 * committed term in the shared history (`useSearchHistory().add`) — its own
 * debounce decides when a search has really committed. This component owns only
 * the field UI and when the recent-searches panel shows:
 *
 *   the field is FOCUSED, empty, and there is history
 *
 * ONE rule, ONE presentation: the panel is always a dropdown floating under its
 * own field, opened by focus. That matters because two fields can be on screen
 * at once (header bar + Bazaar) — gating on focus means only the field the buyer
 * is actually using ever offers chips, so the same history is never shown twice
 * at once. Floating also keeps the block out of the layout: it can't push the
 * Bazaar filters down the page, can't shift the column after hydration (the
 * history is client-only, so the server can't know it exists) and can't outgrow
 * a sticky sidebar. Nothing clips it — every host gives the field a
 * `position: relative` wrapper and no ancestor sets `overflow`.
 *
 * Keyboard: ArrowDown enters the chips, arrows rove between them (RTL-aware),
 * Escape dismisses the panel and hands the caret back to the field. Screen
 * readers get the same news through `aria-controls` + an `sr-only` hint on the
 * input, announced only while the chips are actually there.
 */

import { useCallback, useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";
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
}

export function SearchBox({
  value,
  onValueChange,
  onSubmit,
  onSelectRecent,
  placeholder,
  className,
}: SearchBoxProps) {
  const t = useTranslations("browse");
  // Read-only view of the shared store: recording is the caller's job (it knows
  // when its search committed), removing/clearing belongs to the panel.
  const { history, remove, clear } = useSearchHistory();
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelSlotRef = useRef<HTMLDivElement>(null);
  // Owned here (not inside the panel) so the input can point at the panel it
  // controls and at the hint that explains how to reach it.
  const panelId = useId();
  const hintId = `${panelId}-hint`;

  const open = value === "" && history.length > 0 && focused;

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
        // Dismiss the panel, and never leave focus stranded on a chip that is
        // about to unmount — the field always gets the caret back. Order
        // matters: focus() synchronously fires the input's onFocus (which sets
        // `focused` true), so the dismissal has to be queued AFTER it, or the
        // panel would stay open and Escape would need pressing twice.
        inputRef.current?.focus();
        setFocused(false);
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
          // Announced only while the chips exist: a screen-reader user is told
          // the group is there and how to walk into it. Deliberately NOT a
          // combobox — each option carries its own Remove button, which a
          // listbox may not contain.
          aria-controls={open ? panelId : undefined}
          aria-describedby={open ? hintId : undefined}
        />
        {/* Panel slot — the chips are a labelled group of buttons that follows
            the field in DOM order. */}
        <div ref={panelSlotRef}>
          {open && (
            <>
              <span id={hintId} className="sr-only">
                {t("recentSearchesHint")}
              </span>
              <SearchHistoryPanel
                panelId={panelId}
                history={history}
                onSelect={applyTerm}
                onRemove={removeTerm}
                onClear={clearTerms}
              />
            </>
          )}
        </div>
      </div>
    </form>
  );
}
