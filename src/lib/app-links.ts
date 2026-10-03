import { SITE_URL } from "@/lib/env";

/**
 * Public app-store listings for the Hatiwal mobile app.
 *
 * These are public marketing URLs, not infrastructure: they are printed in
 * TikTok bios and store badges, so they belong in the repo.
 *
 * The App Store link is the BARE form on purpose. The canonical URL Apple's
 * lookup API returns (`/us/app/hatiwal/id6789510903?uo=4`) is pinned to the US
 * storefront with a tracking param; the bare form redirects each visitor to
 * their OWN storefront (Afghanistan, Pakistan…). Do not "fix" it to the
 * canonical one.
 *
 * Verify before changing: the App Store page rate-limits bare curl (429/301 say
 * nothing about the listing), so check `https://itunes.apple.com/lookup?id=6789510903`
 * for `resultCount: 1` instead.
 */
export const APP_STORE_URL = "https://apps.apple.com/app/hatiwal/id6789510903";
export const GOOGLE_PLAY_URL =
  "https://play.google.com/store/apps/details?id=com.hatiwal.app";

/**
 * The one inbox Hatiwal reads, shown wherever a page tells people how to reach
 * us (privacy policy, account deletion). It is also the account the API sends
 * every email from, so a reply to any Hatiwal email lands in the same place.
 *
 * Replaced "support@hatiwal.app", which could never receive mail: hatiwal.app
 * has no DNS at all, and hatiwal.com has no MX. Both pages are the ones the
 * App Store and Google Play require a WORKING contact on. When a real
 * support@ address exists, change it here and nowhere else.
 */
export const SUPPORT_EMAIL = "infohama99o@gmail.com";

// ── Opening the APP from a web link ──────────────────────────────────────────
//
// The owner's rule (2026-10-03): a shared link should open the Hatiwal app when
// it is installed, and the website otherwise. No server can know what is
// installed on a phone — browsers do not reveal it — so the decision is made ON
// the phone, by the page the link opens:
//
//   • Android: an `intent://` link. Chrome opens the app if it is installed and
//     follows `browser_fallback_url` (our /download page) if it is not.
//   • iPhone: Apple's Smart App Banner (`apple-itunes-app` meta). Safari shows
//     "Open" when the app is installed and "Get" when it is not, and passes
//     `app-argument` to the app so it lands on the same listing.
//
// Both use the app's EXISTING `hatiwal://` deep links (the app already routes
// hatiwal://listing/<id> and hatiwal://seller/<id>), so they work with the app
// already in the stores. Fully automatic opening from a tapped link (Android App
// Links / iOS Universal Links) needs the Play signing SHA-256 and the Apple Team
// ID, plus a new app build — that is the next step, and it will reuse this map.

export const IOS_APP_ID = "6789510903";
export const ANDROID_PACKAGE = "com.hatiwal.app";
export const APP_SCHEME = "hatiwal";

/** A page that exists BOTH on the web and in the app. */
export type AppRoute = { kind: "listing" | "seller"; id: number | string };

/**
 * The one map between the two route sets. Web and app name the same pages
 * differently (web /listings/<id>, app listing/<id>); everything below derives
 * from this, so a new shared page is added here once.
 */
const ROUTES: Record<AppRoute["kind"], { web: string; app: string }> = {
  listing: { web: "listings", app: "listing" },
  seller: { web: "sellers", app: "seller" },
};

/**
 * The app route for a website path, or null when the page has no app twin.
 * Accepts the locale-prefixed path the browser shows: "/ps/listings/70".
 */
export function appRouteFromPath(pathname: string): AppRoute | null {
  const parts = pathname.split("/").filter(Boolean);
  for (let i = 0; i < parts.length - 1; i++) {
    const kind = (Object.keys(ROUTES) as AppRoute["kind"][]).find(
      (k) => ROUTES[k].web === parts[i],
    );
    if (kind && /^\d+$/.test(parts[i + 1])) return { kind, id: parts[i + 1] };
  }
  return null;
}

/** The app's own path for a route: "listing/70". */
export function appPath(route: AppRoute): string {
  return `${ROUTES[route.kind].app}/${route.id}`;
}

/** The website path for a route (no locale prefix): "/listings/70". */
export function webPath(route: AppRoute): string {
  return `/${ROUTES[route.kind].web}/${route.id}`;
}

/** The custom-scheme deep link the installed app understands: hatiwal://listing/70. */
export function appDeepLink(route: AppRoute): string {
  return `${APP_SCHEME}://${appPath(route)}`;
}

/**
 * Android: opens the app at this route when installed, otherwise our /download
 * page (Google Play, App Store, or carry on on the web), so a tap is never a
 * dead end.
 *
 * Not the Play Store URL directly: on a device check (2026-10-03, emulator with
 * the app uninstalled) Chrome silently did NOTHING with a play.google.com
 * fallback — it hands those to the Play Store app — while an ordinary web
 * fallback loaded every time.
 */
export function androidIntentUrl(route: AppRoute | null): string {
  const fallback = `S.browser_fallback_url=${encodeURIComponent(`${SITE_URL}/download`)};end`;
  // No app twin for this page (home, Bazaar, …): just launch the app.
  if (!route) {
    return (
      `intent:#Intent;action=android.intent.action.MAIN;` +
      `category=android.intent.category.LAUNCHER;package=${ANDROID_PACKAGE};${fallback}`
    );
  }
  return (
    `intent://${appPath(route)}#Intent;scheme=${APP_SCHEME};package=${ANDROID_PACKAGE};` +
    fallback
  );
}

/** iPhone: the Smart App Banner metadata (Next renders `apple-itunes-app`). */
export function smartAppBanner(route: AppRoute): { appId: string; appArgument: string } {
  return { appId: IOS_APP_ID, appArgument: appDeepLink(route) };
}

export type DevicePlatform = "ios" | "android" | "other";

/**
 * The visitor's phone, from the browser. CLIENT-ONLY (reads navigator): call it
 * after mount, never during server render — branching on the user agent there
 * would mismatch on hydration or cache one device's answer for everyone.
 */
export function detectPlatform(): DevicePlatform {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
  // Since iPadOS 13, Safari on iPad sends a DESKTOP Macintosh user agent, so
  // the check above misses it. A real Mac has no touch screen
  // (maxTouchPoints 0), an iPad has several. Do not drop this check: without it
  // every iPad gets the desktop layout.
  if (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "other";
}

// ── The install suggestion (components/shared/app-prompt.tsx) ───────────────
//
// The owner's rule (2026-10-03): on a PHONE, suggest the app once; if they
// close it, never push again — just keep a small "Get the app" icon. Never on
// desktop. The "closed it" choice lives in a cookie (a year), so it survives
// reloads and is the same answer on every page.

export const APP_PROMPT_COOKIE = "hatiwal_app_prompt";
/** Fired by the header icon; the sheet listens and opens. */
export const OPEN_APP_PROMPT_EVENT = "hatiwal:open-app-prompt";
/** Fired when the choice changes, so the header icon can appear at once. */
export const APP_PROMPT_CHANGED_EVENT = "hatiwal:app-prompt-changed";

export function appPromptDismissed(): boolean {
  try {
    return document.cookie.split("; ").some((c) => c === `${APP_PROMPT_COOKIE}=dismissed`);
  } catch {
    return false;
  }
}

export function dismissAppPrompt(): void {
  try {
    document.cookie = `${APP_PROMPT_COOKIE}=dismissed; path=/; max-age=31536000; samesite=lax`;
  } catch {
    /* cookies off: it will simply be offered again next visit */
  }
  window.dispatchEvent(new Event(APP_PROMPT_CHANGED_EVENT));
}
