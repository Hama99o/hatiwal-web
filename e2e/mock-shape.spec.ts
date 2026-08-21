import { test, expect, type APIRequestContext } from "@playwright/test";
import {
  CATEGORY_REF_KEYS,
  DETAILED_SELLER_KEYS,
  DETAILED_VIEW_KEYS,
  LIST_SELLER_KEYS,
  LIST_VIEW_KEYS,
  OWNER_DETAILED_VIEW_KEYS,
  SELLER_LIST_VIEW_KEYS,
} from "./mock-api/serializer-view-keys";

/**
 * THE STANDING GUARD on the E2E fixture's payload shape (TASK-WEB-MOCKSHAPE).
 *
 * Every other spec in this folder trusts `e2e/mock-api/server.mjs` to answer
 * like Rails. When it does not, a green suite means nothing: a field the mock
 * invents lets a spec prove behaviour the real API cannot produce (that is how
 * TASK-WEB-FEED250 shipped against an unmeetable acceptance criterion), and a
 * field the mock omits leaves real UI permanently unreachable in E2E.
 *
 * So this spec asserts the fixture against the committed snapshot of the real
 * serializer views (`e2e/mock-api/serializer-view-keys.ts`) — exact key sets,
 * both directions, on EVERY surface, plus the per-surface flag semantics that
 * decide which controller fills them.
 *
 * NO BROWSER. It talks straight to the mock API over HTTP, so it asserts what
 * goes on the wire rather than a function's return value, runs in about a
 * second, and cannot be broken by a hydration race.
 */

const MOCK_API = `http://localhost:${
  process.env.E2E_MOCK_API_PORT || 4010
}/api/v1`;

/** The devise headers the /api/me proxy attaches for the FULL persona — the
 *  mock resolves a caller's identity from `access-token` alone. */
const BUYER = {
  "access-token": "mock-access-token",
  client: "mock-client",
  uid: "buyer@hatiwal.test",
  "token-type": "Bearer",
};

type Row = Record<string, unknown>;

/** GET a mock endpoint and return its listing rows (index or show). */
async function rows(
  request: APIRequestContext,
  path: string,
  headers?: Record<string, string>,
): Promise<Row[]> {
  const res = await request.get(`${MOCK_API}${path}`, { headers });
  expect(res.status(), `GET ${path}`).toBe(200);
  const body = (await res.json()) as { listings?: Row[]; listing?: Row };
  const list = body.listings ?? (body.listing ? [body.listing] : []);
  // A surface that returns nothing would pass every key assertion below by
  // vacuum — the exact way a shape guard rots.
  expect(list.length, `GET ${path} returned no listing rows`).toBeGreaterThan(0);
  return list;
}

/** Exact set equality, reported against the surface that produced it. */
function expectKeys(row: Row, expected: readonly string[], where: string) {
  expect(Object.keys(row).sort(), where).toEqual([...expected].sort());
}

/** Every mock endpoint that renders Rails' `view :list`, and the controller
 *  each one mirrors. All of them must emit the SAME key set — the view is one
 *  shape; only the values change with the options the controller passes. */
const LIST_SURFACES: { path: string; headers?: Record<string, string> }[] = [
  { path: "/listings" }, // ListingsController#index, guest
  { path: "/listings", headers: BUYER }, // …and with a bearer (personalised)
  // ListingsController#similar. Listing 2 is the one with same-category stock
  // (Electronics rolls up Phones + Computers); listing 1 has none, and a surface
  // that returns nothing proves nothing — see `rows`.
  { path: "/listings/2/similar" },
  { path: "/my/saved_listings", headers: BUYER }, // My::SavedListingsController
  { path: "/my/hidden_listings", headers: BUYER }, // My::HiddenListingsController
  { path: "/users/1/sold_listings" }, // Users::SoldListingsController
];

/** Everything rendered through `view :owner_detailed`. */
const OWNER_DETAIL_SURFACES = ["/my/listings/1", "/my/listings/9"];

test.describe("Mock API payload shape (no browser)", () => {
  test("every :list surface emits exactly view :list", async ({ request }) => {
    for (const { path, headers } of LIST_SURFACES) {
      for (const row of await rows(request, path, headers)) {
        expectKeys(row, LIST_VIEW_KEYS, `${path} listing ${row.id} (:list)`);
      }
    }
  });

  test("/my/listings emits exactly view :seller_list", async ({ request }) => {
    const listings = await rows(request, "/my/listings", BUYER);
    // My Shop is the ONE seller_list surface, and it must cover every status —
    // the lifecycle timestamps and the expiry pair are the fields that differ.
    expect(listings.length).toBeGreaterThan(1);
    for (const row of listings) {
      expectKeys(
        row,
        SELLER_LIST_VIEW_KEYS,
        `/my/listings listing ${row.id} (:seller_list)`,
      );
    }
  });

  test("GET /listings/:id emits exactly view :detailed", async ({ request }) => {
    // Across lifecycle states: active, reserved, sold, draft, and expired.
    for (const id of [1, 4, 6, 7, 8, 10]) {
      const [row] = await rows(request, `/listings/${id}`);
      expectKeys(row, DETAILED_VIEW_KEYS, `/listings/${id} (:detailed)`);
    }
  });

  test("the /my/listings/:id family emits exactly view :owner_detailed", async ({
    request,
  }) => {
    for (const path of OWNER_DETAIL_SURFACES) {
      const [row] = await rows(request, path, BUYER);
      expectKeys(row, OWNER_DETAILED_VIEW_KEYS, `${path} (:owner_detailed)`);
    }
    // The write paths render the same view in Rails, so they are pinned too: a
    // create/update/lifecycle response the client re-reads must not be a third
    // shape (`manage-listing-view` renders straight from it).
    const created = await request.post(`${MOCK_API}/my/listings`, {
      headers: BUYER,
      data: { listing: { title: "New Listing" } },
    });
    expect(created.status()).toBe(200);
    expectKeys(
      (await created.json()).listing,
      OWNER_DETAILED_VIEW_KEYS,
      "POST /my/listings (:owner_detailed)",
    );
    const sold = await request.put(`${MOCK_API}/my/listings/9/sold`, {
      headers: BUYER,
      data: { buyer_id: 2, final_price: 65000 },
    });
    expect(sold.status()).toBe(200);
    expectKeys(
      (await sold.json()).listing,
      OWNER_DETAILED_VIEW_KEYS,
      "PUT /my/listings/9/sold (:owner_detailed)",
    );
  });

  test("the nested seller and category blocks match their views too", async ({
    request,
  }) => {
    // A feed row's seller is public identity ONLY. The response-rate, away-mode
    // and rating signals belong to the :detailed seller block — a fixture that
    // hands them to a card lets a spec assert trust UI on a surface that has
    // never had the data for it.
    for (const row of await rows(request, "/listings")) {
      expectKeys(
        row.seller as Row,
        LIST_SELLER_KEYS,
        `/listings listing ${row.id} seller (:list)`,
      );
      expectKeys(
        row.category as Row,
        CATEGORY_REF_KEYS,
        `/listings listing ${row.id} category`,
      );
    }
    for (const id of [1, 4]) {
      const [row] = await rows(request, `/listings/${id}`);
      expectKeys(
        row.seller as Row,
        DETAILED_SELLER_KEYS,
        `/listings/${id} seller (:detailed)`,
      );
      expectKeys(
        row.category as Row,
        CATEGORY_REF_KEYS,
        `/listings/${id} category`,
      );
    }
  });

  test("negotiable is on every :list row, and false on the firm-price one", async ({
    request,
  }) => {
    // The field the merged view used to swallow entirely, which is why the
    // "Firm price" badge — rendered by every ListingCard and by the detail page —
    // was unreachable in E2E. Listing 4 (Winter Jacket) is the firm-price row.
    const feed = await rows(request, "/listings");
    for (const row of feed) {
      expect(typeof row.negotiable, `listing ${row.id} negotiable`).toBe(
        "boolean",
      );
    }
    expect(feed.find((l) => l.id === 4)?.negotiable).toBe(false);
    expect(feed.find((l) => l.id === 1)?.negotiable).toBe(true);
    const [detail] = await rows(request, "/listings/4");
    expect(detail.negotiable).toBe(false);
  });

  test("the multi-quantity trio is on every row, and reports what is LEFT", async ({
    request,
  }) => {
    // Three BASE fields, so no view can omit them — the clients gate the "each"
    // price suffix and the stock pill on `multi_unit`, and a view that dropped it
    // would render a bare price for a 15-unit listing (spike §0c). Listing 14
    // (Phone Cases Wholesale) is the batch row: 15 total, 4 sold.
    const feed = await rows(request, "/listings");
    for (const row of feed) {
      expect(typeof row.quantity, `listing ${row.id} quantity`).toBe("number");
      expect(typeof row.multi_unit, `listing ${row.id} multi_unit`).toBe("boolean");
      expect(typeof row.available_units, `listing ${row.id} available_units`).toBe("number");
    }

    const batch = feed.find((l) => l.id === 14);
    expect(batch?.quantity).toBe(15);
    // NEVER the original count — a stale number is the feature's top risk.
    expect(batch?.available_units).toBe(11);
    expect(batch?.multi_unit).toBe(true);

    // Every other row is a plain single item, so the majority case stays covered.
    expect(feed.find((l) => l.id === 1)?.multi_unit).toBe(false);
    expect(feed.find((l) => l.id === 1)?.available_units).toBe(1);

    // And the detail view agrees with the feed about the same listing.
    const [detail] = await rows(request, "/listings/14");
    expect(detail.multi_unit).toBe(true);
    expect(detail.available_units).toBe(11);
  });

  test("the per-viewer flags follow the options each controller actually passes", async ({
    request,
  }) => {
    // Shape is only half of an oracle: `is_viewed`/`is_saved` are filled from
    // Sets that ONLY ListingsController#index and #similar pass, and from the
    // `saved_by_listing_id:` map that ONLY the Saved screen passes. Rails leaves
    // them false everywhere else — deliberately, and documented on each
    // controller — so the fixture must not be more generous than the API.
    const guest = await rows(request, "/listings");
    expect(guest.every((l) => l.is_viewed === false)).toBe(true);
    expect(guest.every((l) => l.is_saved === false)).toBe(true);
    expect(guest.every((l) => l.price_at_save === null)).toBe(true);
    expect(guest.every((l) => l.price_dropped === false)).toBe(true);

    const authed = await rows(request, "/listings", BUYER);
    expect(authed.find((l) => l.id === 1)?.is_viewed).toBe(true); // VIEWED_IDS
    expect(authed.find((l) => l.id === 4)?.is_saved).toBe(true); // SAVED_IDS
    expect(authed.find((l) => l.id === 5)?.is_saved).toBe(false);
    // The hidden row is filtered out of the personalised feed entirely.
    expect(authed.some((l) => l.id === 2)).toBe(false);

    // The Saved screen: every row saved by construction, and the only surface
    // that fills the price-at-save trio.
    const saved = await rows(request, "/my/saved_listings", BUYER);
    expect(saved.every((l) => l.is_saved === true)).toBe(true);
    const droppedRow = saved.find((l) => l.id === 2)!;
    expect(droppedRow.price_at_save).toBe(35000);
    expect(droppedRow.price_dropped).toBe(true);
    expect(droppedRow.price_drop_amount).toBe(5000);
    const flatRow = saved.find((l) => l.id === 4)!;
    expect(flatRow.price_dropped).toBe(false);
    expect(flatRow.price_drop_amount).toBeNull();

    // The dismissal list passes neither, so listing 2 reports is_saved false
    // there even though the buyer HAS saved it.
    const hidden = await rows(request, "/my/hidden_listings", BUYER);
    expect(hidden.find((l) => l.id === 2)?.is_saved).toBe(false);
  });
});
