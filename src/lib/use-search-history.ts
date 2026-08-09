"use client";

/**
 * useSearchHistory — web port of mobile's `src/stores/searchHistory.store.ts`.
 *
 * Remembers a buyer's last 10 search terms in localStorage
 * (`hatiwal.searchHistory`) so both web search entry points — the site header
 * and the Bazaar sidebar — can offer "Recent searches" chips instead of making
 * a returning visitor retype "samsung a54" every session.
 *
 * Rules are copied from the mobile store so a term searched on either client
 * behaves identically:
 *   - the term is trimmed;
 *   - terms shorter than {@link MIN_SEARCH_TERM_LENGTH} characters are ignored;
 *   - re-searching an existing term moves it to the front instead of
 *     duplicating it (dedupe is case-insensitive on web — "iPhone" and "iphone"
 *     are one chip, keeping the newest casing);
 *   - most-recent-first, capped at {@link MAX_SEARCH_HISTORY}.
 *
 * The history is **client-only**: never sent to Rails, never written to the URL
 * (the canonical query stays `?q=`). It therefore works for guests exactly as
 * for signed-in users.
 *
 * ONE store, many fields: the state lives in this module and is published
 * through `useSyncExternalStore`, so every mounted field shares a single
 * history — adding a term in the header instantly updates the Bazaar sidebar
 * panel (and the header itself renders twice, desktop + mobile). A `storage`
 * listener keeps other tabs in sync too.
 *
 * SSR-safe: the server render — and the hydration render — see an empty list
 * (`serverSnapshot`), and the stored terms are adopted right after mount, so
 * there is never a hydration mismatch. Every storage access is wrapped in
 * try/catch (same pattern as `src/components/chat/use-composer-draft.ts`): with
 * localStorage unavailable (private mode, quota, blocked cookies) the history
 * silently degrades to in-memory state for the session and never throws.
 */

import { useCallback, useSyncExternalStore } from "react";

/** localStorage key. Namespaced like the other client-only browse prefs. */
export const SEARCH_HISTORY_KEY = "hatiwal.searchHistory";

/** Most terms we ever keep / render — same cap as the mobile store. */
export const MAX_SEARCH_HISTORY = 10;

/** Queries shorter than this are noise — never recorded. */
export const MIN_SEARCH_TERM_LENGTH = 2;

/** Stable empty list — one identity, so `useSyncExternalStore` stays quiet. */
const EMPTY: string[] = [];

type Listener = () => void;
const listeners = new Set<Listener>();

/** Cached snapshot; `null` means "re-read from storage on next access". */
let snapshot: string[] | null = null;

/** Session fallback used when localStorage is unavailable (private mode). */
let memory: string[] = EMPTY;

/**
 * Normalizes an unknown stored value into a valid history: strings only,
 * trimmed, no blank/1-char terms, case-insensitively de-duplicated, capped.
 */
function sanitize(value: unknown): string[] {
  if (!Array.isArray(value)) return EMPTY;
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of value) {
    if (typeof raw !== "string") continue;
    const term = raw.trim();
    if (term.length < MIN_SEARCH_TERM_LENGTH) continue;
    const key = term.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(term);
    if (out.length >= MAX_SEARCH_HISTORY) break;
  }
  return out.length > 0 ? out : EMPTY;
}

function load(): string[] {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.localStorage.getItem(SEARCH_HISTORY_KEY);
    if (!raw) return memory;
    return sanitize(JSON.parse(raw) as unknown);
  } catch {
    // Storage unavailable (private mode) or corrupt JSON — fall back to the
    // in-memory list so the page still renders and search still works.
    return memory;
  }
}

function notify(): void {
  for (const listener of listeners) listener();
}

/** Persist `next`, refresh the snapshot, and wake every subscriber. */
function commit(next: string[]): string[] {
  snapshot = next;
  memory = next;
  try {
    if (typeof window !== "undefined") {
      if (next.length === 0) {
        window.localStorage.removeItem(SEARCH_HISTORY_KEY);
      } else {
        window.localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(next));
      }
    }
  } catch {
    // Storage failure (private mode / quota) — in-memory only, no throw.
  }
  notify();
  return next;
}

/** The current history, newest first. Cached — safe to call on every render. */
export function readSearchHistory(): string[] {
  if (snapshot === null) snapshot = load();
  return snapshot;
}

/** Stable server/hydration snapshot: nothing is known before the client reads. */
function serverSnapshot(): string[] {
  return EMPTY;
}

/**
 * Records a committed search term — call when a search actually commits (the
 * debounced query settling, an Enter submit, a chip re-run), never per
 * keystroke. Blank / too-short terms are ignored, so it is safe to call
 * unconditionally.
 */
export function recordSearchTerm(term: string): string[] {
  const value = term.trim();
  if (value.length < MIN_SEARCH_TERM_LENGTH) return readSearchHistory();
  const key = value.toLowerCase();
  const current = readSearchHistory();
  // Already the newest entry with the same casing → nothing to write (keeps the
  // snapshot identity stable so re-recording never re-renders subscribers).
  if (current[0] === value) return current;
  return commit(
    [value, ...current.filter((t) => t.toLowerCase() !== key)].slice(
      0,
      MAX_SEARCH_HISTORY,
    ),
  );
}

/** Forgets a single term (case-insensitive). */
export function removeSearchTerm(term: string): string[] {
  const key = term.trim().toLowerCase();
  const current = readSearchHistory();
  const next = current.filter((t) => t.toLowerCase() !== key);
  if (next.length === current.length) return current;
  return commit(next.length > 0 ? next : EMPTY);
}

/** Forgets every recorded term. */
export function clearSearchHistory(): string[] {
  if (readSearchHistory().length === 0) return readSearchHistory();
  return commit(EMPTY);
}

/** Another tab changed (or cleared) the history — drop the cache and re-read. */
function onStorage(event: StorageEvent): void {
  // key === null is a storage.clear() from another tab.
  if (event.key !== null && event.key !== SEARCH_HISTORY_KEY) return;
  snapshot = null;
  notify();
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  if (listeners.size === 1 && typeof window !== "undefined") {
    window.addEventListener("storage", onStorage);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && typeof window !== "undefined") {
      window.removeEventListener("storage", onStorage);
    }
  };
}

export interface UseSearchHistoryResult {
  /** Most-recent-first terms. Empty on the server and the hydration render. */
  history: string[];
  /** Records a committed search term (trimmed, deduped, capped, min 2 chars). */
  add: (term: string) => void;
  /** Forgets a single term. */
  remove: (term: string) => void;
  /** Forgets every term. */
  clear: () => void;
}

/**
 * Live view of the shared search history. Re-renders whenever any field in the
 * app (or another tab) records/removes/clears a term.
 */
export function useSearchHistory(): UseSearchHistoryResult {
  const history = useSyncExternalStore(
    subscribe,
    readSearchHistory,
    serverSnapshot,
  );

  const add = useCallback((term: string) => {
    recordSearchTerm(term);
  }, []);
  const remove = useCallback((term: string) => {
    removeSearchTerm(term);
  }, []);
  const clear = useCallback(() => {
    clearSearchHistory();
  }, []);

  return { history, add, remove, clear };
}
