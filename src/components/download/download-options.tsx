"use client";

import { useEffect, useState } from "react";
import { Globe, Play, Smartphone, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { APP_STORE_URL, GOOGLE_PLAY_URL } from "@/lib/app-links";

type Platform = "ios" | "android" | "other";
type OptionId = "ios" | "android" | "web";

function detectPlatform(): Platform {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
  // iPadOS 13+ reports itself as a Mac; touch support gives it away.
  if (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "other";
}

/**
 * The three ways in — App Store, Google Play, the web — ALL always visible.
 * Detection only re-orders them and marks the visitor's store as recommended;
 * it never hides an option (a desktop visitor must still reach both stores).
 * The server render uses the neutral order, so the page works without JS.
 */
export function DownloadOptions() {
  const t = useTranslations("download");
  const [platform, setPlatform] = useState<Platform>("other");

  useEffect(() => {
    setPlatform(detectPlatform());
  }, []);

  const order: OptionId[] =
    platform === "android" ? ["android", "ios", "web"] : ["ios", "android", "web"];
  const lead: OptionId | null = platform === "other" ? null : platform;

  const options: Record<
    OptionId,
    { icon: LucideIcon; label: string; sub: string; href: string; external: boolean }
  > = {
    ios: { icon: Smartphone, label: "App Store", sub: t("forIphone"), href: APP_STORE_URL, external: true },
    android: { icon: Play, label: "Google Play", sub: t("forAndroid"), href: GOOGLE_PLAY_URL, external: true },
    web: { icon: Globe, label: t("web"), sub: t("webSub"), href: "/bazaar", external: false },
  };

  return (
    <ul className="mt-8 space-y-3" data-testid="download-options" data-platform={platform}>
      {order.map((id) => {
        const { icon: Icon, label, sub, href, external } = options[id];
        const isLead = id === lead;
        const className = cn(
          "flex min-h-16 w-full items-center gap-4 rounded-xl border px-4 py-3 shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          isLead
            ? "border-primary bg-primary text-primary-foreground hover:bg-primary/90"
            : "bg-card text-card-foreground hover:bg-accent hover:text-accent-foreground",
        );
        const body = (
          <>
            <Icon className="size-7 shrink-0" aria-hidden />
            <span className="flex min-w-0 flex-col text-start">
              <span className={cn("text-xs", isLead ? "text-primary-foreground/80" : "text-muted-foreground")}>
                {sub}
              </span>
              <span className="text-lg font-bold leading-tight" dir="auto">
                {label}
              </span>
            </span>
            {isLead && (
              <span className="ms-auto shrink-0 rounded-full bg-primary-foreground/15 px-2.5 py-1 text-xs font-medium">
                {t("recommended")}
              </span>
            )}
          </>
        );
        return (
          <li key={id} data-option={id}>
            {external ? (
              <a href={href} rel="noopener" className={className}>
                {body}
              </a>
            ) : (
              <Link href={href} className={className}>
                {body}
              </Link>
            )}
          </li>
        );
      })}
    </ul>
  );
}
