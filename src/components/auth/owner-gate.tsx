"use client";

import type * as React from "react";
import { useAuth } from "@/components/auth/auth-provider";

/**
 * THE "is the viewer looking at their own thing?" rule.
 *
 * Public payloads are fetched server-side as an anonymous request, so ownership
 * can only be decided in the browser from the session. Every owner-gated surface
 * needs the exact same test — `OwnerListingBar`, `ListingActionBar`,
 * `StartConversationButton`, `SellerPhoneReveal`, `SaveButton`,
 * `HideListingButton`, `ReportButton`, `SafetyTips`, the away banner and the
 * "More from this Seller" rail — so it lives here once. Do not re-derive it from
 * `useAuth()` in a component: on the listing page the seller must disappear from
 * *all* of these together, and a second copy of the rule is how one of them
 * drifts (a truthiness check that treats id `0` as "nobody", a missing
 * `status === "authed"` guard that flashes the panel for a guest).
 *
 * Guests and the pre-resolution `loading` tick are **not** owners — buyer-facing
 * UI must render for a visitor immediately and only disappear if the session
 * turns out to be the owner's.
 */
export function useIsOwner(ownerId?: number | null): boolean {
  const { status, user } = useAuth();
  return status === "authed" && ownerId != null && user?.id === ownerId;
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
  children: React.ReactNode;
}) {
  return useIsOwner(ownerId) ? null : <>{children}</>;
}
