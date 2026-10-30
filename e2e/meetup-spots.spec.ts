import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { BUYER_STATE } from "./auth-paths";

const FA = JSON.parse(readFileSync(path.join(__dirname, "..", "messages", "fa.json"), "utf8"));

/**
 * IDEA-6 safe meetup spots (hatiwal-mobile docs/design/SAFE_MEETUP_SPOTS.md):
 * the meetup dialog suggests busy public places near the listing; one click
 * fills the place, and the proposal keeps the "place | time | lat,long" format
 * the apps already read. No point on the listing → no suggestions.
 */
const MOCK_API = `http://localhost:${process.env.E2E_MOCK_API_PORT || 4010}/api/v1`;
const openMeetup = async (page: Page, id: number) => {
  await page.goto(`/en/conversations/${id}`);
  await page.getByRole("button", { name: "Propose Meetup" }).first().click();
  await expect(page.getByRole("heading", { name: "Propose a Meetup" })).toBeVisible();
};

test.use({ storageState: BUYER_STATE });

test("suggests the spots near the listing, not other cities; never says 'safe'", async ({ page }) => {
  await openMeetup(page, 1);
  const spots = page.getByTestId("meetup-spots");
  await expect(spots).toContainText("Busy public places nearby");
  await expect(spots.getByRole("button", { name: "Majid Mall" })).toBeVisible();
  await expect(spots.getByRole("button", { name: "Madina Bazaar" })).toBeVisible();
  await expect(spots).not.toContainText("Aria Market");
  await expect(spots).not.toContainText(/safe/i);
});

test("a click fills the place; the proposal is 'place | time | lat,long'", async ({ page }) => {
  await openMeetup(page, 1);
  await page.getByTestId("meetup-spots").getByRole("button", { name: "Majid Mall" }).click();
  await expect(page.getByPlaceholder("Where? (e.g. Shahr-e-Naw market)")).toHaveValue("Majid Mall");
  await page.getByPlaceholder("When? (e.g. Tomorrow 3pm)").fill("Friday 4pm");
  await page.getByRole("dialog").getByRole("button", { name: "Propose Meetup" }).click();
  await expect.poll(async () => (await (await page.request.get(`${MOCK_API}/__last_message`)).json()).message)
    .toEqual({ conversation_id: 1, body: "Majid Mall | Friday 4pm | 34.53399,69.17285", kind: "meetup_proposal" });
});

test("a listing with no point: no suggestions row", async ({ page }) => {
  await openMeetup(page, 100);
  await expect(page.getByTestId("meetup-spots")).toHaveCount(0);
});

test("in Dari the spot shows its Dari name", async ({ page }) => {
  await page.goto("/fa/conversations/1");
  await page.getByRole("button", { name: FA.chat.proposeMeetup }).first().click();
  await expect(page.getByTestId("meetup-spots").getByRole("button", { name: "مجید مال" })).toBeVisible();
});
