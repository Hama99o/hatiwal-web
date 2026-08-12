"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { SearchBox } from "@/components/shared/search-box";
import { useSearchHistory } from "@/lib/use-search-history";
import {
  publishBrowseQuery,
  useCommittedBrowseQuery,
} from "@/lib/use-browse-query";

/** Debounce matches the bazaar sidebar so both search fields feel identical. */
const SEARCH_DEBOUNCE_MS = 350;

/** The route this field searches — and the only one whose `?q=` it mirrors. */
const BROWSE_PATH = "/bazaar";

/**
 * The `?q=` currently in the URL, or "" anywhere but the Bazaar.
 *
 * Read from the LIVE location instead of `useSearchParams()`: that hook would
 * force a CSR bailout / Suspense boundary on every statically-rendered page —
 * and this field is in the site header, i.e. on all of them (same reason as
 * `locale-switcher.tsx` and `require-auth.tsx`). Client-only by nature, so it
 * returns "" on the server and is adopted right after mount.
 */
function readBrowseQuery(pathname: string): string {
  if (pathname !== BROWSE_PATH || typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get("q")?.trim() ?? "";
}

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

  /**
   * A query another field published that this one had to SKIP because it was
   * mid-edit, held until the field goes clean again (drained by the debounce
   * effect below). `null` = nothing owed.
   */
  const skipped = useRef<string | null>(null);

  /**
   * Show `q` and treat it as this field's own committed query, so the debounce
   * below never re-pushes it and it is never recorded as a search made here.
   * Any pending news is superseded by what we are showing now.
   */
  const adopt = useCallback((q: string) => {
    skipped.current = null;
    lastPushed.current = q;
    setValue(q);
  }, []);

  const go = useCallback(
    (raw: string) => {
      const q = raw.trim();
      lastPushed.current = q;
      // Our own commit outranks anything queued while we were typing — and the
      // publish below is deduped by value, so it may not fire to clear this.
      skipped.current = null;
      add(q); // Remembered locally only — never sent to Rails, never in the URL.
      // Tell the other fields on screen (the second header copy, and the Bazaar
      // island once it adopts the new URL) what is now applied.
      publishBrowseQuery(q);
      const href = q ? `${BROWSE_PATH}?q=${encodeURIComponent(q)}` : BROWSE_PATH;
      // While already browsing, replace (no per-keystroke history entries);
      // arriving from another page, push once so Back returns there.
      if (pathname === BROWSE_PATH) router.replace(href, { scroll: false });
      else router.push(href);
    },
    [router, pathname, add],
  );

  /**
   * Mirror the active browse query.
   *
   * Below `lg` the Bazaar hides its own field and THIS is the only search box on
   * screen, so a buyer arriving on a filtered link — a shared URL, the Back
   * button, a "See similar in {category}" CTA, a reload — must find the term in
   * it, ready to refine or clear. Without this they would see filtered results
   * next to an empty box and no way to tell what filtered them.
   *
   * Runs on every navigation (`pathname`) and on Back/Forward (`popstate`, the
   * one query change the browser announces). `lastPushed` is moved with it so
   * the debounce below treats the adopted term as already committed — landing on
   * a link must never re-push it, and must never record it as something this
   * buyer searched for.
   */
  useEffect(() => {
    const sync = () => {
      const q = readBrowseQuery(pathname);
      if (q === lastPushed.current) return;
      // The URL is the source of truth: adopting it also drops any publication
      // we were still holding, which this navigation has just made stale.
      adopt(q);
    };
    sync();
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, [pathname, adopt]);

  /**
   * Adopt a query committed by ANOTHER field.
   *
   * `pathname` + `popstate` above cover arriving on a filtered link and
   * Back/Forward, but not the case that matters most at `lg`+, where this field
   * and the Bazaar's are BOTH on screen: the Bazaar refines (or clears) `?q=`
   * with `router.replace()` on the same pathname — no navigation, no popstate —
   * so without this the header would keep advertising a query that is no longer
   * applied. It also keeps the header's two copies (bar + below-bar) in step, so
   * resizing across `md` never reveals a stale box.
   *
   * Two guards, and both are about never eating what the buyer typed:
   *   - the published term is the one THIS field pushed → it already shows it,
   *     and re-setting it would clobber characters typed in the frame between
   *     the debounce firing and this effect running;
   *   - the field is DIRTY (its text is no longer what it last committed, i.e.
   *     keystrokes are waiting on the 350ms debounce) → the buyer's in-progress
   *     query outranks any other field's news, so a late echo can never revert
   *     the text mid-word.
   *
   * The dirty case DEFERS the news, it does not drop it: the term is stashed in
   * `skipped` and adopted the moment the field goes clean without publishing
   * anything of its own. Without that, erasing the in-progress text back to what
   * this field last committed would leave it EMPTY while the feed and the Bazaar
   * field both show the other field's term — a publication is announced once
   * (the store dedupes by value), so a dropped one never comes round again.
   * (Not pinned by a spec: reaching that state needs another field to commit
   * inside this one's 350ms debounce and the text erased before it fires — a
   * ~100ms window that real-timer Playwright cannot hit reliably, and web has no
   * unit runner to fake the clock in.)
   *
   * Dirtiness is read through a ref, so this effect runs ONLY on a real
   * publication and not on every keystroke. Re-running it on the dirty→clean
   * edge instead would look equivalent and is not: `committed` is a standing
   * value, not an event, so any later return to a clean field would re-adopt it
   * — type and erase two characters in the header of a listing page after an
   * earlier search and the box would fill itself with that dead term.
   */
  const committed = useCommittedBrowseQuery();
  const valueRef = useRef(value);
  valueRef.current = value;
  useEffect(() => {
    if (committed === null || committed === lastPushed.current) {
      skipped.current = null; // Already showing it — nothing owed.
      return;
    }
    if (valueRef.current.trim() !== lastPushed.current) {
      skipped.current = committed; // Mid-edit — hold it (drained below).
      return;
    }
    adopt(committed);
  }, [committed, adopt]);

  // Live search: filter the bazaar as you type — no Enter required.
  useEffect(() => {
    if (value.trim() === lastPushed.current) {
      // Nothing to push: the field shows exactly what it last committed. This is
      // also the dirty→clean edge, so it is where a publication skipped while
      // the buyer was typing gets drained — the field ends up agreeing with the
      // query that is actually applied instead of contradicting it.
      const pending = skipped.current;
      skipped.current = null;
      if (pending !== null && pending !== lastPushed.current) adopt(pending);
      return;
    }
    const id = setTimeout(() => go(value), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [value, go, adopt]);

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
