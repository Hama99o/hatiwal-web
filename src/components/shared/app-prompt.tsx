"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { Smartphone, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Logomark } from "@/components/layout/logo";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/auth/auth-provider";
import {
  APP_PROMPT_CHANGED_EVENT,
  APP_STORE_URL,
  GOOGLE_PLAY_URL,
  OPEN_APP_PROMPT_EVENT,
  androidIntentUrl,
  appDeepLink,
  appPromptDismissed,
  appRouteFromPath,
  detectPlatform,
  dismissAppPrompt,
  type DevicePlatform,
} from "@/lib/app-links";

/** The welcome modal's flag (components/account/onboarding-modal.tsx). */
const ONBOARDED_KEY = "hatiwal.onboarded";
/** Let the page settle before suggesting anything. */
const SHOW_DELAY_MS = 1500;

/** The /download page IS the install page — never suggest on top of it. */
function onDownloadPage(pathname: string | null) {
  return !!pathname && /\/download\/?$/.test(pathname);
}

/**
 * The phone this is, or null on desktop. Read after mount only: the server
 * cannot know, and guessing during SSR would cache one device's answer.
 */
function usePhone(): Exclude<DevicePlatform, "other"> | null {
  const [phone, setPhone] = useState<Exclude<DevicePlatform, "other"> | null>(null);
  useEffect(() => {
    const p = detectPlatform();
    setPhone(p === "other" ? null : p);
  }, []);
  return phone;
}

/**
 * "Get the Hatiwal app" — the owner's install suggestion (2026-10-03).
 *
 *   • PHONES ONLY (Android, iPhone/iPad). Desktop never sees it.
 *   • Offered ONCE, a moment after the first page loads. Closing it is
 *     remembered for a year in a cookie, so it never comes back on its own —
 *     the user is never pushed twice.
 *   • After that, the small icon in the header (AppPromptHeaderButton) reopens
 *     it whenever they want.
 *   • Never stacked on the welcome modal: a signed-in user who has not seen
 *     that yet gets it first, and this waits for a later page.
 *
 * Buttons: the store for THIS phone, and "I have the app — open it", which
 * opens the app on the same listing or seller (route map: lib/app-links.ts).
 * On Android that is an intent:// link that falls back to /download when the
 * app is missing; on iPhone, the hatiwal:// deep link (Safari also shows
 * Apple's own Smart App Banner on every page).
 */
export function AppPromptSheet() {
  const t = useTranslations("openInApp");
  const phone = usePhone();
  const pathname = usePathname();
  const { status } = useAuth();
  const [open, setOpen] = useState(false);
  const titleId = useId();

  // First visit: offer once.
  useEffect(() => {
    if (!phone || status === "loading" || onDownloadPage(pathname)) return;
    if (appPromptDismissed()) return;
    if (status === "authed") {
      try {
        if (!window.localStorage.getItem(ONBOARDED_KEY)) return; // welcome first
      } catch {
        /* storage blocked: the welcome can't show either, so go ahead */
      }
    }
    const timer = window.setTimeout(() => setOpen(true), SHOW_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [phone, status, pathname]);

  // The header icon asks to reopen it.
  useEffect(() => {
    const reopen = () => setOpen(true);
    window.addEventListener(OPEN_APP_PROMPT_EVENT, reopen);
    return () => window.removeEventListener(OPEN_APP_PROMPT_EVENT, reopen);
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    dismissAppPrompt();
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  if (!open || !phone) return null;

  const route = appRouteFromPath(pathname ?? "");
  const store =
    phone === "android"
      ? { href: GOOGLE_PLAY_URL, label: "Google Play" }
      : { href: APP_STORE_URL, label: "App Store" };
  const openHref =
    phone === "android" ? androidIntentUrl(route) : route ? appDeepLink(route) : "hatiwal://";

  return (
    <div className="fixed inset-0 z-[60] flex items-end" data-testid="app-prompt">
      <button
        type="button"
        aria-label={t("notNow")}
        className="absolute inset-0 bg-black/40"
        onClick={close}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative w-full rounded-t-2xl border-t bg-card px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-5 shadow-2xl"
      >
        <button
          type="button"
          onClick={close}
          aria-label={t("notNow")}
          className="absolute end-3 top-3 rounded-md p-1.5 text-muted-foreground hover:bg-accent"
        >
          <X className="size-5" />
        </button>
        <div className="flex items-center gap-3 pe-8">
          <Logomark className="size-12 shrink-0" />
          <div className="min-w-0">
            <h2 id={titleId} className="text-lg font-semibold">
              {t("title")}
            </h2>
            <p className="text-sm text-muted-foreground">{t("sub")}</p>
          </div>
        </div>
        <div className="mt-5 grid gap-2">
          <Button asChild size="lg">
            <a href={store.href} data-testid="app-prompt-store" onClick={close}>
              {store.label}
            </a>
          </Button>
          <Button asChild size="lg" variant="outline">
            <a href={openHref} data-testid="app-prompt-open" onClick={close}>
              {t("haveIt")}
            </a>
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={close}
            data-testid="app-prompt-not-now"
          >
            {t("notNow")}
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * The small "Get the app" icon in the header: phones only, and only once the
 * suggestion has been closed (before that, the suggestion itself is the way
 * in). Tapping it reopens the suggestion — never a forced redirect.
 */
export function AppPromptHeaderButton() {
  const t = useTranslations("openInApp");
  const phone = usePhone();
  const pathname = usePathname();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setDismissed(appPromptDismissed());
    const sync = () => setDismissed(appPromptDismissed());
    window.addEventListener(APP_PROMPT_CHANGED_EVENT, sync);
    return () => window.removeEventListener(APP_PROMPT_CHANGED_EVENT, sync);
  }, []);

  if (!phone || !dismissed || onDownloadPage(pathname)) return null;

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={t("getApp")}
      title={t("getApp")}
      data-testid="app-prompt-icon"
      onClick={() => window.dispatchEvent(new Event(OPEN_APP_PROMPT_EVENT))}
    >
      <Smartphone className="size-5" />
    </Button>
  );
}
