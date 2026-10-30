"use client";

import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api/client";

/**
 * What THIS server offers: `GET /app_config` → `features` (hatiwal-api
 * AppReleaseSetting). Every flag is false until it answers, on any failure,
 * and on an API that predates it — so a button never appears in front of a
 * server that cannot do the thing.
 */
export interface ServerFeatures {
  /** Search by image (hatiwal-api docs/IMAGE_SEARCH.md). */
  imageSearch?: boolean;
  /** Sell with a photo (hatiwal-api docs/SELL_WITH_PHOTO.md). */
  categorySuggestion?: boolean;
}

export function useServerFeatures(): ServerFeatures {
  const { data } = useQuery({
    queryKey: ["app-config", "features"],
    queryFn: () => apiGet<{ features?: ServerFeatures }>("app_config"),
    staleTime: 5 * 60_000,
    retry: false,
  });
  return data?.features ?? {};
}
