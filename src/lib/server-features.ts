"use client";

import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api/client";

/** The features a server announces in `GET /app_config` → `features`. */
export interface ServerFeatures {
  /** Search by image (hatiwal-api docs/IMAGE_SEARCH.md). */
  imageSearch?: boolean;
  /** Voice messages in chat (hatiwal-api docs/VOICE_MESSAGES.md, 1.2.1). */
  voiceMessages?: boolean;
  /** Sell with a photo (hatiwal-api docs/SELL_WITH_PHOTO.md, 1.2.1). */
  categorySuggestion?: boolean;
}

/**
 * What THIS server offers. Every flag is false until it answers, on any
 * failure, and on an API that predates it — so a button never appears in front
 * of a server that cannot serve it. One request (and one cache entry) for all.
 */
export function useServerFeatures(): ServerFeatures {
  const { data } = useQuery({
    queryKey: ["app-config", "features"],
    queryFn: () => apiGet<{ features?: ServerFeatures }>("app_config"),
    staleTime: 5 * 60_000,
    retry: false,
  });
  return data?.features ?? {};
}

/** Whether THIS server offers one feature (see useServerFeatures). */
export function useServerFeature(name: keyof ServerFeatures): boolean {
  return useServerFeatures()[name] === true;
}
