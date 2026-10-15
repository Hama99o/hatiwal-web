"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Smartphone, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Logomark } from "@/components/layout/logo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/auth/auth-provider";
import {
  APP_PROMPT_CHANGED_EVENT,
  APP_STORE_URL,
  GOOGLE_PLAY_URL,
  OPEN_APP_FALLBACK_MS,
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

/** Thread screens own the bottom edge (the composer): no bar there. */
function ownsBottomEdge(pathname: string | null) {
  return !!pathname && /\/conversations\/[^/]+/.test(pathname);
}

/**
 * "Get the Hatiwal app" — the owner's install suggestion (2026-10-03), made
 * NON-BLOCKING on 2026-10-15 (web QA report #12): it used to open as a modal
 * sheet over the page on the first visit, on top of a full-width "Open in app"
 * button — two nudges, and an intrusive interstitial for search.
 *
 * Now there is ONE nudge, and it never covers what the person came to read:
 *
 *   • FIRST VISIT, PHONES ONLY: a slim bar pinned to the bottom (`app-prompt`),
 *     with one action — open THIS page in the app (Android's intent falls back
 *     to /download, an iPhone goes to the App Store when the app did not open) —
 *     and ✕. No backdrop, not a dialog: the page stays fully usable. The page
 *     gets the bar's height as bottom padding, so the footer is never hidden.
 *     On a listing, it rides on top of the sticky Contact bar while that is up.
 *   • ✕ is remembered for a year (cookie), so it never comes back on its own.
 *   • After that, the header icon (AppPromptHeaderButton) opens the full chooser
 *     — store, "I have the app — open it", Not now — as a sheet, because the
 *     person ASKED for it.
 *   • Never stacked on the welcome modal, never on /download, never on a chat
 *     thread (the composer owns the bottom edge).
 */
export function AppPromptSheet() {
  const t = useTranslations("openInApp");
  const phone = usePhone();
  const pathname = usePathname();
  const { status } = useAuth();
  const [mode, setMode] = useState<"bar" | "sheet" | null>(null);
  const titleId = useId();
  const barRef = useRef<HTMLDivElement>(null);
  const fallback = useRef<number | null>(null);

  // First visit: the bar, once.
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
    const timer = window.setTimeout(() => setMode((m) => m ?? "bar"), SHOW_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [phone, status, pathname]);

  // The header icon asks for the full chooser.
  useEffect(() => {
    const reopen = () => setMode("sheet");
    window.addEventListener(OPEN_APP_PROMPT_EVENT, reopen);
    return () => window.removeEventListener(OPEN_APP_PROMPT_EVENT, reopen);
  }, []);

  // An iPhone deep link that did not open the app → the App Store. Leaving the
  // page (the app opened) cancels it.
  useEffect(() => {
    const cancel = () => {
      if (document.visibilityState === "hidden" && fallback.current !== null) {
        window.clearTimeout(fallback.current);
        fallback.current = null;
      }
    };
    document.addEventListener("visibilitychange", cancel);
    window.addEventListener("pagehide", cancel);
    return () => {
      document.removeEventListener("visibilitychange", cancel);
      window.removeEventListener("pagehide", cancel);
      if (fallback.current !== null) window.clearTimeout(fallback.current);
    };
  }, []);

  const close = useCallback(() => {
    setMode(null);
    dismissAppPrompt();
  }, []);

  const barShown = mode === "bar" && !!phone && !ownsBottomEdge(pathname);

  // Reserve the bar's height at the bottom of the page while it shows, so it
  // never sits on the footer's last line. Bottom padding moves nothing above
  // it: no layout shift.
  useEffect(() => {
    const el = barRef.current;
    const root = document.documentElement;
    if (!barShown || !el) {
      root.style.removeProperty("--app-nudge-h");
      return;
    }
    const measure = () => root.style.setProperty("--app-nudge-h", `${el.getBoundingClientRect().height}px`);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => {
      observer.disconnect();
      root.style.removeProperty("--app-nudge-h");
    };
  }, [barShown]);

  useEffect(() => {
    if (mode !== "sheet") return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mode, close]);

  if (!mode || !phone) return null;

  const route = appRouteFromPath(pathname ?? "");
  const store =
    phone === "android"
      ? { href: GOOGLE_PLAY_URL, label: "Google Play" }
      : { href: APP_STORE_URL, label: "App Store" };
  const openHref =
    phone === "android" ? androidIntentUrl(route) : route ? appDeepLink(route) : "hatiwal://";

  if (mode === "bar") {
    if (!barShown) return null;
    return (
      <div
        ref={barRef}
        role="region"
        aria-labelledby={titleId}
        data-testid="app-prompt"
        data-variant="bar"
        // Above the listing page's sticky Contact bar when it is up (it publishes
        // --action-bar-h), at the bottom edge otherwise.
        className={cn(
          "fixed inset-x-0 z-30 px-3 pt-2 transition-[bottom] duration-200 ease-out motion-reduce:transition-none",
          "bottom-[var(--action-bar-h,0px)]",
          "pb-[max(0.75rem,env(safe-area-inset-bottom))]",
        )}
      >
        <div className="flex items-center gap-3 rounded-2xl border bg-card/95 p-2.5 ps-3 shadow-pop backdrop-blur-md">
          <Logomark className="size-10 shrink-0" />
          <div className="min-w-0 flex-1">
            <p id={titleId} className="truncate text-sm font-semibold">
              {t("title")}
            </p>
            <p className="truncate text-xs text-muted-foreground">{t("sub")}</p>
          </div>
          <Button asChild size="sm" className="shrink-0 px-4">
            <a
              href={openHref}
              data-testid="app-prompt-open"
              onClick={() => {
                if (phone !== "ios") return; // Android's intent carries its own fallback
                if (fallback.current !== null) window.clearTimeout(fallback.current);
                fallback.current = window.setTimeout(() => {
                  fallback.current = null;
                  if (document.visibilityState === "visible") window.location.href = APP_STORE_URL;
                }, OPEN_APP_FALLBACK_MS);
              }}
            >
              {t("open")}
            </a>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={close}
            aria-label={t("notNow")}
            title={t("notNow")}
            data-testid="app-prompt-not-now"
            className="-ms-1 shrink-0 text-muted-foreground"
          >
            <X className="size-5" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end" data-testid="app-prompt" data-variant="sheet">
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
        className="relative w-full rounded-t-3xl border-t bg-card px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-5 shadow-pop"
      >
        <button
          type="button"
          onClick={close}
          aria-label={t("notNow")}
          className="absolute end-2 top-2 flex size-11 items-center justify-center rounded-full text-muted-foreground hover:bg-accent"
        >
          <X className="size-5" />
        </button>
        <div className="flex items-center gap-3 pe-10">
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
