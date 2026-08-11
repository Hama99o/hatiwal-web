"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useAuth } from "@/components/auth/auth-provider";

/**
 * The viewer's id as the *server* knew it when it rendered the HTML (from the
 * `hatiwal_viewer_id` cookie — see `lib/auth/cookies.ts`).
 *
 * Three distinct values, and the difference matters (see `useServerViewerId`):
 *  - `number`    — the request carried a session, belonging to this user.
 *  - `null`      — the page published a hint and it says there is NO session.
 *  - `undefined` — no page published a hint at all (nothing is known).
 */
const ServerViewerIdContext = createContext<number | null | undefined>(
  undefined,
);

/**
 * Hands a DYNAMIC page's server-known viewer id to every owner-gated control
 * below it, so the owner's first paint is already the owner's version.
 *
 * Without it, ownership can only be answered after `/api/auth/session` resolves
 * in the browser — and the server HTML (rendered from an anonymous fetch) has
 * already been painted by then, so the seller of the item sees "Contact Seller",
 * the save heart and the buyer safety tips flash past before their own panel
 * replaces them. Only usable where a `cookies()` read is free, i.e. a
 * `force-dynamic` route; on an ISR page leave it out and the gate simply falls
 * back to resolving in the browser.
 */
export function ViewerIdProvider({
  viewerId,
  children,
}: {
  viewerId: number | null;
  children: ReactNode;
}) {
  return (
    <ServerViewerIdContext.Provider value={viewerId}>
      {children}
    </ServerViewerIdContext.Provider>
  );
}

/**
 * What the SERVER already knew about this viewer's session, if the page said.
 *
 * The browser cannot answer "who is this?" until `/api/auth/session` resolves,
 * and the SSR HTML is painted long before that — so every session-dependent
 * control faces a window with no answer. On a `force-dynamic` page there IS an
 * answer, one line up in the same tree: `readViewerIdFromCookies()` returns null
 * unless the devise token cookies are present, i.e. it is itself a session probe,
 * and `<ViewerIdProvider>` publishes the result.
 *
 * So a consumer can decide the REAL branch during `loading` instead of guessing:
 *  - `null`      → definitely a guest (no session cookies came with the request),
 *                  so render the guest UI — in the server HTML, working before
 *                  hydration and with JS off.
 *  - `number`    → definitely signed in; never render "sign in" UI for them.
 *  - `undefined` → no hint (an ISR page). Genuinely unknown: hold the tap.
 *
 * Answering from the hint is not a security decision — it only picks which
 * presentational branch renders; every action behind it is still authorized by
 * Rails/Pundit against the real token.
 */
export function useServerViewerId(): number | null | undefined {
  return useContext(ServerViewerIdContext);
}

/**
 * THE "is the viewer looking at their own thing?" rule.
 *
 * Public payloads are fetched server-side as an anonymous request, so ownership
 * can only be decided from the session. Every owner-gated surface needs the exact
 * same test — `OwnerListingBar`, `ListingActionBar`, `StartConversationButton`,
 * `SellerPhoneReveal`, `SaveButton`, `HideListingButton`, `ReportButton`,
 * `SafetyTips`, the away banner and the "More from this Seller" rail — so it
 * lives here once. Do not re-derive it from `useAuth()` in a component: on the
 * listing page the seller must disappear from *all* of these together, and a
 * second copy of the rule is how one of them drifts (a truthiness check that
 * treats id `0` as "nobody", a missing `status === "authed"` guard that flashes
 * the panel for a guest, a copy that misses the SSR hint below and so flickers).
 *
 * While the session is still resolving we trust the server's hint when the page
 * supplied one (`ViewerIdProvider`) — that's what keeps the owner from seeing a
 * frame of buyer UI. With no hint, a `loading` viewer is NOT an owner: buyer-
 * facing UI must render for a visitor immediately and only disappear if the
 * session turns out to be the owner's. Guests are never owners.
 */
export function useIsOwner(ownerId?: number | null): boolean {
  const { status, user } = useAuth();
  const serverViewerId = useServerViewerId();
  if (ownerId == null) return false;
  // No hint (`undefined`) can never equal a numeric owner id, so a page without
  // a provider still falls back to "a loading viewer is not an owner".
  if (status === "loading") return serverViewerId === ownerId;
  return status === "authed" && user?.id === ownerId;
}

/**
 * Hides a whole buyer-facing block from the owner of the thing on screen.
 *
 * Wrap a Server Component subtree in this from a server page (children stay
 * server-rendered — only the guard is client-side). Use it when the block itself
 * has no reason to be a Client Component, e.g. the "More from this Seller" rail:
 * a seller must not be sold their own stock under a buyer heading, with a "view
 * all" pointing at their own profile (mirrors mobile's `!isOwnListing` gate in
 * `ListingDetail.tsx`).
 */
export function HideForOwner({
  ownerId,
  children,
}: {
  /** Owner of the content. Null/undefined → nobody is the owner, always shown. */
  ownerId?: number | null;
  children: ReactNode;
}) {
  return useIsOwner(ownerId) ? null : <>{children}</>;
}
