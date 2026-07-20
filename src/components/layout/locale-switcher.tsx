"use client";

import { useLocale, useTranslations } from "next-intl";
import { Globe } from "lucide-react";
import { useSearchParams } from "next/navigation";
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
  const searchParams = useSearchParams();

  // usePathname() (next-intl) drops the query string, so preserve the current
  // search + browse filters (?q=&category=&price=…) across a locale change.
  const qs = searchParams.toString();
  const href = qs ? `${pathname}?${qs}` : pathname;

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
            onClick={() => router.replace(href, { locale: l })}
            className={cn(l === locale && "font-semibold text-primary")}
          >
            {LOCALE_LABEL[l]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
