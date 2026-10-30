import { RAILS_PUBLIC_ORIGIN } from "@/lib/env";

/**
 * IDEA-8 (1.2.1, hatiwal-mobile docs/design/SHARE_AND_QR.md §3.1): the ONE link
 * of every share, mirrored by the API's ShareLink and mobile's shareLink:
 *
 *   https://hatiwal.com/l/<id>?lang=ps&src=wa     a listing
 *   https://hatiwal.com/s/<id>?lang=fa&src=qr     a shop
 *
 * The short paths are the app-link paths (the app opens when installed).
 * `lang` is the SHARER's language: next.config sends /l/<id>?lang=ps to
 * /ps/listings/<id>, so WhatsApp's link preview is built in Pashto. `src` says
 * what shared it (counted in the API's [share_visit] log). Both are
 * WHITELISTED: anything else is dropped, never copied into a link.
 */
export const SHARE_LANGS = ["en", "ps", "fa"] as const;
export const SHARE_SOURCES = ["wa", "share", "qr"] as const;
export type ShareLang = (typeof SHARE_LANGS)[number];
export type ShareSource = (typeof SHARE_SOURCES)[number];

const PUBLIC_SITE = "https://hatiwal.com";
const SHORT: Record<"listing" | "shop", string> = { listing: "l", shop: "s" };

export function shareLang(value: unknown): ShareLang | null {
  return (SHARE_LANGS as readonly unknown[]).includes(value) ? (value as ShareLang) : null;
}

export function shareSource(value: unknown): ShareSource | null {
  return (SHARE_SOURCES as readonly unknown[]).includes(value) ? (value as ShareSource) : null;
}

/**
 * The share link: the API's https `shareUrl` when it sent one (PUBLIC_SHARE_BASE_URL),
 * else https://hatiwal.com/<l|s>/<id> — never hatiwal:// (it must work without the app).
 */
export function shareLink(
  kind: "listing" | "shop",
  id: number,
  opts: { shareUrl?: string | null; lang?: unknown; src?: unknown } = {},
): string {
  const base =
    opts.shareUrl && /^https:\/\//i.test(opts.shareUrl) ? opts.shareUrl.split("?")[0] : `${PUBLIC_SITE}/${SHORT[kind]}/${id}`;
  const query = new URLSearchParams();
  const lang = shareLang(opts.lang);
  const src = shareSource(opts.src);
  if (lang) query.set("lang", lang);
  if (src) query.set("src", src);
  const qs = query.toString();
  return qs ? `${base}?${qs}` : base;
}

/** The printable QR card made by the API (PNG or PDF, A6), loaded straight from Rails like photos. */
export function qrCardUrl(kind: "listing" | "shop", id: number, lang: unknown, format: "png" | "pdf" = "png"): string {
  const path = kind === "shop" ? "shops" : "listings";
  return `${RAILS_PUBLIC_ORIGIN}/api/v1/${path}/${id}/qr_card.${format}?lang=${shareLang(lang) ?? "en"}`;
}

/** The params the API reads to log a visit that came from a share ([share_visit]); undefined otherwise. */
export function shareVisitParams(params: { src?: unknown; lang?: unknown }): { src: ShareSource; lang?: ShareLang } | undefined {
  const src = shareSource(params.src);
  if (!src) return undefined;
  const lang = shareLang(params.lang);
  return lang ? { src, lang } : { src };
}
