"use client";

import type * as React from "react";
import { useAuth } from "@/components/auth/auth-provider";

/**
 * THE "is the viewer looking at their own thing?" rule.
 *
 * Public payloads are fetched server-side as an anonymous request, so ownership
 * can only be decided in the browser from the session. Several surfaces need the
 * exact same test (`SaveButton`, `HideListingButton`, `SafetyTips`,
 * `OwnerListingBar`, the "More from this Seller" rail), so it lives here once.
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
