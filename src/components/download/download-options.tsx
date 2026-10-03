"use client";

import { useEffect, useState } from "react";
import { Globe, Play, Smartphone, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import {
  APP_STORE_URL,
  GOOGLE_PLAY_URL,
  detectPlatform,
  type DevicePlatform,
} from "@/lib/app-links";

type Platform = DevicePlatform;
type OptionId = "ios" | "android" | "web";

// The owner's rule for what each device sees by default.
const VISIBLE: Record<Platform, OptionId[]> = {
  ios: ["ios"],
  android: ["android", "web"],
  other: ["ios", "android", "web"],
};

/**
 * The three ways in — App Store, Google Play, the web.
 *
 * The server ALWAYS renders all three (platform "other"): branching on the user
 * agent during SSR would mismatch on hydration or cache one device's answer,
 * and crawlers / no-JS visitors should see every option. After mount we narrow
 * to the device's set.
 *
 * Detection is wrong often enough that hiding must never be a dead end, so
 * whenever something is hidden an "other options" button reveals the full set.
 */
export function DownloadOptions() {
  const t = useTranslations("download");
  const [platform, setPlatform] = useState<Platform>("other");
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    setPlatform(detectPlatform());
  }, []);

  const order: OptionId[] =
    platform === "android"
      ? ["android", "ios", "web"]
      : ["ios", "android", "web"];
  const lead: OptionId | null = platform === "other" ? null : platform;
  const shown = showAll
    ? order
    : order.filter((id) => VISIBLE[platform].includes(id));
  const hasHidden = shown.length < order.length;

  const options: Record<
    OptionId,
    {
      icon: LucideIcon;
      label: string;
      sub: string;
      href: string;
      external: boolean;
    }
  > = {
    ios: {
      icon: Smartphone,
      label: "App Store",
      sub: t("forIphone"),
      href: APP_STORE_URL,
      external: true,
    },
    android: {
      icon: Play,
      label: "Google Play",
      sub: t("forAndroid"),
      href: GOOGLE_PLAY_URL,
      external: true,
    },
    web: {
      icon: Globe,
      label: t("web"),
      sub: t("webSub"),
      href: "/bazaar",
      external: false,
    },
  };

  return (
    <div className="mt-8">
      <ul
        className="space-y-3"
        data-testid="download-options"
        data-platform={platform}
      >
        {shown.map((id) => {
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
                <span
                  className={cn(
                    "text-xs",
                    isLead
                      ? "text-primary-foreground/80"
                      : "text-muted-foreground",
                  )}
                >
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
      {hasHidden && (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="mt-4 text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
          data-testid="download-other-options"
        >
          {t("otherOptions")}
        </button>
      )}
    </div>
  );
}
