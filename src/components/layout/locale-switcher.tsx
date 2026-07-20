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

const LOCALE_LABEL: Record<string, string> = {
  en: "English",
  ps: "پښتو",
  fa: "دری",
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
