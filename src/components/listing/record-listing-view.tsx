"use client";

import { useEffect } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { recordListingView } from "@/lib/api/viewed-listings";

/**
 * Invisible island on the (server-rendered, guest) listing detail page that
 * records the view for a logged-in user so it lands in Recently Viewed. Fires
 * once per mount when auth resolves to "authed"; no-op for guests. Rails dedupes
 * and skips the owner, so re-opens don't inflate anything.
 */
export function RecordListingView({ id }: { id: number }) {
  const { status } = useAuth();
  useEffect(() => {
    if (status !== "authed") return;
    recordListingView(id);
  }, [status, id]);
  return null;
}
