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
