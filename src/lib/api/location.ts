import { meRequest } from "./me";

/** Where a clue about the user's location came from (`users.guessed_source`). */
export type LocationGuessSource = "search_area" | "gps";

/**
 * LOC-1 — tell the API where the user seems to be (hatiwal-mobile/docs/USER_LOCATION.md).
 * Only a guess: ignored server-side when the user has an own address or the
 * point is abroad (204 either way). No province is sent — the API names it from
 * the point. Mirrors mobile's `locationAPI.sendGuess`.
 */
export async function sendLocationGuess(guess: {
  latitude: number;
  longitude: number;
  source: LocationGuessSource;
}): Promise<void> {
  await meRequest<unknown>("users/me/location_guess", { method: "PATCH", json: guess });
}
