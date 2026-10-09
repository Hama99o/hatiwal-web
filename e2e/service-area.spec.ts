import { test, expect } from "@playwright/test";
import { isInServiceArea } from "../src/lib/service-area";

/*
 * The service area is Afghanistan + Pakistan (1.1.7, owner) — the same outline
 * as hatiwal-mobile src/lib/serviceArea.ts and hatiwal-api ServiceArea. Border
 * towns on our side stay inside (~13 km margin); the cities just across the
 * western border do not. Pure logic: no browser, no server.
 */
const at = (latitude: number, longitude: number) => ({ latitude, longitude });

const INSIDE: Array<[string, number, number]> = [
  ["Kabul", 34.5553, 69.2075], ["Herat", 34.352, 62.204], ["Islam Qala", 34.66, 61.07],
  ["Zaranj", 31.0125, 61.8628], ["Farah", 32.37, 62.11], ["Mazar-i-Sharif", 36.709, 67.11],
  ["Torkham", 34.11, 71.09], ["Chaman", 30.92, 66.45], ["Peshawar", 34.0, 71.57],
  ["Quetta", 30.18, 66.97], ["Islamabad", 33.684, 73.048], ["Lahore", 31.55, 74.34],
  ["Karachi", 24.86, 67.0], ["Taftan", 28.96, 61.59], ["Gwadar", 25.12, 62.32], ["Gilgit", 35.92, 74.31],
];
const OUTSIDE: Array<[string, number, number]> = [
  ["Mashhad", 36.3, 59.6], ["Tehran", 35.69, 51.39], ["Zahedan", 29.5, 60.86], ["Zabol", 31.03, 61.49],
  ["Taybad", 34.74, 60.78], ["Chabahar", 25.29, 60.64], ["Sarakhs", 36.54, 61.16], ["Tabriz", 38.08, 46.29],
  ["Dubai", 25.2, 55.27], ["Ashgabat", 37.95, 58.38], ["Dushanbe", 38.56, 68.77], ["Amritsar", 31.63, 74.87],
];

test.describe("isInServiceArea (Afghanistan + Pakistan)", () => {
  for (const [name, lat, lng] of INSIDE) {
    test(`${name} is inside`, () => expect(isInServiceArea(at(lat, lng))).toBe(true));
  }
  for (const [name, lat, lng] of OUTSIDE) {
    test(`${name} is outside`, () => expect(isInServiceArea(at(lat, lng))).toBe(false));
  }
  test("missing or broken coordinates are outside", () => {
    expect(isInServiceArea(null)).toBe(false);
    expect(isInServiceArea(at(Number.NaN, 69))).toBe(false);
  });
});
