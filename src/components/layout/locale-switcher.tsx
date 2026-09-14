"use client";

import { useLocale, useTranslations } from "next-intl";
import { Globe } from "lucide-react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

/**
 * TYPED TO THE ROUTING LOCALES ON PURPOSE — `Record<string, string>` is what let
 * this break. Urdu was added to `routing.locales` and never added here, so the
 * menu mapped over four locales while this returned `undefined` for one of them:
 * the Urdu row rendered with no label at all, blank and unclickable. Nothing
 * complained, because a string index signature accepts every key and misses
 * every absence.
 *
 * Keyed to `routing.locales` instead, adding a locale without a label is a
 * COMPILE error rather than a blank row someone has to notice.
 */
const LOCALE_LABEL: Record<(typeof routing.locales)[number], string> = {
  en: "English",
  ps: "پښتو",
  fa: "دری",
  ur: "اردو",
};

export function LocaleSwitcher() {
  const locale = useLocale();
  const t = useTranslations("nav");
  const pathname = usePathname();
  const router = useRouter();

  // usePathname() (next-intl) drops the query string. Read it from the live URL
  // at click time (client-only) so the search + browse filters (?q=&category=…)
  // survive a locale change — without useSearchParams(), which would force a
  // CSR bailout / Suspense boundary on every statically-rendered page.
  function switchTo(l: string) {
    const qs = typeof window !== "undefined" ? window.location.search : "";
    router.replace(qs ? `${pathname}${qs}` : pathname, { locale: l });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={t("language")}>
          <Globe className="size-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {routing.locales.map((l) => (
          <DropdownMenuItem
            key={l}
            onClick={() => switchTo(l)}
            className={cn(l === locale && "font-semibold text-primary")}
          >
            {LOCALE_LABEL[l]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
