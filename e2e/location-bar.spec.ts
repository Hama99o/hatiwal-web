import { test, expect } from "@playwright/test";
import { BUYER_STATE, EMPTY_STATE } from "./auth-paths";

// LOC-1 — "Showing items near … · Change" on the Bazaar
// (hatiwal-mobile/docs/USER_LOCATION.md). Same test ids as the mobile app.
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
