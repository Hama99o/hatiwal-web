"use client";

import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api/client";

/**
 * Whether THIS server offers search by image: `GET /app_config` →
 * `features.image_search` (hatiwal-api docs/IMAGE_SEARCH.md). False until it
 * answers, on any failure, and on an API that predates the flag — so the 📷
 * button never appears in front of a server that cannot search.
 */
export function useImageSearchEnabled(): boolean {
  const { data } = useQuery({
    queryKey: ["app-config", "features"],
    queryFn: () => apiGet<{ features?: { imageSearch?: boolean } }>("app_config"),
    staleTime: 5 * 60_000,
    retry: false,
  });
  return data?.features?.imageSearch === true;
}
