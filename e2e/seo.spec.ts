import { test, expect, type APIRequestContext } from "@playwright/test";
import { APP_STORE_URL, GOOGLE_PLAY_URL } from "../src/lib/app-links";

/**
 * Search-engine head tags (docs/SEO.md). Read from the raw server HTML, the
 * way a crawler sees it — no browser, no client JS.
 */
async function head(request: APIRequestContext, path: string) {
  const res = await request.get(path, { maxRedirects: 0 });
  const html = await res.text();
  const attr = (re: RegExp) => html.match(re)?.[1] ?? null;
  const ld = [...html.matchAll(/<script type="application\/ld\+json">([^<]*)<\/script>/g)].flatMap(
    (m) => {
      const d = JSON.parse(m[1]);
      return Array.isArray(d) ? d : [d];
    },
  );
  return {
    status: res.status(),
    title: attr(/<title>([^<]*)<\/title>/),
    canonical: attr(/<link rel="canonical" href="([^"]*)"/),
    robots: attr(/<meta name="robots" content="([^"]*)"/),
    ogTitle: attr(/<meta property="og:title" content="([^"]*)"/),
    twitterTitle: attr(/<meta name="twitter:title" content="([^"]*)"/),
    ld,
  };
}

test.describe("SEO: the home page names the brand in every language", () => {
  const titles = {
    en: "Hatiwal — Buy and sell locally in Afghanistan",
    ps: "هټیوال (Hatiwal) — په افغانستان کې محلي پیر او پلور وکړئ",
    fa: "هتیوال (Hatiwal) — خرید و فروش محلی در افغانستان",
  } as const;

  for (const [locale, title] of Object.entries(titles)) {
    test(`/${locale} title, og, twitter, canonical`, async ({ request }) => {
      const h = await head(request, `/${locale}`);
      expect(h.status).toBe(200);
      expect(h.title).toBe(title);
      expect(h.ogTitle).toBe(title);
      expect(h.twitterTitle).toBe(title);
      expect(h.canonical).toMatch(new RegExp(`/${locale}$`));
      expect(h.robots).toBeNull();
    });
  }

  test("Organization + WebSite JSON-LD with both native spellings and the store links", async ({ request }) => {
    const { ld } = await head(request, "/ps");
    const org = ld.find((d) => d["@type"] === "Organization");
    const site = ld.find((d) => d["@type"] === "WebSite");
    expect(org.name).toBe("Hatiwal");
    expect(org.alternateName).toEqual(["هټیوال", "هتیوال"]);
    expect(org.logo).toMatch(/\/icon-512\.png$/);
    expect(org.sameAs).toEqual([GOOGLE_PLAY_URL, APP_STORE_URL]);
    expect(site.potentialAction.target.urlTemplate).toMatch(/\/ps\/bazaar\?q=\{search_term_string\}$/);
  });
});

test.describe("SEO: no page borrows the home page's canonical", () => {
  for (const path of ["/en/login", "/en/signup", "/en/saved", "/en/profile", "/en/conversations", "/en/listings/new"]) {
    test(`${path} is noindex and has no canonical`, async ({ request }) => {
      const h = await head(request, path);
      expect(h.robots).toContain("noindex");
      expect(h.canonical).toBeNull();
    });
  }

  test("a public page keeps its own canonical and stays indexable", async ({ request }) => {
    const h = await head(request, "/en/bazaar?q=phone&page=2");
    expect(h.canonical).toMatch(/\/en\/bazaar$/);
    expect(h.robots).toBeNull();
  });
});

test.describe("SEO: listing Product structured data", () => {
  test("a listing with a photo is a valid merchant listing (image, price, currency, url, condition)", async ({ request }) => {
    const { ld } = await head(request, "/en/listings/3");
    const product = ld.find((d) => d["@type"] === "Product");
    expect(product.image.length).toBeGreaterThan(0);
    expect(product.url).toMatch(/\/en\/listings\/3$/);
    expect(product.offers.price).toBe(600000);
    expect(product.offers.priceCurrency).toBe("AFN");
    expect(product.offers.availability).toBe("https://schema.org/InStock");
    expect(product.offers.itemCondition).toBe("https://schema.org/UsedCondition");
  });

  test("declares honestly: no shipping (local meetup) and no returns", async ({ request }) => {
    const { ld } = await head(request, "/en/listings/3");
    const offer = ld.find((d) => d["@type"] === "Product").offers;
    expect(offer.shippingDetails).toEqual({
      "@type": "OfferShippingDetails",
      doesNotShip: true,
      shippingDestination: { "@type": "DefinedRegion", addressCountry: "AF" },
    });
    expect(offer.hasMerchantReturnPolicy).toEqual({
      "@type": "MerchantReturnPolicy",
      applicableCountry: "AF",
      returnPolicyCategory: "https://schema.org/MerchantReturnNotPermitted",
    });
  });

  test("a listing without a photo emits no Product (Google requires an image)", async ({ request }) => {
    const h = await head(request, "/en/listings/1");
    expect(h.status).toBe(200);
    expect(h.ld.find((d) => d["@type"] === "Product")).toBeUndefined();
  });
});

test.describe("SEO: empty categories (soft 404)", () => {
  test("an empty category is noindex and left out of the sitemap; a stocked one is neither", async ({ request }) => {
    expect((await head(request, "/en/categories/home-garden")).robots).toContain("noindex");
    expect((await head(request, "/en/categories/electronics")).robots).toBeNull();
    const xml = await (await request.get("/sitemap.xml")).text();
    expect(xml).not.toContain("/categories/home-garden<");
    expect(xml).toContain("/en/categories/electronics</loc>");
  });
});

test.describe("SEO: legacy aliases redirect permanently", () => {
  test("/users/:id and /browse answer 308", async ({ request }) => {
    for (const path of ["/en/users/1", "/en/browse?q=x"]) {
      const res = await request.get(path, { maxRedirects: 0 });
      expect(res.status(), path).toBe(308);
    }
  });
});

test.describe("SEO: hidden Urdu and the sitemap", () => {
  test("/ur/* answers a permanent redirect to the same /en page", async ({ request }) => {
    const res = await request.get("/ur/categories/mens-clothing?sort=newest", { maxRedirects: 0 });
    expect(res.status()).toBe(301);
    expect(res.headers()["location"]).toMatch(/\/en\/categories\/mens-clothing\?sort=newest$/);
  });

  test("the sitemap lists en/ps/fa with hreflang alternates and no Urdu", async ({ request }) => {
    const xml = await (await request.get("/sitemap.xml")).text();
    expect(xml).toContain("/en/bazaar</loc>");
    expect(xml).toMatch(/hreflang="ps"/);
    expect(xml).toMatch(/hreflang="x-default"/);
    expect(xml).not.toMatch(/\/ur[/<"]/);
    expect(xml).not.toMatch(/hreflang="ur"/);
  });
});
