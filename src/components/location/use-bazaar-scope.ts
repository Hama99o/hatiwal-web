"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * LOC-1 "All Afghanistan" — a remembered Bazaar PREFERENCE in this browser
 * (localStorage), not an address and not a guess. Web twin of mobile's
 * bazaarScope store. "country" = the default order is the whole country,
 * newest first (no point sent); "near" = near the viewer (default).
 */
export type BazaarScope = "near" | "country";

export const BAZAAR_SCOPE_KEY = "loc1-bazaar-scope";

const listeners = new Set<() => void>();

function read(): BazaarScope {
  try {
    return window.localStorage.getItem(BAZAAR_SCOPE_KEY) === "country" ? "country" : "near";
  } catch {
    return "near";
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function setBazaarScope(scope: BazaarScope): void {
  try {
    if (scope === "near") window.localStorage.removeItem(BAZAAR_SCOPE_KEY);
    else window.localStorage.setItem(BAZAAR_SCOPE_KEY, scope);
  } catch {
    /* private mode: the choice holds for this page only */
  }
  for (const l of listeners) l();
}

/** SSR and the first client render agree on "near"; the stored choice applies right after. */
export function useBazaarScope(): [BazaarScope, (scope: BazaarScope) => void] {
  const scope = useSyncExternalStore(subscribe, read, () => "near" as BazaarScope);
  const set = useCallback((s: BazaarScope) => setBazaarScope(s), []);
  return [scope, set];
}
