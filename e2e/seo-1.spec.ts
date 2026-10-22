import { test, expect, type APIRequestContext } from "@playwright/test";
import { APP_STORE_URL, GOOGLE_PLAY_URL } from "../src/lib/app-links";

/**
 * seo-1 (docs/SEO.md, "seo-1"): permanent locale redirects, canonical/noindex
 * rules for Bazaar search URLs, real 404s, noindex on sold listings and empty
 * profiles, MobileApplication JSON-LD, and the guide + city pages in en/ps/fa.
 * Read from the raw server HTML, as a crawler sees it.
 */
async function head(request: APIRequestContext, path: string, headers: Record<string, string> = {}) {
  const res = await request.get(path, { maxRedirects: 0, headers });
  const html = await res.text();
  const attr = (re: RegExp) => html.match(re)?.[1] ?? null;
  const ld = [...html.matchAll(/<script type="application\/ld\+json">([^<]*)<\/script>/g)].flatMap((m) => {
    const d = JSON.parse(m[1]);
    return Array.isArray(d) ? d : [d];
  });
  const hreflang = Object.fromEntries(
    [...html.matchAll(/<link rel="alternate" hrefLang="([^"]+)" href="([^"]+)"/gi)].map((m) => [m[1], m[2]]),
  );
  return {
    res,
    html,
    status: res.status(),
    location: res.headers()["location"] ?? null,
    title: attr(/<title>([^<]*)<\/title>/),
    description: attr(/<meta name="description" content="([^"]*)"/),
    canonical: attr(/<link rel="canonical" href="([^"]*)"/),
    robots: attr(/<meta name="robots" content="([^"]*)"/),
    dir: attr(/<html[^>]* dir="([^"]+)"/),
    lang: attr(/<html[^>]* lang="([^"]+)"/),
    hreflang,
    ld,
  };
}

test.describe("seo-1: locale-less URLs redirect permanently", () => {
  test("/ → /en with 308, not cached by the browser", async ({ request }) => {
    const h = await head(request, "/");
    expect(h.status).toBe(308);
    expect(h.location).toMatch(/\/en$/);
    expect(h.res.headers()["cache-control"]).toBe("no-store");
    expect(h.res.headers()["vary"]).toContain("Accept-Language");
  });

  test("locale detection still works: Accept-Language ps → /ps, NEXT_LOCALE=fa → /fa", async ({ request }) => {
    expect((await head(request, "/", { "accept-language": "ps-AF,ps;q=0.9" })).location).toMatch(/\/ps$/);
    const fa = await head(request, "/", { cookie: "NEXT_LOCALE=fa" });
    expect(fa.status).toBe(308);
    expect(fa.location).toMatch(/\/fa$/);
  });

  test("deeper locale-less paths keep their path and query", async ({ request }) => {
    const b = await head(request, "/bazaar?q=phone");
    expect(b.status).toBe(308);
    expect(b.location).toMatch(/\/en\/bazaar\?q=phone$/);
    const l = await head(request, "/listings/3");
    expect(l.status).toBe(308);
    expect(l.location).toMatch(/\/en\/listings\/3$/);
  });
});

test.describe("seo-1: Bazaar search URLs", () => {
  test("re-ordering, paging and tracking params keep the clean canonical", async ({ request }) => {
    const h = await head(request, "/en/bazaar?sort=price_asc&page=3&utm_source=tiktok");
    expect(h.status).toBe(200);
    expect(h.canonical).toMatch(/\/en\/bazaar$/);
    expect(h.robots).toBeNull();
    expect(h.hreflang["x-default"]).toMatch(/\/en\/bazaar$/);
  });

  for (const qs of ["q=phone", "category=electronics", "condition=good&sort=newest", "lat=34.5&lng=69.2&radius=25", "shops=1"]) {
    test(`?${qs} is noindex, follow with no canonical and no hreflang`, async ({ request }) => {
      const h = await head(request, `/en/bazaar?${qs}`);
      expect(h.status).toBe(200);
      expect(h.robots).toBe("noindex, follow");
      expect(h.canonical).toBeNull();
      expect(h.hreflang).toEqual({});
    });
  }

  test("a category page ignores its params, so it canonicals to itself", async ({ request }) => {
    const h = await head(request, "/en/categories/electronics?sort=newest&page=2");
    expect(h.canonical).toMatch(/\/en\/categories\/electronics$/);
    expect(h.robots).toBeNull();
  });
});

test.describe("seo-1: real 404s, never a 200 'not found'", () => {
  // Next 15 sends a 404 as its error shell (`<html id="__next_error__">`) and
  // renders the not-found UI from the flight data on the client: true on
  // production before seo-1 as well. The status is what Google acts on; the
  // visible page is checked in a browser.
  const cases: [string, string][] = [
    ["/en/listings/999999", "listing-unavailable"],
    ["/ps/sellers/999999", "seller-unavailable"],
    ["/fa/shops/999999", "shop-unavailable"],
  ];
  for (const [path, testId] of cases) {
    test(`${path} answers 404 and offers the Bazaar and the categories`, async ({ request, page }) => {
      expect((await head(request, path)).status).toBe(404);
      await page.goto(path);
      const box = page.getByTestId(testId);
      const locale = path.split("/")[1];
      await expect(box.locator(`a[href="/${locale}/bazaar"]`)).toBeVisible();
      await expect(box.locator(`a[href="/${locale}/categories"]`)).toBeVisible();
    });
  }

  for (const path of ["/en/no-such-page", "/en/cities/london", "/ps/cities/toString"]) {
    test(`${path} answers 404 with links to the Bazaar and the categories`, async ({ request, page }) => {
      expect((await head(request, path)).status).toBe(404);
      await page.goto(path);
      const locale = path.split("/")[1];
      const main = page.locator("main");
      await expect(main.locator(`a[href="/${locale}/bazaar"]`).first()).toBeVisible();
      await expect(main.locator(`a[href="/${locale}/categories"]`).first()).toBeVisible();
    });
  }
});

test.describe("seo-1: what leaves the index", () => {
  test("a sold listing stays reachable (200) but is noindex", async ({ request }) => {
    const h = await head(request, "/en/listings/7");
    expect(h.status).toBe(200);
    expect(h.robots).toBe("noindex, follow");
  });

  test("a live or reserved listing stays indexable", async ({ request }) => {
    for (const id of [3, 6]) {
      const h = await head(request, `/en/listings/${id}`);
      expect(h.status, String(id)).toBe(200);
      expect(h.robots, String(id)).toBeNull();
    }
  });

  test("a profile with no listings and no reviews is noindex; one with listings is not", async ({ request }) => {
    const empty = await head(request, "/en/sellers/3");
    expect(empty.status).toBe(200);
    expect(empty.robots).toBe("noindex, follow");
    const stocked = await head(request, "/en/sellers/1");
    expect(stocked.robots).toBeNull();
  });
});

test.describe("seo-1: MobileApplication JSON-LD", () => {
  for (const path of ["/en", "/ps", "/fa/download"]) {
    test(`${path} declares the app (free, iOS + Android, both stores, no rating)`, async ({ request }) => {
      const { ld } = await head(request, path);
      const app = ld.find((d) => d["@type"] === "MobileApplication");
      expect(app).toBeTruthy();
      expect(app.name).toBe("Hatiwal");
      expect(app.operatingSystem).toBe("Android, iOS");
      expect(app.applicationCategory).toBe("ShoppingApplication");
      expect(app.offers).toEqual({ "@type": "Offer", price: 0, priceCurrency: "USD" });
      expect(app.downloadUrl).toEqual([GOOGLE_PLAY_URL, APP_STORE_URL]);
      expect(app.inLanguage).toEqual(["en", "ps", "fa"]);
      expect(app.aggregateRating).toBeUndefined();
      expect(app.description.length).toBeGreaterThan(20);
    });
  }

  test("the home page keeps its Organization + WebSite next to it", async ({ request }) => {
    const types = (await head(request, "/en")).ld.map((d) => d["@type"]);
    expect(types).toEqual(["Organization", "WebSite", "MobileApplication"]);
  });
});

test.describe("seo-1: guide and city pages in three languages", () => {
  const pages = ["/how-to-sell", "/buy-safely", "/cities/kabul", "/cities/mazar-i-sharif"];
  const brand = { en: "Hatiwal", ps: "هټیوال", fa: "هتیوال" } as const;

  for (const locale of ["en", "ps", "fa"] as const) {
    for (const path of pages) {
      test(`/${locale}${path}: 200, indexable, self-canonical, hreflang set, ${locale === "en" ? "ltr" : "rtl"}`, async ({ request }) => {
        const h = await head(request, `/${locale}${path}`);
        expect(h.status).toBe(200);
        expect(h.robots).toBeNull();
        expect(h.canonical).toMatch(new RegExp(`/${locale}${path}$`));
        expect(Object.keys(h.hreflang).sort()).toEqual(["en", "fa", "ps", "x-default"]);
        expect(h.hreflang["x-default"]).toMatch(new RegExp(`/en${path}$`));
        expect(h.lang).toBe(locale);
        expect(h.dir).toBe(locale === "en" ? "ltr" : "rtl");
        expect(h.title).toBeTruthy();
        expect(h.description?.length ?? 0).toBeGreaterThan(50);
        expect(h.html).toMatch(/<h1[^>]*>/);
        if (!path.startsWith("/cities")) expect(h.html).toContain(brand[locale]);
      });
    }
  }

  test("Pashto pages spell the brand with ټ and Dari pages with ت", async ({ request }) => {
    const ps = (await head(request, "/ps/how-to-sell")).html;
    const fa = (await head(request, "/fa/how-to-sell")).html;
    expect(ps).toContain("هټیوال");
    expect(ps).not.toContain("هتیوال");
    expect(fa).toContain("هتیوال");
    expect(fa).not.toContain("هټیوال");
  });

  test("the sell guide states the limits the product enforces", async ({ request }) => {
    const { html } = await head(request, "/en/how-to-sell");
    expect(html).toContain("Add up to 8 photos");
    expect(html).toContain("up to 60 seconds");
    expect(html).toContain("up to 5 photos and one video");
    expect(html).toContain("no online payment and no delivery");
  });

  test("a city page links to the Bazaar zone filter, the sell guide and the other cities", async ({ request }) => {
    const { html } = await head(request, "/en/cities/kabul");
    expect(html).toContain('href="/en/bazaar?lat=34.5553&amp;lng=69.2075&amp;radius=25"');
    expect(html).toContain('href="/en/how-to-sell"');
    expect(html).toContain('href="/en/cities/herat"');
    expect(html).toContain("Buy and sell in Kabul");
  });

  test("every new page is in the sitemap, in all three languages", async ({ request }) => {
    const xml = await (await request.get("/sitemap.xml")).text();
    for (const locale of ["en", "ps", "fa"]) {
      for (const path of ["/how-to-sell", "/buy-safely", "/cities/kabul", "/cities/herat", "/cities/kandahar", "/cities/mazar-i-sharif", "/cities/jalalabad"]) {
        expect(xml, `${locale}${path}`).toContain(`/${locale}${path}</loc>`);
      }
    }
  });

  test("the footer links the guides and cities on every page", async ({ request }) => {
    const { html } = await head(request, "/fa/privacy");
    for (const path of ["/how-to-sell", "/buy-safely", "/cities/kabul", "/cities/jalalabad"]) {
      expect(html).toContain(`href="/fa${path}"`);
    }
  });
});

test.describe("seo-1: the new pages render in a browser, RTL included", () => {
  for (const locale of ["en", "ps", "fa"] as const) {
    test(`/${locale}/how-to-sell and /${locale}/cities/herat at phone width`, async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(`/${locale}/how-to-sell`);
      await expect(page.locator("html")).toHaveAttribute("dir", locale === "en" ? "ltr" : "rtl");
      await expect(page.getByTestId("guide-how-to-sell").locator("h1")).toBeVisible();
      await expect(page.getByTestId("guide-how-to-sell").locator("ol > li")).toHaveCount(10);
      // No sideways scroll on a phone.
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

      await page.goto(`/${locale}/cities/herat`);
      await expect(page.getByTestId("city-page").locator("h1")).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    });
  }

  test("/ps/buy-safely shows the meeting checklist and the report section", async ({ page }) => {
    await page.goto("/ps/buy-safely");
    await expect(page.locator("#meet li")).toHaveCount(5);
    await expect(page.locator("#report h2")).toBeVisible();
  });
});
