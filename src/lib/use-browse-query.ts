"use client";

/**
 * The browse query, published once for every search field on the page.
 *
 * Web shows TWO search boxes at the same time (the site header's — mounted
 * twice, one in the bar for `md`+ and one dropped below it — and the Bazaar
 * sidebar's own, wider one at `lg`+). Mobile has exactly one, so it never had
 * this problem: whoever changes the query must tell the others, or the most
 * prominent box in the app ends up advertising a term that is NOT applied.
 *
 * The URL (`/bazaar?q=…`) is the source of truth, but it cannot be the channel:
 * the App Router commits `router.replace()` into `window.location` only once the
 * RSC payload lands, and a `?q=` change on the SAME pathname fires no `popstate`
 * — so a field reading the live location would be reading the previous query.
 * Instead the Bazaar island publishes each query it drives into the URL through
 * this tiny module store, and every field adopts it. Same shape as
 * `use-search-history.ts`: module state + `useSyncExternalStore`, with a stable
 * server/hydration snapshot so SSR and the first client render agree.
 *
 * The snapshot is a BARE STRING (the trimmed term, `""` for cleared, `null`
 * before anything is published), not a versioned object. Re-publishing the same
 * term is therefore not news, which is exactly right: every subscriber's job is
 * to make its field agree with the applied query, so a term it already shows
 * needs no work — and a subscriber must skip that case anyway, or an echo of its
 * own commit would clobber characters typed in the meantime
 * (`header-search.tsx`). A version counter would have made every publication a
 * re-render that every subscriber then had to discard by value.
 *
 * Client-only and ephemeral: nothing is persisted (unlike the search history),
 * nothing is sent to Rails, and nothing new goes in the URL.
 */

import { useSyncExternalStore } from "react";

type Listener = () => void;
const listeners = new Set<Listener>();

/** `null` until a field commits — "nothing has been published this session". */
let committed: string | null = null;

/**
 * Announce the query a field just committed (Enter, a settled debounce, a
 * recent-search chip, "Reset filters", an applied saved search). Call it with
 * whatever was driven into `?q=`, including `""` for a cleared field — that is
 * exactly the case where a silent field would keep showing a dead term.
 */
export function publishBrowseQuery(raw: string): void {
  const next = raw.trim();
  if (next === committed) return; // Nothing changed — no subscriber has work.
  committed = next;
  for (const listener of listeners) listener();
}

function getSnapshot(): string | null {
  return committed;
}

/** Stable snapshot for SSR + hydration: no field has committed anything yet. */
function getServerSnapshot(): string | null {
  return null;
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * The last query any field committed, or `null` if none has yet. Re-renders the
 * caller when that term CHANGES — adopt it in an effect, skipping the value the
 * field itself pushed and any term it is mid-edit on (see `header-search.tsx`).
 */
export function useCommittedBrowseQuery(): string | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
