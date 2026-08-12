"use client";

import { useCallback } from "react";
import { usePathname } from "@/i18n/navigation";

/**
 * ONE definition of "send them to sign in, and bring them back afterwards".
 *
 * Every gated buyer action on this site can be reached by a guest — the pinned
 * "Contact Seller" CTA, both save hearts, Report, the phone reveal — and each of
 * them used to push a bare `/login`. `login-form.tsx` (`safeNextPath`) then
 * landed them on `/profile`, so the cost of tapping the one CTA the sticky
 * action bar exists for was the listing you were reading: sign in, arrive at your
 * own profile, listing and intent gone. `require-auth.tsx` had always passed
 * `?next=`; the imperative call sites had not, and each of them re-spelled the
 * URL, which is how they drifted apart.
 *
 * It also makes the ONE place a signed-in viewer can still be sent here
 * recoverable: a heart on an ISR page (no server viewer hint) whose session probe
 * never answers falls back to the guest path after a budget — see
 * `save-button.tsx`. With `?next=` that viewer is returned to where they were,
 * because `login-form.tsx` redirects an already-authed visitor to `next` instead
 * of showing them a form.
 */
export function loginHref(here: string): string {
  return `/login?next=${encodeURIComponent(here)}`;
}

/**
 * `/login?next=<where the viewer is now>` for the current page.
 *
 * Returns a GETTER rather than a string because the two uses need different
 * reads:
 *  - from an event handler (the `router.push` sites) call it plain — the live
 *    query string matters there, since `/bazaar?category=3&q=iphone` is the place
 *    a buyer must come back to, and by then the browser is the source of truth.
 *  - from RENDER, for an href that ships in the server HTML (the guest CTA works
 *    before hydration), pass `{ includeQuery: false }`: the query is unreadable
 *    during SSR, so including it would make the server and the first client
 *    render disagree about the `href` — a hydration mismatch on the site's
 *    primary action.
 *
 * The path comes from next-intl's `usePathname`, i.e. WITHOUT the locale prefix,
 * matching what `login-form.tsx` feeds back into the locale-aware router.
 */
export function useLoginHref(): (opts?: { includeQuery?: boolean }) => string {
  const pathname = usePathname();
  return useCallback(
    ({ includeQuery = true }: { includeQuery?: boolean } = {}) => {
      const qs =
        includeQuery && typeof window !== "undefined"
          ? window.location.search
          : "";
      return loginHref(`${pathname}${qs}`);
    },
    [pathname],
  );
}
