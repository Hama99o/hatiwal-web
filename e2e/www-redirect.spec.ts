import { test, expect } from "@playwright/test";

/**
 * www.hatiwal.com → https://hatiwal.com, permanently (301), path + query kept
 * (middleware.ts). Production answered 307 → /en/join/x on www itself, so a
 * www link never reached the apex that Android App Links / the AASA name.
 * The host is sent as a header: the e2e server answers for any host.
 */
test("www.hatiwal.com redirects permanently to the apex, keeping the path and query", async ({ request }) => {
  const res = await request.get("/join/qa-team-link?utm=wa", { headers: { host: "www.hatiwal.com" }, maxRedirects: 0 });
  expect(res.status()).toBe(301);
  expect(res.headers()["location"]).toBe("https://hatiwal.com/join/qa-team-link?utm=wa");
});

test("a localized page on www keeps its locale on the way to the apex", async ({ request }) => {
  const res = await request.get("/ps/shops/42", { headers: { "x-forwarded-host": "www.hatiwal.com" }, maxRedirects: 0 });
  expect(res.status()).toBe(301);
  expect(res.headers()["location"]).toBe("https://hatiwal.com/ps/shops/42");
});

test("the apex itself is not redirected to itself", async ({ request }) => {
  const res = await request.get("/en/bazaar", { headers: { host: "hatiwal.com" }, maxRedirects: 0 });
  expect(res.status()).not.toBe(301);
});
