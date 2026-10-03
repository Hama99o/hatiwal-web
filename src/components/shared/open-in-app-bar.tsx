"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Logomark } from "@/components/layout/logo";
import { Button } from "@/components/ui/button";
import {
  androidIntentUrl,
  detectPlatform,
  type AppRoute,
} from "@/lib/app-links";

const DISMISS_KEY = "hatiwal:open-in-app-dismissed";

/**
 * "Open in the Hatiwal app" — Android only.
 *
 * Its button is an `intent://` link: Chrome opens the app at this listing or
 * seller when it is installed, and our /download page when it is not (see
 * androidIntentUrl). iPhones get Apple's own Smart App Banner instead, from the
 * page's `itunes` metadata, so this bar would only duplicate it there.
 *
 * Renders nothing on the server and until mount: which phone this is can only
 * be read in the browser. Closing it is remembered (per browser), and storage
 * failures (private mode) just mean it shows again — never an error.
 */
export function OpenInAppBar({ route }: { route: AppRoute }) {
  const t = useTranslations();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (detectPlatform() !== "android") return;
    try {
      if (window.localStorage.getItem(DISMISS_KEY)) return;
    } catch {
      /* storage unavailable: show it */
    }
    setShow(true);
  }, []);

  if (!show) return null;

  const dismiss = () => {
    setShow(false);
    try {
      window.localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* not remembered — fine */
    }
  };

  return (
    <div
      data-testid="open-in-app-bar"
      className="sticky top-16 z-30 flex items-center gap-3 border-b bg-card/95 px-4 py-2 shadow-sm backdrop-blur"
    >
      <Logomark className="size-8 shrink-0" />
      <p className="min-w-0 flex-1 truncate text-sm font-medium">
        {t("openInApp.cta")}
      </p>
      <Button asChild size="sm" className="shrink-0">
        <a href={androidIntentUrl(route)} data-testid="open-in-app-open">
          {t("openInApp.open")}
        </a>
      </Button>
      <button
        type="button"
        onClick={dismiss}
        aria-label={t("common.close")}
        className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-accent"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
