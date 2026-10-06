import { test, expect, type Page } from "@playwright/test";
import { BUYER_STATE } from "./auth-paths";
import { shopEntry, withSessionUser } from "./session-user";

/**
 * SHOP-3 the team on the web (hatiwal-mobile docs/SHOPS.md "Phase 3 — the
 * team", api shop-3-api as built). Same testids as mobile. The mock's shop 42
 * has the owner + one staff member and one pending link invite; invite tokens
 * mirror d8's QA seeds (qa-team-link / -expired / -used / -cancelled / -email).
 */

/** Make the buyer persona a member of shop 42 with this role. */
async function asMember(page: Page, role: "owner" | "staff") {
  await withSessionUser(page, { sellerMode: true, shops: [shopEntry(42, "Safi Cosmetics", "active", role)] });
  await page.route("**/api/me/shops/42", async (route) => {
    if (route.request().method() !== "GET") return route.continue();
    const res = await route.fetch();
    const json = await res.json();
    json.shop = { ...json.shop, role };
    await route.fulfill({ response: res, json });
  });
}

test.describe("Team (T1, T7)", () => {
  test.use({ storageState: BUYER_STATE });

  test("the owner sees members with roles, the pending invite, and the ⋯ menus", async ({ page }) => {
    await asMember(page, "owner");
    await page.goto("/en/shops/42/team");
    await expect(page.getByTestId("shop-team")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Team · Safi Cosmetics" })).toBeVisible();
    await expect(page.getByTestId("team-member-role-2")).toHaveText("Owner");
    await expect(page.getByTestId("team-member-role-7")).toHaveText("Staff");
    await expect(page.getByTestId("team-member-menu-7")).toBeVisible();
    await expect(page.getByTestId("team-member-menu-2")).toHaveCount(0);
    await expect(page.getByTestId("team-invite-row-31")).toContainText("Staff");
    await expect(page.getByTestId("team-leave")).toHaveCount(0);
  });

  test("the owner removes a member after confirming", async ({ page }) => {
    await asMember(page, "owner");
    await page.goto("/en/shops/42/team");
    await page.getByTestId("team-member-menu-7").click();
    await page.getByTestId("member-remove").click();
    const del = page.waitForRequest((r) => r.url().includes("/api/me/shops/42/members/7") && r.method() === "DELETE");
    await page.getByRole("button", { name: "Remove from shop" }).click();
    await del;
  });

  test("staff get a read-only list and Leave shop", async ({ page }) => {
    await asMember(page, "staff");
    await page.goto("/en/shops/42/team");
    await expect(page.getByTestId("team-member-role-7")).toBeVisible();
    await expect(page.getByTestId("team-invite")).toHaveCount(0);
    await expect(page.getByTestId("team-member-menu-7")).toHaveCount(0);
    await expect(page.getByTestId("team-leave")).toBeVisible();
  });

  test("the shop page shows Team to members, and Edit only to the owner", async ({ page }) => {
    await asMember(page, "staff");
    await page.goto("/en/shops/42");
    await expect(page.getByTestId("shop-page-team")).toBeVisible();
    await expect(page.getByTestId("shop-page-edit")).toHaveCount(0);
    await expect(page.getByTestId("shop-verify-start")).toHaveCount(0);
  });

  test("My shops shows the role chip", async ({ page }) => {
    await asMember(page, "staff");
    await page.goto("/en/profile");
    await expect(page.getByTestId("profile-my-shop-role-staff")).toHaveText("Staff");
  });
});

test.describe("Invite (T2, T3)", () => {
  test.use({ storageState: BUYER_STATE });

  test("by link → Invitation sent with the link; by email → sent to that address", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await asMember(page, "owner");
    await page.goto("/en/shops/42/team");
    await page.getByTestId("team-invite").click();
    await page.getByTestId("invite-share-link").click();
    await expect(page.getByTestId("invite-sent")).toBeVisible();
    await expect(page.getByTestId("invite-url")).toContainText("https://hatiwal.com/join/qa-team-new");
    await page.getByTestId("invite-another").click();
    await page.getByTestId("invite-by-contact").click();
    await page.getByTestId("invite-contact-input").fill("ali@example.com");
    const post = page.waitForRequest((r) => r.url().includes("/api/me/shops/42/invites") && r.method() === "POST");
    await page.getByTestId("invite-send").click();
    expect((await post).postDataJSON()).toEqual({ email: "ali@example.com" });
    await expect(page.getByTestId("invite-sent")).toContainText("ali@example.com");
  });

  test("a refused invite says why, in the reader's language", async ({ page }) => {
    await asMember(page, "owner");
    await page.goto("/ps/shops/42/team");
    await page.getByTestId("team-invite").click();
    await page.getByTestId("invite-by-contact").click();
    await page.getByTestId("invite-contact-input").fill("self@hatiwal.test");
    await page.getByTestId("invite-send").click();
    await expect(page.getByText("تاسو ځان نشئ رابللی")).toBeVisible();
  });
});

test.describe("Join (T4, T5, T6)", () => {
  test("a guest sees the shop and Sign up to join (the token travels to sign-up)", async ({ page }) => {
    await page.goto("/en/join/qa-team-link");
    await expect(page.getByTestId("join-screen")).toBeVisible();
    await expect(page.getByTestId("join-invited-by")).toHaveText("Safi Cosmetics invites you to join as Staff");
    await expect(page.getByTestId("join-accept")).toHaveCount(0);
    await expect(page.getByTestId("join-signup")).toHaveAttribute("href", "/en/signup?invite=qa-team-link");
    await expect(page.getByTestId("join-login")).toHaveAttribute("href", /\/en\/login\?next=%2Fjoin%2Fqa-team-link/);
  });

  test.describe("signed in", () => {
    test.use({ storageState: BUYER_STATE });

    test("Join → You're in → Start selling", async ({ page }) => {
      await page.goto("/en/join/qa-team-link");
      await page.getByTestId("join-accept").click();
      await expect(page.getByTestId("join-done")).toContainText("You're in Safi Cosmetics");
    });

    for (const [token, code] of [
      ["qa-team-expired", "invite_expired"],
      ["qa-team-used", "invite_used"],
      ["qa-team-cancelled", "invite_cancelled"],
      ["no-such-token", "invite_expired"],
    ] as const) {
      test(`${token} → its own page (${code})`, async ({ page }) => {
        await page.goto(`/en/join/${token}`);
        await expect(page.getByTestId(`join-error-${code}`)).toBeVisible();
      });
    }

    test("an email invite for another account → its own page, not a toast", async ({ page }) => {
      await page.goto("/en/join/qa-team-email");
      await page.getByTestId("join-accept").click();
      await expect(page.getByTestId("join-error-invite_wrong_account")).toBeVisible();
    });

    test("someone already in the shop is told so, in Pashto too", async ({ page }) => {
      await withSessionUser(page, { shops: [shopEntry(42, "Safi Cosmetics", "active", "staff")] });
      await page.goto("/ps/join/qa-team-link");
      await expect(page.getByTestId("join-error-already_member")).toContainText("تاسو مخکې په دې دوکان کې یاست");
    });
  });
});

test.describe("d8 review: the fixes, each reproduced", () => {
  test("HIGH: a failed load (5xx / offline) offers a retry, never the 'expired' page", async ({ page }) => {
    let fail = true;
    await page.route("**/api/proxy/shop_invites/qa-team-link", (route) =>
      fail ? route.fulfill({ status: 503, json: { errors: ["Upstream request failed"] } }) : route.continue(),
    );
    await page.goto("/en/join/qa-team-link");
    await expect(page.getByTestId("join-load-error")).toBeVisible();
    await expect(page.getByTestId("join-error-invite_expired")).toHaveCount(0);
    fail = false;
    await page.getByTestId("join-retry").click();
    await expect(page.getByTestId("join-screen")).toBeVisible();
  });

  test("a guest signs up from the invite and lands back on it, signed in (invite_token sent)", async ({ page }) => {
    await page.goto("/en/join/qa-team-link");
    await page.getByTestId("join-signup").click();
    await expect(page).toHaveURL(/\/en\/signup\?invite=qa-team-link$/);
    // Switching to log-in keeps the invite.
    // The form footer's Login link (the header has one too).
    await expect(page.getByRole("link", { name: "Login" }).last()).toHaveAttribute("href", /next=%2Fjoin%2Fqa-team-link/);
    await page.locator("#firstname").fill("Nawid");
    await page.locator("#lastname").fill("Newbie");
    await page.locator("#email").fill("newbie@hatiwal.test");
    await page.locator("#password").fill("Password123!");
    await page.locator("#passwordConfirmation").fill("Password123!");
    const signup = page.waitForRequest((r) => r.url().includes("/api/auth/register") && r.method() === "POST");
    await page.locator("form button[type=submit]").click();
    expect((await signup).postDataJSON()).toMatchObject({ inviteToken: "qa-team-link" });
    await expect(page).toHaveURL(/\/en\/join\/qa-team-link$/);
    await expect(page.getByTestId("join-accept")).toBeVisible();
  });

  test.describe("signed in", () => {
    test.use({ storageState: BUYER_STATE });

    test("an email invite whose address isn't confirmed says so (invite_email_unconfirmed)", async ({ page }) => {
      await page.goto("/en/join/qa-team-unconfirmed");
      await page.getByTestId("join-accept").click();
      await expect(page.getByTestId("join-error-invite_email_unconfirmed")).toContainText("Confirm your email first");
    });

    test("staff opening the shop's edit / verify pages by URL are told it's the owner's", async ({ page }) => {
      await asMember(page, "staff");
      await page.goto("/en/shops/42/edit");
      await expect(page.getByTestId("owner-only")).toContainText("Only the shop's owner can do that");
      await page.goto("/en/shops/42/verify");
      await expect(page.getByTestId("owner-only")).toBeVisible();
    });

    test("cancelling an invite asks first, and calls DELETE only after confirming", async ({ page }) => {
      await asMember(page, "owner");
      await page.goto("/en/shops/42/team");
      let deleted = false;
      page.on("request", (r) => {
        if (r.url().includes("/api/me/shops/42/invites/31") && r.method() === "DELETE") deleted = true;
      });
      await page.getByTestId("team-invite-menu-31").click();
      await page.getByTestId("invite-cancel").click();
      await expect(page.getByRole("heading", { name: "Cancel this invite?" })).toBeVisible();
      expect(deleted).toBe(false);
      await page.getByRole("button", { name: "Cancel invite" }).click();
      await expect.poll(() => deleted).toBe(true);
    });

    test("a LINK invite offers Share again, never Resend (link_invite)", async ({ page }) => {
      await asMember(page, "owner");
      await page.goto("/en/shops/42/team");
      await page.getByTestId("team-invite-menu-31").click();
      await expect(page.getByTestId("invite-share")).toBeVisible();
      await expect(page.getByTestId("invite-resend")).toHaveCount(0);
    });

    test("a full team / too many invites are refused in words", async ({ page }) => {
      await asMember(page, "owner");
      await page.goto("/en/shops/42/team");
      await page.getByTestId("team-invite").click();
      await page.getByTestId("invite-by-contact").click();
      await page.getByTestId("invite-contact-input").fill("full@hatiwal.test");
      await page.getByTestId("invite-send").click();
      await expect(page.getByText("The team is full (20 people)")).toBeVisible();
      await page.getByTestId("invite-contact-input").fill("many@hatiwal.test");
      await page.getByTestId("invite-send").click();
      await expect(page.getByText("Too many invites today. Try again tomorrow.")).toBeVisible();
    });

    test("a member removed while the Team page is open sees the not-member page", async ({ page }) => {
      await withSessionUser(page, { sellerMode: true, shops: [shopEntry(43, "Old Shop", "active", "staff")] });
      await page.goto("/en/shops/43/team");
      await expect(page.getByTestId("team-not-member")).toBeVisible();
    });
  });
});

