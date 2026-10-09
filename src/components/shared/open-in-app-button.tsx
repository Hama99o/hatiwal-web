"use client";

import { useEffect, useRef, useState } from "react";
import { Smartphone } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  APP_STORE_URL,
  OPEN_APP_FALLBACK_MS,
  detectPlatform,
  openInAppHref,
  type AppRoute,
  type DevicePlatform,
} from "@/lib/app-links";

/**
 * "Open in the Hatiwal app" — a visible button on the pages that exist in the
 * app (listing, seller, shop, team invite), for PHONES only (owner, 2026-10-09).
 *
 * Why, on top of Universal / App Links and the Smart App Banner: Apple serves
 * the AASA from its own CDN, which lags a change by a day or two, and in-app
 * browsers (WhatsApp, Instagram…) never fire Universal Links at all. A tap on
 * a custom-scheme link works in all of them.
 *
 *   • Android: an intent:// link — Chrome opens the app, or our /download page
 *     when it isn't installed (lib/app-links.ts androidIntentUrl).
 *   • iPhone: hatiwal://<route>. If the page is still in front after
 *     OPEN_APP_FALLBACK_MS, the app did not open: go to the App Store. Leaving
 *     the page (the app opened) cancels that.
 */
export function OpenInAppButton({ route, className }: { route: AppRoute; className?: string }) {
  const t = useTranslations("openInApp");
  const [phone, setPhone] = useState<Exclude<DevicePlatform, "other"> | null>(null);
  const timer = useRef<number | null>(null);

  // Client-only: the server cannot know the phone (and must not cache a guess).
  useEffect(() => {
    const p = detectPlatform();
    setPhone(p === "other" ? null : p);
  }, []);

  useEffect(() => {
    const cancel = () => {
      if (document.visibilityState === "hidden" && timer.current !== null) {
        window.clearTimeout(timer.current);
        timer.current = null;
      }
    };
    document.addEventListener("visibilitychange", cancel);
    window.addEventListener("pagehide", cancel);
    return () => {
      document.removeEventListener("visibilitychange", cancel);
      window.removeEventListener("pagehide", cancel);
      if (timer.current !== null) window.clearTimeout(timer.current);
    };
  }, []);

  if (!phone) return null;
  const href = openInAppHref(route, phone);

  return (
    <Button asChild size="lg" className={className ?? "w-full"}>
      <a
        href={href}
        data-testid="open-in-app"
        onClick={() => {
          if (phone !== "ios") return; // Android's intent carries its own fallback
          if (timer.current !== null) window.clearTimeout(timer.current);
          timer.current = window.setTimeout(() => {
            timer.current = null;
            if (document.visibilityState === "visible") window.location.href = APP_STORE_URL;
          }, OPEN_APP_FALLBACK_MS);
        }}
      >
        <Smartphone className="size-5" aria-hidden />
        {t("cta")}
      </a>
    </Button>
  );
}
