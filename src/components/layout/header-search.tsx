"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { SearchBox } from "@/components/shared/search-box";
import { useSearchHistory } from "@/lib/use-search-history";

/** Debounce matches the bazaar sidebar so both search fields feel identical. */
const SEARCH_DEBOUNCE_MS = 350;

export function HeaderSearch({ className }: { className?: string }) {
  const t = useTranslations("nav");
  const router = useRouter();
  const pathname = usePathname();
  const [value, setValue] = useState("");

  // Recent searches — client-only, shared with the Bazaar sidebar field. The
  // field UI + panel gating live in SearchBox; this screen only records the
  // terms it actually commits.
  const { add } = useSearchHistory();

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

  return (
    <SearchBox
      className={className}
      value={value}
      onValueChange={setValue}
      onSubmit={go} // Enter applies immediately, skipping the debounce.
      placeholder={t("searchPlaceholder")}
    />
  );
}
