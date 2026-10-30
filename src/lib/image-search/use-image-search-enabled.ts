"use client";

import { useServerFeature } from "@/lib/server-features";

/**
 * Whether THIS server offers search by image: `GET /app_config` →
 * `features.image_search` (hatiwal-api docs/IMAGE_SEARCH.md). False until it
 * answers, on any failure, and on an API that predates the flag — so the 📷
 * button never appears in front of a server that cannot search.
 */
export function useImageSearchEnabled(): boolean {
  return useServerFeature("imageSearch");
}
