import { apiGet } from "./client";

// Mirrors the mobile contract (src/api/meetup-spots.ts). IDEA-6: a busy public
// place the meetup dialog suggests (a mall entrance or a big bazaar); the API
// sends only the rows an admin switched on.
export interface MeetupSpot {
  id: number;
  cityKey: string;
  kind: "mall" | "bazaar";
  nameEn: string;
  namePs: string | null;
  nameFa: string | null;
  nameUr: string | null;
  latitude: number;
  longitude: number;
}

export async function getMeetupSpots(): Promise<MeetupSpot[]> {
  const data = await apiGet<{ meetupSpots: MeetupSpot[] }>("meetup_spots");
  return data.meetupSpots ?? [];
}
