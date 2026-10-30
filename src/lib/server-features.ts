"use client";

import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api/client";

/** The features a server announces in `GET /app_config` → `features`. */
export interface ServerFeatures {
  /** Search by image (hatiwal-api docs/IMAGE_SEARCH.md). */
  imageSearch?: boolean;
  /** Voice messages in chat (hatiwal-api docs/VOICE_MESSAGES.md, 1.2.1). */
  voiceMessages?: boolean;
}

/**
 * Whether THIS server offers a feature. False until it answers, on any failure,
 * and on an API that predates the flag — so a button never appears in front of
 * a server that cannot serve it. One request (and one cache entry) for all of them.
 */
export function useServerFeature(name: keyof ServerFeatures): boolean {
  const { data } = useQuery({
    queryKey: ["app-config", "features"],
    queryFn: () => apiGet<{ features?: ServerFeatures }>("app_config"),
    staleTime: 5 * 60_000,
    retry: false,
  });
  return data?.features?.[name] === true;
}
