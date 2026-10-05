"use client";

import { MapPin } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { getProvinceByValue, getProvinceName } from "@/lib/provinces";

/** The place the bar names: the province in the reader's language, else "your area". */
export function usePlaceName(province: string | null): string {
  const t = useTranslations("location");
  const locale = useLocale();
  const p = getProvinceByValue(province);
  return p ? getProvinceName(p, locale) : t("yourArea");
}

/**
 * "📍 Showing items near Herat · Change" above the Bazaar results (LOC-1,
 * hatiwal-mobile/docs/USER_LOCATION.md). Web twin of mobile's LocationBar, with
 * the same test ids.
 */
export function LocationBar({
  province,
  onChange,
}: {
  province: string | null;
  onChange: () => void;
}) {
  const t = useTranslations("location");
  const place = usePlaceName(province);
  // Split around the place so it can carry its own weight and test id without
  // a second key; the sentence order stays the locale's.
  const sentence = t("showingNear", { place });
  const at = sentence.indexOf(place);
  const before = at >= 0 ? sentence.slice(0, at) : sentence;
  const after = at >= 0 ? sentence.slice(at + place.length) : "";

  return (
    <div
      data-testid="location-bar"
      className="mb-3 flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground"
    >
      <MapPin className="size-4 shrink-0 text-primary" aria-hidden />
      <p className="min-w-0 truncate">
        {before}
        {at >= 0 && (
          <span data-testid="location-bar-place" className="font-semibold text-foreground">
            {place}
          </span>
        )}
        {after}
      </p>
      <span aria-hidden>·</span>
      <button
        type="button"
        data-testid="location-change"
        onClick={onChange}
        aria-label={`${t("change")} — ${place}`}
        // min-h-11: a 44px touch target on phones, without growing the bar.
        className="-my-2 inline-flex min-h-11 shrink-0 items-center rounded-sm px-1 font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {t("change")}
      </button>
    </div>
  );
}
