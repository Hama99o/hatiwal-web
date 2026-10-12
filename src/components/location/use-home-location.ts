"use client";

import { useCallback, useEffect } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { sendLocationGuess } from "@/lib/api/location";
import { isInServiceArea } from "@/lib/service-area";
import { DEFAULT_HOME_POINT } from "@/components/browse/filters";
import type { HomeLocation } from "@/lib/types";

/**
 * LOC-1 — where "items near you" means for this viewer
 * (hatiwal-mobile/docs/USER_LOCATION.md). Web twin of mobile's
 * src/hooks/useHomeLocation.ts.
 *
 * The rule (own address → guessed → Kabul) is resolved by the API and read
 * from `me.location`; it is never re-implemented here. Guests, an older API,
 * and anything outside Afghanistan/Pakistan/Iran get Kabul.
 *
 * Also sends the browser-only clues:
 *   - `gps`: at most once a day, ONLY when geolocation is already granted
 *     (Permissions API — never prompts), never for an own address;
 *   - `search_area`: through `reportSearchArea`, when a zone is picked.
 */

export const DEFAULT_HOME: HomeLocation = {
  source: "default",
  latitude: DEFAULT_HOME_POINT.latitude,
  longitude: DEFAULT_HOME_POINT.longitude,
  province: "Kabul",
};

const GPS_CLUE_KEY = "loc1-gps-clue-at";
const GPS_CLUE_EVERY_MS = 24 * 60 * 60 * 1000;

/** `me.location` made safe to use: numbers, inside the service area, else Kabul. */
export function resolveHome(loc: HomeLocation | null | undefined): HomeLocation {
  if (!loc) return DEFAULT_HOME;
  const latitude = Number(loc.latitude);
  const longitude = Number(loc.longitude);
  if (!isInServiceArea({ latitude, longitude })) return DEFAULT_HOME;
  return { source: loc.source, latitude, longitude, province: loc.province ?? null };
}

function gpsClueDue(): boolean {
  try {
    const last = Number(window.localStorage.getItem(GPS_CLUE_KEY));
    return !Number.isFinite(last) || Date.now() - last >= GPS_CLUE_EVERY_MS;
  } catch {
    return false; // No storage: skip rather than risk a clue on every load.
  }
}

function markGpsClue(): void {
  try {
    window.localStorage.setItem(GPS_CLUE_KEY, String(Date.now()));
  } catch {
    /* private mode — the clue just isn't throttled across reloads */
  }
}

async function geolocationGranted(): Promise<boolean> {
  try {
    if (!navigator.permissions || !navigator.geolocation) return false;
    const status = await navigator.permissions.query({ name: "geolocation" as PermissionName });
    return status.state === "granted";
  } catch {
    return false;
  }
}

export function useHomeLocation() {
  const { status, user, refresh } = useAuth();
  const authed = status === "authed";
  const home = authed ? resolveHome(user?.location) : DEFAULT_HOME;
  const source = authed ? user?.location?.source : undefined;

  useEffect(() => {
    if (!authed || !source || source === "own" || !gpsClueDue()) return;
    let cancelled = false;
    (async () => {
      if (!(await geolocationGranted())) return; // never prompts
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (cancelled) return;
          markGpsClue();
          const point = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
          if (!isInServiceArea(point)) return; // abroad: ignored, the Bazaar stays on Kabul
          sendLocationGuess({ ...point, source: "gps" })
            .then(() => {
              if (!cancelled) void refresh();
            })
            .catch(() => {});
        },
        () => {},
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 },
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [authed, source, refresh]);

  const reportSearchArea = useCallback(
    (point: { latitude: number; longitude: number }) => {
      if (!authed || source === "own" || !isInServiceArea(point)) return;
      sendLocationGuess({ ...point, source: "search_area" })
        .then(() => refresh())
        .catch(() => {});
    },
    [authed, source, refresh],
  );

  return { home, authed, reportSearchArea };
}
