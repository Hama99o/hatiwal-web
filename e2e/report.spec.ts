import { test, expect } from "@playwright/test";
import { BUYER_STATE } from "./auth-paths";

// Report is hidden on your own content, so we report listing 2 (owned by
// seller 2, not the buyer persona who is seller 1).
test.describe("Report a listing", () => {
  test.use({ storageState: BUYER_STATE });

  test("opens the report dialog, requires a reason, then submits", async ({
    page,
  }) => {
    await page.goto("/en/listings/2");
    // Wait for the session to settle: the Report trigger's onClick sends guests
    // to /login, so we must be authed before clicking. "Message Seller" only
    // renders as a button (not a login link) once authenticated.
    await expect(
      page.getByRole("button", { name: "Message Seller" }),
    ).toBeVisible({ timeout: 15_000 });
    const trigger = page.getByRole("button", { name: "Report", exact: true });
    await expect(trigger).toBeVisible();
    // Retry click until the dialog opens (rides out client-island hydration).
    await expect(async () => {
      await trigger.click();
      await expect(
        page.getByText("Why are you reporting this?"),
      ).toBeVisible({ timeout: 2000 });
    }).toPass({ timeout: 15_000 });

    const submit = page.getByRole("button", { name: "Submit Report" });
    await expect(submit).toBeDisabled(); // no reason chosen yet
    await page.getByRole("button", { name: "Spam" }).click();
    await expect(submit).toBeEnabled();
    await submit.click();
    await expect(
      page.getByText("Report submitted. Thank you."),
    ).toBeVisible();
  });
});
