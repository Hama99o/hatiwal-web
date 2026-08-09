"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { SearchField } from "@/components/shared/search-field";
import { SearchHistoryPanel } from "@/components/shared/search-history-panel";
import { useSearchHistory } from "@/lib/use-search-history";

/** Debounce matches the bazaar sidebar so both search fields feel identical. */
const SEARCH_DEBOUNCE_MS = 350;

export function HeaderSearch({ className }: { className?: string }) {
  const t = useTranslations("nav");
  const router = useRouter();
  const pathname = usePathname();
  const [value, setValue] = useState("");

  // Recent searches — client-only, shared with the Bazaar sidebar field.
  const { history, add, remove, clear } = useSearchHistory();
  const [focused, setFocused] = useState(false);

  // The query we last drove into the URL — lets the debounce skip a no-op push.
  const lastPushed = useRef("");

  const go = useCallback(
    (raw: string) => {
      const q = raw.trim();
      lastPushed.current = q;
      add(q); // Remembered locally only — never sent to Rails, never in the URL.
      const href = q ? `/bazaar?q=${encodeURIComponent(q)}` : "/bazaar";
      // While already browsing, replace (no per-keystroke history entries);
      // arriving from another page, push once so Back returns there.
      if (pathname === "/bazaar") router.replace(href, { scroll: false });
      else router.push(href);
    },
    [router, pathname, add],
  );

  // Live search: filter the bazaar as you type — no Enter required.
  useEffect(() => {
    if (value.trim() === lastPushed.current) return;
    const id = setTimeout(() => go(value), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [value, go]);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFocused(false);
    go(value); // Enter applies immediately, skipping the debounce.
  }

  // Recent searches only make sense on an empty, focused field.
  const showHistory = focused && value === "" && history.length > 0;

  function applyTerm(term: string) {
    setValue(term);
    setFocused(false);
    go(term);
  }

  return (
    <form
      onSubmit={onSubmit}
      className={className}
      role="search"
      onFocus={() => setFocused(true)}
      onBlur={(e) => {
        // Keep the panel open while focus stays inside the field + panel.
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
          setFocused(false);
        }
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") setFocused(false);
      }}
    >
      <div className="relative">
        <SearchField
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={t("searchPlaceholder")}
          aria-label={t("searchPlaceholder")}
        />
        {showHistory && (
          <SearchHistoryPanel
            history={history}
            onSelect={applyTerm}
            onRemove={remove}
            onClear={clear}
          />
        )}
      </div>
    </form>
  );
}
