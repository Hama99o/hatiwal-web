import { meRequest } from "./me";

// Mirrors the mobile saved-searches contract (src/api/saved-searches.ts).
// A saved search captures category + price + location and, since 1.2.1, the
// keyword (`query`) and the alert opt-in (hatiwal-api docs/SAVED_SEARCH_ALERTS.md).
export interface SavedSearch {
  id: number;
  location: string | null;
  categoryId: number | null;
  categoryName: string | null;
  priceMin: number | null;
  priceMax: number | null;
  latitude: number | null;
  longitude: number | null;
  radius: number | null;
  locationBased: boolean;
  createdAt: string;
  lastViewedAt: string | null;
  newMatchesCount: number;
  /** The browse keyword it was saved with (1.2.1; absent on an older API). */
  query?: string | null;
  /** Followed: a new match is pushed to the phone (1.2.1). */
  alert?: boolean;
}

export interface SavedSearchInput {
  location?: string;
  categoryId?: number;
  priceMin?: number;
  priceMax?: number;
  latitude?: number;
  longitude?: number;
  radius?: number;
  query?: string;
  alert?: boolean;
}

export async function getSavedSearches(): Promise<SavedSearch[]> {
  const d = await meRequest<{ savedSearches: SavedSearch[] }>(
    "users/saved_searches",
  );
  return d.savedSearches ?? [];
}

export async function createSavedSearch(
  input: SavedSearchInput,
): Promise<SavedSearch> {
  // Mobile posts the filters un-nested; meRequest snake-cases the keys.
  const d = await meRequest<{ savedSearch: SavedSearch }>(
    "users/saved_searches",
    { method: "POST", json: input },
  );
  return d.savedSearch;
}

export async function deleteSavedSearch(id: number): Promise<void> {
  await meRequest(`users/saved_searches/${id}`, { method: "DELETE" });
}

/** Follow / unfollow one saved search. A 6th followed search: 422 code alerts_limit. */
export async function setSavedSearchAlert(id: number, alert: boolean): Promise<SavedSearch> {
  const d = await meRequest<{ savedSearch: SavedSearch }>(`users/saved_searches/${id}`, {
    method: "PUT",
    json: { alert },
  });
  return d.savedSearch;
}

/** Reset the new-matches counter after the user runs the search (mobile parity). */
export async function markSeenSavedSearch(id: number): Promise<SavedSearch> {
  const d = await meRequest<{ savedSearch: SavedSearch }>(
    `users/saved_searches/${id}/mark_seen`,
    { method: "PUT" },
  );
  return d.savedSearch;
}
