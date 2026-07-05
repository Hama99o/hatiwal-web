"use client";

/**
 * useComposerDraft — web port of mobile's `src/hooks/useComposerDraft.ts`.
 *
 * Persists the chat composer's unsent text to localStorage, keyed per
 * conversation (`hatiwal.chat.draft:<id>`). Drafts are independent per
 * conversation id and never leak across threads. Storage failures (private
 * mode, quota) never throw — the composer degrades to in-memory state.
 *
 * Usage:
 *   const { draft, setDraft, clearDraft } = useComposerDraft(conversationId);
 *
 * - `draft`      — the current text value (hydrated from storage on mount /
 *                  conversation change)
 * - `setDraft`   — call on every input change; the write is debounced (~400ms;
 *                  clearing to "" removes the key immediately)
 * - `clearDraft` — call after a successful send; removes the stored key.
 *                  A failed send must NOT call this.
 *
 * Pass `null` while the conversation isn't available yet — or when it is
 * closed (a closed conversation must never persist a draft). The hook is a
 * pure in-memory state holder in that case.
 */

import { useCallback, useEffect, useRef, useState } from "react";

const DRAFT_PREFIX = "hatiwal.chat.draft:";
const DEBOUNCE_MS = 400;

/** Returns the localStorage key for a given conversation id. */
export function composerDraftKey(conversationId: number): string {
  return `${DRAFT_PREFIX}${conversationId}`;
}

function readDraft(key: string): string | null {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(key);
  } catch {
    // Storage unavailable (private mode) — composer stays in-memory.
    return null;
  }
}

function writeDraft(key: string, text: string): void {
  try {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(key, text);
  } catch {
    // Storage failure — silently ignore; composer still works.
  }
}

function removeDraft(key: string): void {
  try {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(key);
  } catch {
    // Storage failure — silently ignore.
  }
}

export interface UseComposerDraftResult {
  /** The current draft text (hydrated from storage on mount / id change). */
  draft: string;
  /**
   * Update the draft. Call this on every input change event.
   * The localStorage write is debounced by ~400 ms; setting "" removes the
   * key immediately so a cleared field never re-hydrates stale text.
   */
  setDraft: (text: string) => void;
  /**
   * Permanently remove the stored draft for this conversation.
   * Call after a successful send. A failed send must NOT call this.
   */
  clearDraft: () => void;
}

export function useComposerDraft(
  conversationId: number | null,
): UseComposerDraftResult {
  const [draft, setDraftState] = useState<string>("");

  // Pending debounced write: timer handle + the text it would persist, so we
  // can flush (not drop) it when the user navigates away mid-debounce.
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<{ key: string; text: string } | null>(null);

  const flushPending = useCallback(() => {
    if (debounceRef.current !== null) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    const pending = pendingRef.current;
    pendingRef.current = null;
    if (pending) writeDraft(pending.key, pending.text);
  }, []);

  // ── Hydrate on mount / conversationId change ────────────────────────────
  // Reset + read in one effect so switching threads always shows that
  // thread's own draft. Cleanup flushes any pending write for the previous
  // conversation (the component may be reused across [id] param changes).
  useEffect(() => {
    if (conversationId === null) {
      setDraftState("");
      return flushPending;
    }
    const stored = readDraft(composerDraftKey(conversationId));
    setDraftState(stored ?? "");
    return flushPending;
  }, [conversationId, flushPending]);

  // ── Debounced persist ────────────────────────────────────────────────────
  const setDraft = useCallback(
    (text: string) => {
      setDraftState(text);

      if (conversationId === null) return;

      // Cancel any pending write.
      if (debounceRef.current !== null) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      pendingRef.current = null;

      const key = composerDraftKey(conversationId);

      if (text.length === 0) {
        // Remove immediately (not debounced) so clearing the field and
        // navigating away within the debounce window does not leave a stale
        // draft in storage that would be re-hydrated on reopen.
        removeDraft(key);
        return;
      }

      pendingRef.current = { key, text };
      debounceRef.current = setTimeout(() => {
        debounceRef.current = null;
        pendingRef.current = null;
        writeDraft(key, text);
      }, DEBOUNCE_MS);
    },
    [conversationId],
  );

  // ── Clear draft (call after successful send) ─────────────────────────────
  const clearDraft = useCallback(() => {
    if (conversationId === null) return;
    // Cancel (do not flush) any pending debounced write first.
    if (debounceRef.current !== null) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    pendingRef.current = null;
    removeDraft(composerDraftKey(conversationId));
  }, [conversationId]);

  return { draft, setDraft, clearDraft };
}
