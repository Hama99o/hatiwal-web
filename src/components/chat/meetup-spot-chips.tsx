"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { Store } from "lucide-react";
import { getMeetupSpots, type MeetupSpot } from "@/lib/api/meetup-spots";
import { spotName, spotsNear } from "@/lib/meetup-spots";

/**
 * IDEA-6: busy public places near the listing, in the meetup dialog. A click
 * fills the place (and the pin the apps show). Suggestions only — the copy never
 * calls them "safe". No point on the listing, or nothing near → nothing.
 */
export function MeetupSpotChips({
  point,
  onPick,
}: {
  point: { latitude: number; longitude: number } | null;
  onPick: (spot: MeetupSpot, name: string) => void;
}) {
  const t = useTranslations("chat.meetup.spots");
  const locale = useLocale();
  const { data } = useQuery({
    queryKey: ["meetup-spots"],
    queryFn: getMeetupSpots,
    staleTime: 24 * 60 * 60 * 1000,
    enabled: point != null,
  });
  const spots = spotsNear(data, point);
  if (spots.length === 0) return null;

  return (
    <div data-testid="meetup-spots" className="space-y-2">
      <p className="text-sm font-medium text-muted-foreground">{t("title")}</p>
      <div className="flex flex-wrap gap-2">
        {spots.map((spot) => {
          const name = spotName(spot, locale);
          return (
            <button
              key={spot.id}
              type="button"
              onClick={() => onPick(spot, name)}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-secondary px-3 text-sm text-foreground hover:bg-secondary/80"
            >
              <Store className="size-3.5 text-muted-foreground" aria-hidden />
              {name}
            </button>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">{t("tip")}</p>
    </div>
  );
}
