import { test, expect, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

/*
 * The web (cable-ticket-web) against the 1.2.0 API, on a private DB. See playwright.api120.config.ts.
 *  1. Chat realtime through the single-use cable ticket: A sends, B sees it live; after 60 s a reload
 *     fetches a NEW ticket, and the old one is refused by the cable.
 *  2. Prices on the Bazaar cards and a listing's page (the B11 class of bug, on web).
 *  3. The web's writes carry no Idempotency-Key and no base, and still work against the new API:
 *     create, edit, mark sold, save, report — no 409 / 422.
 * 1 and 2 run in the three viewports; 3 once (desktop).
 */
const OUT = process.env.REG_OUT ?? "test-results/api-120";
const PASSWORD = process.env.REG_PASSWORD ?? "Password123!";
const SELLER = process.env.REG_SELLER ?? "seller@hatiwal.test";
const BUYER = process.env.REG_BUYER ?? "buyer@hatiwal.test";
const CONV = Number(process.env.REG_CONV ?? 23);
const CABLE_URL = process.env.REG_CABLE_URL ?? "ws://localhost:3079/hatiwal-cable";
mkdirSync(OUT, { recursive: true });
// Each project runs in its own worker: merge into what the others wrote.
const record = (key: string, value: unknown) => {
  const file = `${OUT}/results.json`;
  const results = existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown>) : {};
  results[key] = value;
  writeFileSync(file, JSON.stringify(results, null, 2));
};

// One real sign-in per person, then their cookies are reused: the API rate-limits sign_in per IP.
const sessions = new Map<string, Awaited<ReturnType<BrowserContext["cookies"]>>>();

async function personContext(browser: Browser, email: string, use: object): Promise<{ ctx: BrowserContext; page: Page }> {
  const ctx = await browser.newContext(use);
  await ctx.addInitScript(() => {
    window.localStorage.setItem("hatiwal.onboarded", "1");
    for (let id = 1; id <= 200; id++) window.localStorage.setItem(`hatiwal.sell-as-asked-${id}`, "1");
  });
  const page = await ctx.newPage();
  const saved = sessions.get(email);
  if (saved) {
    await ctx.addCookies(saved);
  } else {
    await page.goto("/en/login");
    await page.locator('input[type="email"]').fill(email);
    await page.locator('input[type="password"]').fill(PASSWORD);
    await page.locator('button[type="submit"]').click();
    await expect(page).not.toHaveURL(/\/login/, { timeout: 60_000 });
    sessions.set(email, await ctx.cookies());
  }
  return { ctx, page };
}

// The Active Storage blob behind an image URL (a representation/blob URL carries it as signed JSON;
// a Next <Image> wraps that URL in /_next/image?url=…).
function blobIdOf(src: string | null): number | null {
  if (!src) return null;
  const inner = src.includes("/_next/image") ? decodeURIComponent(new URL(src, "http://x").searchParams.get("url") ?? "") : src;
  const signed = inner.match(/\/(?:redirect|proxy)\/([A-Za-z0-9_=-]+)--/)?.[1];
  if (!signed) return null;
  return (JSON.parse(Buffer.from(signed, "base64").toString("utf8")) as { _rails: { data: number } })._rails.data;
}

const loaded = (page: Page, img: ReturnType<Page["locator"]>) =>
  expect.poll(() => img.evaluate((i: HTMLImageElement) => (i.complete ? i.naturalWidth : 0)), { timeout: 30_000 }).toBeGreaterThan(0);

const shot = (page: Page, name: string) =>
  page.screenshot({ path: `${OUT}/${name}.jpg`, type: "jpeg", quality: 60, fullPage: false });

// The tickets the page's /api/auth/cable answered, and the cable URLs it opened.
function watchCable(page: Page) {
  const tickets: string[] = [];
  const sockets: string[] = [];
  page.on("response", async (res) => {
    if (res.url().endsWith("/api/auth/cable") && res.status() === 200) {
      const body = await res.json().catch(() => null);
      if (body?.ticket) tickets.push(body.ticket as string);
    }
  });
  page.on("websocket", (ws) => {
    if (/hatiwal-cable/.test(ws.url())) sockets.push(ws.url());
  });
  return { tickets, sockets };
}

test.describe.configure({ mode: "serial" });

test("1. chat is live through the single-use cable ticket; a new ticket after 60 s, the old one refused", async ({ browser }, info) => {
  const use = info.project.use;
  const view = info.project.name;
  const a = await personContext(browser, SELLER, use);
  const b = await personContext(browser, BUYER, use);
  const bCable = watchCable(b.page);

  await b.page.goto(`/en/conversations/${CONV}`);
  await expect.poll(() => bCable.sockets.length, { timeout: 30_000 }).toBeGreaterThan(0);
  const first = new URL(bCable.sockets[0]);
  expect(first.searchParams.get("ticket"), "the socket URL carries a ticket").toBeTruthy();
  for (const u of bCable.sockets) expect(u, "never the session in the URL").not.toMatch(/access[-_]token|[?&]client=|[?&]uid=|@/);
  // The socket's ticket is one this page fetched from /api/auth/cable (a dev server's StrictMode
  // opens the cable twice on load, so there may be two; the responses can also land out of order).
  await expect.poll(() => bCable.tickets.includes(first.searchParams.get("ticket")!), { timeout: 10_000 }).toBe(true);

  await a.page.goto(`/en/conversations/${CONV}`);
  const text = `REG ${view} ${Date.now()}`;
  await a.page.getByPlaceholder("Type a message...").fill(text);
  await a.page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(a.page.getByText(text)).toBeVisible();
  // B never reloads: the message can only arrive over the cable.
  await expect(b.page.getByText(text)).toBeVisible({ timeout: 20_000 });
  await shot(a.page, `${view}-1-chat-A-sent`);
  await shot(b.page, `${view}-1-chat-B-live`);

  // 60 s later the first ticket is long expired (and used): a reload must fetch a NEW one.
  const oldTicket = first.searchParams.get("ticket")!;
  await b.page.waitForTimeout(61_000);
  const before = bCable.tickets.length;
  await b.page.reload();
  await expect.poll(() => bCable.tickets.length, { timeout: 30_000 }).toBeGreaterThan(before);
  const fresh = bCable.tickets[bCable.tickets.length - 1];
  expect(fresh).not.toBe(oldTicket);

  // The old ticket, offered to the cable again: refused (no welcome; "unauthorized" or closed).
  const refusal = await b.page.evaluate(
    ({ url, ticket }) =>
      new Promise<string>((resolve) => {
        const ws = new WebSocket(`${url}?ticket=${encodeURIComponent(ticket)}`);
        const done = (s: string) => { try { ws.close(); } catch { /* closed */ } resolve(s); };
        ws.onmessage = (e) => {
          const m = JSON.parse(String(e.data));
          if (m.type === "welcome") done("welcome");
          if (m.type === "disconnect") done(`disconnect:${m.reason}`);
        };
        ws.onclose = () => done("closed");
        setTimeout(() => done("timeout"), 10_000);
      }),
    { url: CABLE_URL, ticket: oldTicket },
  );
  expect(refusal, "a used ticket never connects again").not.toBe("welcome");
  await shot(b.page, `${view}-1-chat-B-after-reload`);
  record(`cable.${view}`, { tickets: bCable.tickets.length, sockets: bCable.sockets, oldTicketOfferedAgain: refusal, message: text });
  await a.ctx.close();
  await b.ctx.close();
});

test("2. prices and photos on the Bazaar cards and a listing's page; the chosen cover first", async ({ browser }, info) => {
  const view = info.project.name;
  const { ctx, page } = await personContext(browser, BUYER, info.project.use);
  await page.goto("/en/bazaar");
  const cards = page.locator('a[href^="/en/listings/"]').filter({ has: page.locator("img") });
  await expect(cards.first()).toBeVisible({ timeout: 60_000 });
  const n = Math.min(await cards.count(), 6);
  expect(n).toBeGreaterThan(1);
  const prices: string[] = [];
  for (let i = 0; i < n; i++) {
    const t = (await cards.nth(i).innerText()).replace(/\s+/g, " ");
    const m = t.match(/(AFN|PKR)\s?[\d,.]+/);
    expect(m, `card ${i} shows a price: "${t.slice(0, 80)}"`).not.toBeNull();
    prices.push(m![0]);
    await cards.nth(i).scrollIntoViewIfNeeded();
    await loaded(page, cards.nth(i).locator("img").first()); // a real image, never a broken one
  }
  await shot(page, `${view}-2-bazaar-prices`);
  const href = await cards.first().getAttribute("href");
  await page.goto(href!);
  const detail = (await page.locator("main").innerText()).replace(/\s+/g, " ");
  const dm = detail.match(/(AFN|PKR)\s?[\d,.]+/);
  expect(dm, "the listing's page shows its price").not.toBeNull();
  await shot(page, `${view}-2-detail-price`);
  // The cover the seller CHOSE (B12): REG_COVER_ID's photos were reordered so that blob REG_COVER_BLOB —
  // not the first one uploaded — is first. Its card and its page must both lead with it.
  let cover: Record<string, unknown> | null = null;
  if (process.env.REG_COVER_ID) {
    const want = Number(process.env.REG_COVER_BLOB);
    await page.goto(`/en/bazaar?q=${encodeURIComponent(process.env.REG_COVER_Q ?? "")}`);
    const card = page.locator(`a[href="/en/listings/${process.env.REG_COVER_ID}"]`).first();
    await expect(card).toBeVisible({ timeout: 60_000 });
    const cardImg = card.locator("img").first();
    await loaded(page, cardImg);
    const cardBlob = blobIdOf(await cardImg.getAttribute("src"));
    expect(cardBlob, "the card shows the chosen cover").toBe(want);
    await card.scrollIntoViewIfNeeded();
    await shot(page, `${view}-2-cover-card`);
    await page.goto(`/en/listings/${process.env.REG_COVER_ID}`);
    const firstPhoto = page.locator("main img").filter({ hasNot: page.locator("[data-avatar]") }).first();
    await loaded(page, firstPhoto);
    const detailBlob = blobIdOf(await firstPhoto.getAttribute("src"));
    expect(detailBlob, "the listing's page opens on the chosen cover").toBe(want);
    await shot(page, `${view}-2-cover-detail`);
    cover = { listing: Number(process.env.REG_COVER_ID), chosen: want, card: cardBlob, detail: detailBlob };
  }
  record(`prices.${view}`, { cards: prices, detail: dm![0], listing: href, cover });
  await ctx.close();
});

test("3. the web's writes (no Idempotency-Key, no base) still work: create, edit, mark sold, save, report", async ({ browser }, info) => {
  test.skip(info.project.name !== "desktop", "once, on desktop");
  const writes: { method: string; url: string; status?: number; key: boolean; base: boolean }[] = [];
  const watch = (page: Page) => {
    page.on("request", (req) => {
      if (!/\/api\/(me|proxy)\//.test(req.url()) || req.method() === "GET") return;
      writes.push({ method: req.method(), url: new URL(req.url()).pathname, key: !!req.headers()["idempotency-key"],
                    base: /"base"\s*:/.test(req.postData() ?? "") });
    });
    page.on("response", (res) => {
      const w = [...writes].reverse().find((x) => x.url === new URL(res.url()).pathname && x.status === undefined && x.method === res.request().method());
      if (w) w.status = res.status();
    });
  };
  const seller = await personContext(browser, SELLER, info.project.use);
  watch(seller.page);
  const title = `REG web listing ${Date.now()}`;
  await seller.page.goto("/en/listings/new");
  await seller.page.getByLabel("Title", { exact: true }).fill(title);
  await seller.page.getByLabel("Price", { exact: true }).fill("900");
  await seller.page.getByLabel("Category", { exact: true }).selectOption({ index: 1 });
  const location = seller.page.getByLabel("Location", { exact: true });
  if (await location.count()) await location.fill("Kabul");
  await seller.page.getByRole("button", { name: "Save Draft" }).click();
  await expect(seller.page).toHaveURL(/\/my-listings\/\d+/, { timeout: 30_000 });
  const id = seller.page.url().match(/my-listings\/(\d+)/)![1];
  await shot(seller.page, "desktop-3-created");

  await seller.page.goto(`/en/listings/${id}/edit`);
  await seller.page.getByLabel("Title", { exact: true }).fill(`${title} (edited)`);
  await seller.page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(seller.page.getByText(`${title} (edited)`).first()).toBeVisible({ timeout: 30_000 });
  await shot(seller.page, "desktop-3-edited");

  await seller.page.goto(`/en/my-listings/${process.env.REG_SOLD_ID}`);
  await seller.page.getByRole("button", { name: "Mark as Sold" }).first().click();
  await expect(seller.page.getByText("Who bought this item?")).toBeVisible();
  await seller.page.getByRole("button", { name: /Sold to someone not on Hatiwal/ }).click();
  await seller.page.getByRole("dialog").getByRole("button", { name: "Confirm sold" }).click();
  await expect(seller.page.getByText("Listing marked as sold")).toBeVisible();
  await shot(seller.page, "desktop-3-sold");

  const buyer = await personContext(browser, BUYER, info.project.use);
  watch(buyer.page);
  await buyer.page.goto(`/en/listings/${process.env.REG_OTHER_ID}`);
  const save = buyer.page.getByRole("button", { name: /save/i }).first();
  await expect(save).toBeVisible();
  await save.click();
  await expect.poll(() => writes.filter((w) => /save/.test(w.url) && w.status).length, { timeout: 15_000 }).toBeGreaterThan(0);
  const report = buyer.page.getByRole("button", { name: "Report", exact: true });
  await expect(async () => {
    await report.click();
    await expect(buyer.page.getByText("Why are you reporting this?")).toBeVisible({ timeout: 2000 });
  }).toPass({ timeout: 15_000 });
  await buyer.page.getByRole("button", { name: "Spam" }).click();
  await buyer.page.getByRole("button", { name: "Submit Report" }).click();
  await expect(buyer.page.getByText(/Report submitted|already reported/)).toBeVisible();
  await shot(buyer.page, "desktop-3-saved-reported");

  record("writes", { listing: Number(id), writes });
  for (const w of writes) {
    expect(w.key, `${w.method} ${w.url}: no Idempotency-Key from the web`).toBe(false);
    expect(w.base, `${w.method} ${w.url}: no base from the web`).toBe(false);
    expect([409, 422], `${w.method} ${w.url}: no conflict / refusal`).not.toContain(w.status);
  }
  await seller.ctx.close();
  await buyer.ctx.close();
});
