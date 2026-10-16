import { test, expect, type Page } from "@playwright/test";
import { BUYER_STATE } from "./auth-paths";
import { patchJsonRoute, shopEntry, withSessionUser } from "./session-user";

/**
 * SHOP-3 the team on the web (hatiwal-mobile docs/SHOPS.md "Phase 3 — the
 * team", api shop-3-api as built). Same testids as mobile. The mock's shop 42
 * has the owner + one staff member and one pending link invite; invite tokens
 * mirror d8's QA seeds (qa-team-link / -expired / -used / -cancelled / -email).
 */

type Role = "owner" | "manager" | "staff";

/**
 * Make the buyer persona (id 1) a member of shop 42 with this role. Returns a
 * setter: the shop's GET then answers the NEW role (a transfer makes the
 * caller a Manager).
 */
async function asMember(page: Page, initial: Role) {
  let role: Role = initial;
  await withSessionUser(page, { sellerMode: true, shops: [shopEntry(42, "Safi Cosmetics", "active", initial)] });
  await patchJsonRoute(page, "**/api/me/shops/42", (json) => ({ ...json, shop: { ...json.shop, role } }));
  return (next: Role) => {
    role = next;
  };
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
    await page.getByRole("button", { name: "Copy link" }).click();
    await expect(page.getByText("Link copied")).toBeVisible();
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

    test("staff opening the shop's edit page by URL are told it's the owner's", async ({ page }) => {
      await asMember(page, "staff");
      await page.goto("/en/shops/42/edit");
      await expect(page.getByTestId("owner-only")).toContainText("Only the shop's owner can do that");
    });

    // Owner, 2026-10-08: staff have NO access to the shop's verification —
    // no card on the shop page, and the verify URL lands back on the shop.
    test("staff never see the verification: no card, and the verify URL goes back to the shop", async ({ page }) => {
      await asMember(page, "staff");
      await page.goto("/en/shops/42");
      await expect(page.getByTestId("shop-page")).toBeVisible({ timeout: 45_000 });
      await expect(page.getByTestId("shop-verify-card")).toHaveCount(0);
      await page.goto("/en/shops/42/verify");
      await expect(page).toHaveURL(/\/en\/shops\/42$/, { timeout: 30_000 });
      await expect(page.getByTestId("owner-only")).toHaveCount(0);
      await expect(page.getByTestId("verify-step-why")).toHaveCount(0);
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

/**
 * Brought into 1.1.6 (api 76ca115): the Manager role, change role, transfer
 * ownership, "replied by". The mock's shop 42: owner Umair (2), staff Ali (7),
 * manager Sara (8). The one matrix: hatiwal-mobile docs/SHOPS.md.
 */
test.describe("Manager, change role, transfer (1.1.6)", () => {
  test.use({ storageState: BUYER_STATE });

  test("the owner makes staff a manager, and a manager staff again", async ({ page }) => {
    await asMember(page, "owner");
    await page.goto("/en/shops/42/team");
    await expect(page.getByTestId("team-member-role-8")).toHaveText("Manager");

    await page.getByTestId("team-member-menu-7").click();
    await expect(page.getByTestId("member-make-staff")).toHaveCount(0);
    const promote = page.waitForRequest((r) => r.url().includes("/api/me/shops/42/members/7") && r.method() === "PATCH");
    await page.getByTestId("member-make-manager").click();
    expect((await promote).postDataJSON()).toEqual({ role: "manager" });
    await expect(page.getByText("Ali Ahmadi is now Manager")).toBeVisible();

    await page.getByTestId("team-member-menu-8").click();
    await expect(page.getByTestId("member-make-manager")).toHaveCount(0);
    const demote = page.waitForRequest((r) => r.url().includes("/api/me/shops/42/members/8") && r.method() === "PATCH");
    await page.getByTestId("member-make-staff").click();
    expect((await demote).postDataJSON()).toEqual({ role: "staff" });
    await expect(page.getByText("Sara Noori is now Staff")).toBeVisible();
  });

  test("a manager sees invites and removes staff, but can't touch a manager or transfer", async ({ page }) => {
    await asMember(page, "manager");
    await page.goto("/en/shops/42/team");
    await expect(page.getByTestId("team-invite")).toBeVisible();
    await expect(page.getByTestId("team-invite-row-31")).toBeVisible();
    await expect(page.getByTestId("team-member-menu-8")).toHaveCount(0); // another manager
    await expect(page.getByTestId("team-member-menu-2")).toHaveCount(0); // the owner
    await page.getByTestId("team-member-menu-7").click();
    await expect(page.getByTestId("member-remove")).toBeVisible();
    await expect(page.getByTestId("member-transfer")).toHaveCount(0);
    await expect(page.getByTestId("member-make-manager")).toHaveCount(0);
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("team-leave")).toBeVisible();
  });

  // Owner decision, 2026-10-08: a manager may apply too (their own e-Tazkira).
  test("a manager edits the shop and may apply for its Verified badge", async ({ page }) => {
    await asMember(page, "manager");
    await page.goto("/en/shops/42");
    await expect(page.getByTestId("shop-page-edit")).toBeVisible();
    await page.goto("/en/shops/42/edit");
    await expect(page.getByTestId("owner-only")).toHaveCount(0);
    await page.goto("/en/shops/42/verify");
    await expect(page).toHaveURL(/\/en\/shops\/42\/verify$/);
    await expect(page.getByTestId("owner-only")).toHaveCount(0);
  });

  test("transfer asks first; then the caller is a Manager (no more owner-only actions)", async ({ page }) => {
    const setRole = await asMember(page, "owner");
    await page.goto("/en/shops/42/team");
    await page.getByTestId("team-member-menu-8").click();
    await page.getByTestId("member-transfer").click();
    await expect(page.getByRole("heading", { name: "Make Sara Noori the owner?" })).toBeVisible();
    await expect(page.getByText("A Verified badge stays while you remain a Manager.")).toBeVisible(); // G4 (api f0d1179)
    setRole("manager");
    const post = page.waitForRequest((r) => r.url().includes("/api/me/shops/42/transfer") && r.method() === "POST");
    await page.getByRole("button", { name: "Make owner" }).click();
    expect((await post).postDataJSON()).toEqual({ user_id: 8 });
    await expect(page.getByText("Sara Noori is now the owner")).toBeVisible();
    // Now a Manager: no menu on a manager, and no Transfer on staff.
    await expect(page.getByTestId("team-member-menu-8")).toHaveCount(0);
    await page.getByTestId("team-member-menu-7").click();
    await expect(page.getByTestId("member-transfer")).toHaveCount(0);
    await expect(page.getByTestId("member-remove")).toBeVisible();
  });

  for (const [code, sentence] of [
    ["cannot_change_owner", "The owner's role can't be changed."],
    ["invalid_role", "That role doesn't exist."],
  ] as const) {
    test(`change role refused → ${code} in words`, async ({ page }) => {
      await asMember(page, "owner");
      await page.route("**/api/me/shops/42/members/7", (route) =>
        route.request().method() === "PATCH" ? route.fulfill({ status: 422, json: { error: "x", code } }) : route.continue(),
      );
      await page.goto("/en/shops/42/team");
      await page.getByTestId("team-member-menu-7").click();
      await page.getByTestId("member-make-manager").click();
      await expect(page.getByText(sentence)).toBeVisible();
    });
  }

  for (const [code, sentence] of [
    ["cannot_transfer_to_self", "You already own this shop."],
    ["verification_pending", "A Verified request is waiting. Cancel it first, then hand the shop over."],
  ] as const) {
    test(`transfer refused → ${code} in words`, async ({ page }) => {
      await asMember(page, "owner");
      await page.route("**/api/me/shops/42/transfer", (route) => route.fulfill({ status: 422, json: { error: "x", code } }));
      await page.goto("/en/shops/42/team");
      await page.getByTestId("team-member-menu-7").click();
      await page.getByTestId("member-transfer").click();
      await page.getByRole("button", { name: "Make owner" }).click();
      await expect(page.getByText(sentence)).toBeVisible();
    });
  }

  test("ps: the role menu reads in Pashto, right to left, in dark mode", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await asMember(page, "owner");
    await page.goto("/ps/shops/42/team");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByTestId("team-member-role-8")).toHaveText("مدیر");
    await page.getByTestId("team-member-menu-7").click();
    await expect(page.getByTestId("member-make-manager")).toHaveText("مدیر یې کړئ");
  });
});

test.describe("Who on the team sent it (item 7, owner 2026-10-12)", () => {
  test.use({ storageState: BUYER_STATE });

  /** Messages of conversation 1 as the API answers them (snake_case). */
  const msg = (id: number, senderId: number, body: string, sentBy?: { id: number; name: string }) => ({
    id, body, kind: "text", read_at: null, created_at: `2026-06-22T1${id}:00:00Z`, responds_to_id: null,
    sender: { id: senderId, name: "Safi Cosmetics", avatar_url: null }, attachment_url: null,
    ...(sentBy ? { sent_by: sentBy } : {}),
  });
  const page1 = (messages: unknown[]) => ({
    messages,
    meta: { pagination: { current_page: 1, next_page: null, prev_page: null, total_count: messages.length, total_pages: 1 } },
  });
  const umair = { id: 2, name: "Umair Safi" };
  const me = { id: 1, name: "Ahmad Karimi" };
  // Newest first, as the API pages them.
  const teamThread = page1([
    msg(5, 1, "My own reply", me),
    msg(4, 2, "Teammate again", umair),
    msg(3, 2, "Teammate reply", umair),
    msg(2, 3, "Buyer question"),
  ]);

  test("a member sees the teammate's name once per run, and You on their own", async ({ page }) => {
    await page.route("**/api/me/conversations/1/messages?*", (route) => route.fulfill({ json: teamThread }));
    await page.goto("/en/conversations/1");
    await expect(page.getByText("Teammate again")).toBeVisible();
    await expect(page.getByTestId("message-team-sender")).toHaveCount(2);
    await expect(page.getByTestId("message-team-sender-name")).toHaveText("Umair Safi");
    await expect(page.getByTestId("message-team-sender-you")).toHaveText("You");
  });

  test("RTL (ps): the label is translated and on the team's (mirrored) side", async ({ page }) => {
    await page.route("**/api/me/conversations/1/messages?*", (route) => route.fulfill({ json: teamThread }));
    await page.goto("/ps/conversations/1");
    await expect(page.getByText("Teammate again")).toBeVisible();
    await expect(page.getByTestId("message-team-sender-you")).toHaveText("تاسو");
    const label = await page.getByTestId("message-team-sender-name").boundingBox();
    const viewport = page.viewportSize();
    // dir="rtl": the team's side is the LEFT half.
    expect(label && viewport && label.x + label.width / 2).toBeLessThan((viewport?.width ?? 0) / 2);
  });

  test("the buyer never sees a team label (the API never sends sent_by to them)", async ({ page }) => {
    await page.route("**/api/me/conversations/1/messages?*", (route) =>
      route.fulfill({ json: page1([msg(2, 2, "Shop reply"), msg(1, 1, "My question")]) }),
    );
    await page.goto("/en/conversations/1");
    await expect(page.getByText("Shop reply")).toBeVisible();
    await expect(page.getByTestId("message-team-sender")).toHaveCount(0);
  });
});

test.describe("Dialogs stay above the on-screen keyboard (iOS Safari)", () => {
  test.use({ storageState: BUYER_STATE, viewport: { width: 375, height: 667 } });

  /**
   * Playwright can't open a real keyboard, so this shrinks window.visualViewport
   * the way iOS does (the layout viewport stays 667 high) and fires its resize.
   * The Dialog primitive sizes its overlay to the visual viewport, so Send must
   * stay inside the visible part.
   */
  test("invite by email: the input and Send stay in the visible viewport", async ({ page }) => {
    await asMember(page, "owner");
    await page.goto("/en/shops/42/team");
    await page.getByTestId("team-invite").click();
    await page.getByTestId("invite-by-contact").click();
    await page.getByTestId("invite-contact-input").fill("not-an-email");
    const KEYBOARD_FREE = 667 - 300;
    await page.evaluate((h) => {
      const vv = window.visualViewport!;
      Object.defineProperty(vv, "height", { configurable: true, get: () => h });
      Object.defineProperty(vv, "offsetTop", { configurable: true, get: () => 0 });
      vv.dispatchEvent(new Event("resize"));
    }, KEYBOARD_FREE);
    for (const el of [page.getByTestId("invite-contact-input"), page.getByText("Enter a valid email"), page.getByTestId("invite-send")]) {
      const box = (await el.boundingBox())!;
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.y + box.height).toBeLessThanOrEqual(KEYBOARD_FREE);
    }
  });
});
