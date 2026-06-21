"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { SearchField } from "@/components/shared/search-field";

/** Debounce matches the bazaar sidebar so both search fields feel identical. */
const SEARCH_DEBOUNCE_MS = 350;

export function HeaderSearch({ className }: { className?: string }) {
  const t = useTranslations("nav");
  const router = useRouter();
  const pathname = usePathname();
  const [value, setValue] = useState("");

  // The query we last drove into the URL — lets the debounce skip a no-op push.
  const lastPushed = useRef("");

  const go = useCallback(
    (raw: string) => {
      const q = raw.trim();
      lastPushed.current = q;
      const href = q ? `/bazaar?q=${encodeURIComponent(q)}` : "/bazaar";
      // While already browsing, replace (no per-keystroke history entries);
      // arriving from another page, push once so Back returns there.
      if (pathname === "/bazaar") router.replace(href, { scroll: false });
      else router.push(href);
    },
    [router, pathname],
  );

  // Live search: filter the bazaar as you type — no Enter required.
  useEffect(() => {
    if (value.trim() === lastPushed.current) return;
    const id = setTimeout(() => go(value), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [value, go]);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    go(value); // Enter applies immediately, skipping the debounce.
  }

  return (
    <form onSubmit={onSubmit} className={className} role="search">
      <SearchField
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={t("searchPlaceholder")}
        aria-label={t("searchPlaceholder")}
      />
    </form>
  );
}
