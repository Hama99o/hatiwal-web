import { test, expect } from "@playwright/test";
import {
  BAND_SPREAD,
  BANDABLE_CURRENCY,
  priceBand,
  recoveryBand,
} from "../src/components/listing/recovery-band";

/**
 * Unit specs for the recovery CTA's price band — no browser, no server (the
 * module is deliberately pure, so it imports here by relative path with nothing
 * behind it). The browser-level behaviour lives in `listing-detail.spec.ts`;
 * this file pins the arithmetic and the edge cases that a page test can only
 * reach through a fixture.
 */
test.describe("priceBand", () => {
  test("is +/-30% of an AFN price, rounded", () => {
    expect(BAND_SPREAD).toBe(0.3);
    expect(priceBand(8000, "AFN")).toEqual({ min: "5600", max: "10400" });
    expect(priceBand(70000, "AFN")).toEqual({ min: "49000", max: "91000" });
    // Rounded, never fractional — Rails compares against a numeric column and a
    // "3.5" in the URL is noise the Bazaar inputs would echo back.
    expect(priceBand(1001, "AFN")).toEqual({ min: "701", max: "1301" });
    expect(priceBand(5, "AFN")).toEqual({ min: "4", max: "7" });
  });

  test("emits nothing for a price that can't make a band", () => {
    const none = { min: "", max: "" };
    expect(priceBand(0, "AFN")).toEqual(none);
    expect(priceBand(-100, "AFN")).toEqual(none);
    expect(priceBand(null, "AFN")).toEqual(none);
    expect(priceBand(undefined, "AFN")).toEqual(none);
    expect(priceBand(Number.NaN, "AFN")).toEqual(none);
    expect(priceBand(Number.POSITIVE_INFINITY, "AFN")).toEqual(none);
  });

  test("never inverts the range", () => {
    for (const p of [1, 2, 3, 7, 999, 1_000_000]) {
      const { min, max } = priceBand(p, "AFN");
      expect(Number(min)).toBeLessThanOrEqual(Number(max));
      expect(Number(min)).toBeGreaterThanOrEqual(0);
    }
  });

  test("only AFN can be banded — the Bazaar's price filter is currency-blind", () => {
    const none = { min: "", max: "" };
    expect(BANDABLE_CURRENCY).toBe("AFN");
    // A $900 laptop would otherwise ask the AFN feed for 630-1,170.
    expect(priceBand(900, "USD")).toEqual(none);
    expect(priceBand(900, "EUR")).toEqual(none);
    // Missing/garbled currency is treated as un-bandable, not as AFN.
    expect(priceBand(900, null)).toEqual(none);
    expect(priceBand(900, undefined)).toEqual(none);
    expect(priceBand(900, "")).toEqual(none);
    // …but case never decides it.
    expect(priceBand(900, "afn")).toEqual({ min: "630", max: "1170" });
  });
});

test.describe("recoveryBand", () => {
  test("keeps the band when live stock falls inside it", () => {
    // Listing 9's fixture case: AFN 70,000 -> 49,000-91,000, MacBook at 90,000.
    expect(recoveryBand(70000, "AFN", [90000])).toEqual({
      min: "49000",
      max: "91000",
    });
    // Inclusive at both edges.
    expect(recoveryBand(10000, "AFN", [7000])).toEqual({
      min: "7000",
      max: "13000",
    });
    expect(recoveryBand(10000, "AFN", [13000])).toEqual({
      min: "7000",
      max: "13000",
    });
  });

  test("drops the band when it would land on nothing", () => {
    const none = { min: "", max: "" };
    // Listing 7's fixture case: AFN 8,000 -> 5,600-10,400, only a 1,200 jacket.
    expect(recoveryBand(8000, "AFN", [1200])).toEqual(none);
    expect(recoveryBand(8000, "AFN", [])).toEqual(none);
    expect(recoveryBand(8000, "AFN", [10401, 5599])).toEqual(none);
    // Junk prices in the stock list can't fake a match.
    expect(recoveryBand(8000, "AFN", [null, undefined, Number.NaN])).toEqual(
      none,
    );
  });

  test("drops the band whenever priceBand itself would", () => {
    const none = { min: "", max: "" };
    expect(recoveryBand(900, "USD", [900])).toEqual(none);
    expect(recoveryBand(0, "AFN", [0])).toEqual(none);
    expect(recoveryBand(null, "AFN", [1000])).toEqual(none);
  });
});
