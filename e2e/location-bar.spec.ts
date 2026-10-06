import { test, expect, type Page, type Request } from "@playwright/test";
import { BUYER_STATE, EMPTY_STATE } from "./auth-paths";
import { withSessionUser } from "./session-user";

// LOC-1 — "Showing items near … · Change" on the Bazaar
// (hatiwal-mobile/docs/USER_LOCATION.md). Same test ids as the mobile app.
// Web = app parity: the same rule (own → guess → Kabul, read from me.location),
// the same sheet, the same clues, and the SAME feed params as mobile's
// browseLocationParams (default order = sort=nearest around home, no radius).

const HERAT = { latitude: 34.3529, longitude: 62.204 };
const listingRequests = (reqs: Request[]) => reqs.filter((r) => /\/listings(\?|$)/.test(r.url()) && r.method() === "GET");

/** Serve this viewer's `me` with another location block (the API resolves the rule; we only read it). */
async function meWithLocation(page: Page, location: Record<string, unknown>) {
  await withSessionUser(page, { location });
}

test.describe("Bazaar location bar — guest", () => {
  test("shows Kabul, in the default 'near you' order, and asks a guest to sign in on Change", async ({ page }) => {
    await page.goto("/en/bazaar");
    await expect(page.getByTestId("location-bar-place")).toHaveText("Kabul");
    await expect(page.locator("select").first()).toHaveValue("home");

    await page.getByTestId("location-change").click();
    await expect(page).toHaveURL(/\/en\/login/);
  });

  test("hides when another sort is chosen, and Newest is kept in the URL", async ({ page }) => {
    await page.goto("/en/bazaar");
    await expect(page.getByTestId("location-bar")).toBeVisible();
    await page.locator("select").first().selectOption("newest");
    await expect(page).toHaveURL(/sort=newest/);
    await expect(page.getByTestId("location-bar")).toHaveCount(0);
  });

  test("is right-to-left and translated in Pashto", async ({ page }) => {
    await page.goto("/ps/bazaar");
    await expect(page.getByTestId("location-bar-place")).toHaveText("کابل");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  });
});

test.describe("Bazaar location bar — signed in", () => {
  test.use({ storageState: BUYER_STATE });

  test("the Change sheet saves a province as the own address", async ({ page }) => {
    await page.goto("/en/bazaar");
    await expect(page.getByTestId("location-bar-place")).toHaveText("Kabul");
    await page.getByTestId("location-change").click();
    await expect(page.getByTestId("location-sheet")).toBeVisible();
    await expect(page.getByTestId("location-save")).toBeDisabled();

    const put = page.waitForRequest((r) => r.url().includes("/api/me/users/me") && r.method() === "PUT");
    await page.getByTestId("location-province-Herat").click();
    await page.getByTestId("location-save").click();
    const body = (await put).postDataJSON();
    expect(body.user).toMatchObject({ province: "Herat", latitude: null, longitude: null });

    await expect(page.getByTestId("location-sheet")).toHaveCount(0);
    await expect(page.getByTestId("location-bar-place")).toHaveText("Herat");
  });

  test("a zone read from a shared link is not sent as a location clue", async ({ page }) => {
    const clues: string[] = [];
    page.on("request", (r) => {
      if (r.url().includes("location_guess")) clues.push(r.url());
    });
    await page.goto("/en/bazaar?lat=34.3529&lng=62.204&radius=10");
    await expect(page.getByTestId("results-count")).toBeVisible();
    await page.waitForTimeout(2500); // past the clue's 1.5 s settle
    expect(clues).toEqual([]);
  });

  test("All Afghanistan: the bar names the country and the feed sends no point (LOC-1)", async ({ page }) => {
    await page.goto("/en/bazaar");
    await expect(page.getByTestId("location-bar-place")).toHaveText("Kabul");
    await page.getByTestId("location-change").click();
    const next = page.waitForRequest((r) => r.url().includes("/listings?") && r.method() === "GET");
    await page.getByTestId("location-all-afghanistan").click();
    const url = new URL((await next).url());
    expect(url.searchParams.has("latitude")).toBe(false);
    expect(url.searchParams.has("longitude")).toBe(false);
    expect(url.searchParams.get("sort")).toBeNull();
    await expect(page.getByTestId("location-bar-place")).toHaveText("All Afghanistan");

    // Remembered in this browser across a reload.
    await page.reload();
    await expect(page.getByTestId("location-bar-place")).toHaveText("All Afghanistan");

    // Choosing a province goes back to near it.
    await page.getByTestId("location-change").click();
    await page.getByTestId("location-province-Herat").click();
    await page.getByTestId("location-save").click();
    await expect(page.getByTestId("location-bar-place")).toHaveText("Herat");
  });

  test("never asks for location permission on its own", async ({ page, context }) => {
    await context.clearPermissions();
    let asked = false;
    await page.exposeFunction("__geoAsked", () => {
      asked = true;
    });
    await page.addInitScript(() => {
      const geo = navigator.geolocation;
      if (!geo) return;
      const orig = geo.getCurrentPosition.bind(geo);
      geo.getCurrentPosition = (...args: Parameters<Geolocation["getCurrentPosition"]>) => {
        (window as unknown as { __geoAsked: () => void }).__geoAsked();
        return orig(...args);
      };
    });
    await page.goto("/en/bazaar");
    await expect(page.getByTestId("location-bar")).toBeVisible();
    await page.waitForTimeout(500);
    expect(asked).toBe(false);
  });
});

test.describe("Bazaar location bar — signed in, nothing known", () => {
  test.use({ storageState: EMPTY_STATE });

  test("a user with no location sees Kabul", async ({ page }) => {
    await page.goto("/en/bazaar");
    await expect(page.getByTestId("location-bar-place")).toHaveText("Kabul");
  });
});

test.describe("Bazaar location bar — web = app parity", () => {
  test.use({ storageState: BUYER_STATE });

  test("a GUESS (no own address) drives the bar and the feed: sort=nearest around it, no radius", async ({ page }) => {
    await meWithLocation(page, { source: "guess", ...HERAT, province: "Herat" });
    const reqs: Request[] = [];
    page.on("request", (r) => reqs.push(r));
    await page.goto("/en/bazaar");
    await expect(page.getByTestId("location-bar-place")).toHaveText("Herat");
    await expect
      .poll(() => listingRequests(reqs).some((r) => new URL(r.url()).searchParams.get("latitude")?.startsWith("34.35")))
      .toBe(true);
    const url = new URL(listingRequests(reqs).filter((r) => new URL(r.url()).searchParams.get("latitude")?.startsWith("34.35")).at(-1)!.url());
    expect(url.searchParams.get("sort")).toBe("nearest");
    expect(url.searchParams.get("longitude")).toMatch(/^62\.2/);
    expect(url.searchParams.has("radius")).toBe(false);
  });

  test("a place outside Afghanistan/Pakistan/Iran in me.location falls back to Kabul", async ({ page }) => {
    await meWithLocation(page, { source: "guess", latitude: 25.2048, longitude: 55.2708, province: null }); // Dubai
    await page.goto("/en/bazaar");
    await expect(page.getByTestId("location-bar-place")).toHaveText("Kabul");
  });

  test("never names Kabul for a signed-in viewer before `me` answers", async ({ page }) => {
    await meWithLocation(page, { source: "own", ...HERAT, province: "Herat" });
    const seen: string[] = [];
    await page.exposeFunction("__place", (text: string) => seen.push(text));
    await page.addInitScript(() => {
      new MutationObserver(() => {
        const el = document.querySelector('[data-testid="location-bar-place"]');
        if (el?.textContent) (window as unknown as { __place: (t: string) => void }).__place(el.textContent);
      }).observe(document, { subtree: true, childList: true, characterData: true });
    });
    await page.goto("/en/bazaar");
    await expect(page.getByTestId("location-bar-place")).toHaveText("Herat");
    expect(seen).not.toContain("Kabul");
  });

  test("'Use my current location' asks only on the tap, and saves that place as the own address", async ({ page, context }) => {
    await context.grantPermissions(["geolocation"]);
    await context.setGeolocation(HERAT);
    await page.goto("/en/bazaar");
    await page.getByTestId("location-change").click();
    const put = page.waitForRequest((r) => r.url().includes("/api/me/users/me") && r.method() === "PUT");
    await page.getByTestId("location-use-current").click();
    await page.getByTestId("location-save").click();
    const body = (await put).postDataJSON();
    expect(body.user.province).toBe("Herat");
    expect(Number(body.user.latitude)).toBeCloseTo(HERAT.latitude, 2);
    await expect(page.getByTestId("location-bar-place")).toHaveText("Herat");
  });

  test("the GPS clue: sent once, only when location is ALREADY allowed, never for an own address", async ({ page, context }) => {
    await meWithLocation(page, { source: "default", latitude: 34.5553, longitude: 69.2075, province: "Kabul" });
    await context.grantPermissions(["geolocation"]);
    await context.setGeolocation(HERAT);
    const clue = page.waitForRequest((r) => r.url().includes("location_guess") && r.method() === "PATCH");
    await page.goto("/en/bazaar");
    expect((await clue).postDataJSON()).toMatchObject({ source: "gps", latitude: HERAT.latitude, longitude: HERAT.longitude });
  });

  test("the search_area clue: a zone the buyer PICKS is sent (once it settles)", async ({ page, context }) => {
    await meWithLocation(page, { source: "default", latitude: 34.5553, longitude: 69.2075, province: "Kabul" });
    await context.grantPermissions(["geolocation"]);
    await context.setGeolocation(HERAT);
    // The daily GPS clue already went today: only the picked zone can send one.
    await page.addInitScript(() => window.localStorage.setItem("loc1-gps-clue-at", String(Date.now())));
    await page.goto("/en/bazaar");
    const clue = page.waitForRequest(
      (r) => r.url().includes("location_guess") && r.method() === "PATCH" && r.postDataJSON()?.source === "search_area",
    );
    await page.getByRole("button", { name: "Use my location" }).first().click();
    await expect(page.getByTestId("location-bar")).toHaveCount(0); // a zone hides the bar
    expect((await clue).postDataJSON()).toMatchObject({ source: "search_area", latitude: HERAT.latitude });
  });

  test("an old /browse link keeps its filters on the way to /bazaar", async ({ page }) => {
    await page.goto("/en/browse?sort=newest");
    await expect(page).toHaveURL(/\/en\/bazaar\?sort=newest$/);
    await expect(page.getByTestId("location-bar")).toHaveCount(0);
  });
});
