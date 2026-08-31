import { test, expect } from "@playwright/test";
import { agreedOfferTerms } from "../src/lib/agreed-offer";
import type { Message } from "../src/lib/types";

/**
 * Unit specs for reading a thread's AGREED terms off its accepted offer — no
 * browser, no server (the module is deliberately pure, so it imports here by
 * relative path with nothing behind it). The browser-level behaviour lives in
 * `conversation-thread.spec.ts`; this file pins the walk and its edge cases.
 *
 * Why the walk matters: an acceptance carries only a label, so the terms have to
 * be read off the offer it answers. Getting this wrong is silent — mark-sold
 * falls back to one unit and a batch keeps two already-promised units on sale,
 * with nothing anywhere saying so.
 */

let nextId = 1;
function msg(over: Partial<Message> & Pick<Message, "kind">): Message {
  return {
    id: nextId++,
    body: "",
    readAt: null,
    createdAt: "2026-06-21T15:00:00Z",
    respondsToId: null,
    sender: { id: 2, name: "Sara Ahmadi" },
    ...over,
  };
}

test.beforeEach(() => {
  nextId = 1;
});

test.describe("agreedOfferTerms", () => {
  test("reads amount and quantity off the offer an acceptance answers", () => {
    const offer = msg({
      kind: "offer",
      body: "12000|AFN|14000",
      offerAmount: 12000,
      offerQuantity: 3,
    });
    const accept = msg({ kind: "offer_accepted", respondsToId: offer.id });

    expect(agreedOfferTerms([offer, accept])).toEqual({
      amount: 12000,
      quantity: 3,
    });
  });

  test("a quantity-less offer agrees a price but leaves quantity UNSPECIFIED", () => {
    // null is not 1. Every single-item listing and every offer predating the
    // field lands here, and a caller must be able to tell "they asked for one"
    // from "they never said" — the second must render no quantity UI.
    const offer = msg({ kind: "offer", body: "9000|AFN|9500", offerAmount: 9000 });
    const accept = msg({ kind: "offer_accepted", respondsToId: offer.id });

    expect(agreedOfferTerms([offer, accept])).toEqual({
      amount: 9000,
      quantity: null,
    });
  });

  test("falls back to the pipe-encoded body when offerAmount is absent", () => {
    // Pre-parsed fields arrived later than the encoding; a thread loaded from an
    // older payload must still prefill the price the two parties agreed.
    const offer = msg({ kind: "offer", body: "7500|AFN|8000" });
    const accept = msg({ kind: "offer_accepted", respondsToId: offer.id });

    expect(agreedOfferTerms([offer, accept])?.amount).toBe(7500);
  });

  test("the NEWEST acceptance wins when a thread renegotiates", () => {
    const first = msg({ kind: "offer", offerAmount: 12000, offerQuantity: 3 });
    const acceptFirst = msg({ kind: "offer_accepted", respondsToId: first.id });
    const second = msg({
      kind: "offer_counter",
      offerAmount: 11000,
      offerQuantity: 5,
    });
    const acceptSecond = msg({ kind: "offer_accepted", respondsToId: second.id });

    expect(
      agreedOfferTerms([first, acceptFirst, second, acceptSecond]),
    ).toEqual({ amount: 11000, quantity: 5 });
  });

  test("a counter-offer's own terms are readable, not just a plain offer's", () => {
    const counter = msg({
      kind: "offer_counter",
      offerAmount: 13000,
      offerQuantity: 2,
    });
    const accept = msg({ kind: "offer_accepted", respondsToId: counter.id });

    expect(agreedOfferTerms([counter, accept])).toEqual({
      amount: 13000,
      quantity: 2,
    });
  });

  test("nothing agreed → null, so a caller can tell that from a missing price", () => {
    expect(agreedOfferTerms([])).toBeNull();
    // An offer nobody accepted is not an agreement.
    expect(
      agreedOfferTerms([msg({ kind: "offer", offerAmount: 12000, offerQuantity: 3 })]),
    ).toBeNull();
    // A DECLINE is not an acceptance.
    const offer = msg({ kind: "offer", offerAmount: 12000, offerQuantity: 3 });
    expect(
      agreedOfferTerms([
        offer,
        msg({ kind: "offer_declined", respondsToId: offer.id }),
      ]),
    ).toBeNull();
  });

  test("ignores an acceptance whose target is missing, deleted, or not an offer", () => {
    // Target not in the loaded page (older message, not yet paged in).
    expect(
      agreedOfferTerms([msg({ kind: "offer_accepted", respondsToId: 999 })]),
    ).toBeNull();

    // A retracted offer's terms are blanked server-side, so there is nothing
    // honest to prefill from — better to ask than to use a tombstone's numbers.
    const deleted = msg({
      kind: "offer",
      offerAmount: 12000,
      offerQuantity: 3,
      deleted: true,
    });
    expect(
      agreedOfferTerms([
        deleted,
        msg({ kind: "offer_accepted", respondsToId: deleted.id }),
      ]),
    ).toBeNull();

    // Pointing at a plain text message is not an agreement about anything.
    const text = msg({ kind: "text", body: "sure" });
    expect(
      agreedOfferTerms([
        text,
        msg({ kind: "offer_accepted", respondsToId: text.id }),
      ]),
    ).toBeNull();
  });

  test("a deleted acceptance does not agree anything", () => {
    const offer = msg({ kind: "offer", offerAmount: 12000, offerQuantity: 3 });
    expect(
      agreedOfferTerms([
        offer,
        msg({ kind: "offer_accepted", respondsToId: offer.id, deleted: true }),
      ]),
    ).toBeNull();
  });

  test("a non-positive quantity is treated as unspecified, never as agreed", () => {
    const offer = msg({ kind: "offer", offerAmount: 12000, offerQuantity: 0 });
    const accept = msg({ kind: "offer_accepted", respondsToId: offer.id });
    expect(agreedOfferTerms([offer, accept])?.quantity).toBeNull();
  });
});
