import { test, expect, type Page, type Browser } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { withSessionUser, shopEntry } from "../e2e/session-user";

/*
 * Web design QA of the 1.1.6 surfaces (see playwright.design.config.ts).
 * Never fails on a finding: it captures and measures, and the findings are
 * read by a person. It fails only if a surface cannot be reached at all.
 */
const OUT = path.join(__dirname, "..", "qa", "reports", "web-design-1.1.6");
const LOCALES = ["en", "ps", "fa"] as const;
const THEMES = ["light", "dark"] as const;
const WIDTHS = [390, 768, 1280] as const;
const ONLY = process.env.DESIGN_ONLY ? new RegExp(process.env.DESIGN_ONLY) : null;

type Locale = (typeof LOCALES)[number];
type Surface = {
  name: string;
  persona: "buyer" | "empty" | "guest";
  path: (l: Locale) => string;
  prepare?: (page: Page, l: Locale) => Promise<void>; // routes / session, before goto
  act?: (page: Page, l: Locale) => Promise<void>; // after load (open a sheet…)
  ready: (page: Page) => Promise<void>;
  locales?: readonly Locale[];
};

const ownerOf42 = async (page: Page) => {
  await withSessionUser(page, { sellerMode: true, shops: [shopEntry(42, "Safi Cosmetics", "active", "owner")] });
  await page.route("**/api/me/shops/42", async (route) => {
    if (route.request().method() !== "GET") return route.continue();
    const res = await route.fetch();
    const json = await res.json();
    json.shop = { ...json.shop, role: "owner" };
    await route.fulfill({ response: res, json });
  });
  await page.addInitScript(() => window.localStorage.setItem("hatiwal.sell-as-asked-1", "1"));
};
const verifyStatus = (status: Record<string, unknown>) => async (page: Page) => {
  await page.route(/\/api\/me\/verification_requests\/current\?subject=me$/, (route) =>
    route.fulfill({ json: { verification_status: { verified_since: null, missing: [], reason: null, name_changed: false, request: null, can_apply: true, ...status } } }),
  );
};
const REQ = { id: 901, status: "requested", document_type: "e_tazkira", name_on_document: "Ahmad Karimi", document_last4: "4821", files_count: 3, files_purged: false, reason_code: null, created_at: "2026-10-05T10:00:00Z", decided_at: null };

const SURFACES: Surface[] = [
  { name: "profile-hub", persona: "buyer", path: (l) => `/${l}/profile`, ready: (p) => expect(p.locator('a[href$="/profile/activity"]').first()).toBeVisible() },
  { name: "profile-activity", persona: "buyer", path: (l) => `/${l}/profile/activity`, ready: (p) => expect(p.getByTestId("profile-activity-page")).toBeVisible() },
  { name: "profile-settings", persona: "buyer", path: (l) => `/${l}/profile/settings`, ready: (p) => expect(p.getByTestId("profile-settings-page")).toBeVisible() },
  { name: "profile-privacy", persona: "buyer", path: (l) => `/${l}/profile/privacy-account`, ready: (p) => expect(p.getByTestId("profile-privacy-account-page")).toBeVisible() },
  { name: "shop-page", persona: "buyer", prepare: ownerOf42, path: (l) => `/${l}/shops/42`, ready: (p) => expect(p.getByTestId("shop-page")).toBeVisible() },
  { name: "shop-team", persona: "buyer", prepare: ownerOf42, path: (l) => `/${l}/shops/42/team`, ready: (p) => expect(p.getByTestId("team-invite")).toBeVisible() },
  {
    name: "shop-invite-sent", persona: "buyer", prepare: ownerOf42, path: (l) => `/${l}/shops/42/team`,
    ready: (p) => expect(p.getByTestId("team-invite")).toBeVisible(),
    act: async (p) => { await p.getByTestId("team-invite").click(); await p.getByTestId("invite-share-link").click(); await expect(p.getByTestId("invite-sent")).toBeVisible(); },
  },
  { name: "verify-gate-requested", persona: "buyer", prepare: verifyStatus({ status: "requested", request: REQ }), path: (l) => `/${l}/profile/verify`, ready: (p) => expect(p.locator("main")).toBeVisible() },
  { name: "verify-gate-verified", persona: "buyer", prepare: verifyStatus({ status: "verified", verified_since: "2026-10-06T10:00:00Z" }), path: (l) => `/${l}/profile/verify`, ready: (p) => expect(p.locator("main")).toBeVisible() },
  { name: "verify-card-requested", persona: "buyer", prepare: verifyStatus({ status: "requested", request: REQ }), path: (l) => `/${l}/profile`, ready: (p) => expect(p.getByTestId("verify-card")).toBeVisible() },
  {
    name: "expiry-tab", persona: "buyer", path: (l) => `/${l}/my-listings`,
    ready: (p) => expect(p.locator('a[href*="/my-listings/10"]').first()).toBeVisible({ timeout: 60_000 }),
    act: async (p) => { await p.getByRole("tab").nth(1).waitFor(); const tabs = p.getByRole("tab"); const n = await tabs.count(); for (let i = 0; i < n; i++) { if (/Expired|ختم|منقضی|پای/.test((await tabs.nth(i).innerText()) ?? "")) { await tabs.nth(i).click(); break; } } },
  },
  { name: "expiry-relaunch", persona: "buyer", path: (l) => `/${l}/my-listings/10`, ready: (p) => expect(p.locator("main")).toBeVisible() },
  {
    name: "move-dialog", persona: "buyer", prepare: ownerOf42, path: (l) => `/${l}/my-listings`,
    ready: (p) => expect(p.locator('a[href*="/my-listings/1"]').first()).toBeVisible({ timeout: 60_000 }),
    act: async (p, l) => { await p.locator(`a[href="/${l}/my-listings/1"]`).locator("..").getByRole("button").last().click(); await p.getByTestId("move-listing").click(); },
  },
  {
    name: "duplicate-dialog", persona: "buyer", prepare: ownerOf42, path: (l) => `/${l}/my-listings`,
    ready: (p) => expect(p.locator('a[href*="/my-listings/1"]').first()).toBeVisible({ timeout: 60_000 }),
    act: async (p, l) => { await p.locator(`a[href="/${l}/my-listings/1"]`).locator("..").getByRole("button").last().click(); await p.getByTestId("duplicate-listing").click(); },
  },
  { name: "support-entry", persona: "empty", path: (l) => `/${l}/conversations`, ready: (p) => expect(p.getByTestId("support-entry-row")).toBeVisible() },
  { name: "seller-joined", persona: "guest", path: (l) => `/${l}/sellers/1`, ready: (p) => expect(p.locator("main")).toBeVisible() },
  {
    name: "location-sheet", persona: "buyer", path: (l) => `/${l}/bazaar`,
    ready: (p) => expect(p.getByTestId("location-bar")).toBeVisible(),
    act: async (p) => { await p.getByTestId("location-change").click(); await expect(p.getByTestId("location-sheet")).toBeVisible(); },
  },
];

const STATE = (who: string) => path.join(__dirname, "..", "e2e", ".auth", `design-${who}.json`);

async function login(browser: Browser, email: string, file: string) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto("/en/login");
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill("Password123!");
  await page.locator('button[type="submit"]').click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 60_000 });
  await page.evaluate(() => window.localStorage.setItem("hatiwal.onboarded", "1"));
  await ctx.storageState({ path: file });
  await ctx.close();
}

/** Measures what a person would otherwise have to spot by eye. */
async function measure(page: Page, locale: Locale) {
  return page.evaluate((loc) => {
    const vw = window.innerWidth;
    const label = (el: Element) =>
      (el.getAttribute("data-testid") ?? el.getAttribute("aria-label") ?? (el as HTMLElement).innerText ?? el.tagName).toString().trim().slice(0, 40);
    const visible = (el: Element) => {
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none";
    };
    const overflow = document.documentElement.scrollWidth - vw > 1
      ? [...document.querySelectorAll("body *")].filter((el) => visible(el) && el.getBoundingClientRect().right > vw + 1)
          .slice(-5).map((el) => `${label(el)} (right ${Math.round(el.getBoundingClientRect().right)} > ${vw})`)
      : [];
    const latinDigits: string[] = [];
    if (loc !== "en") {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        const t = n.textContent ?? "";
        const parent = n.parentElement;
        if (!parent || !/[0-9]/.test(t) || ["SCRIPT", "STYLE", "TEXTAREA"].includes(parent.tagName)) continue;
        if (!visible(parent) || /https?:|@|\+93|\+92|#\d/.test(t) || parent.closest("[dir='ltr'],code,input")) continue;
        latinDigits.push(t.trim().slice(0, 50));
      }
    }
    const small = [...document.querySelectorAll("main a, main button, main [role=button], main select, [role=dialog] button, [role=dialog] a")]
      .filter((el) => visible(el) && !el.closest("p, li > span"))
      .map((el) => ({ el, r: el.getBoundingClientRect() }))
      .filter(({ r }) => r.height < 44 && r.width < 200)
      .map(({ el, r }) => `${label(el)} ${Math.round(r.width)}x${Math.round(r.height)}`);
    const unmirrored: string[] = [];
    if (document.documentElement.dir === "rtl") {
      for (const svg of document.querySelectorAll("svg[class*='lucide-chevron-right'], svg[class*='lucide-chevron-left'], svg[class*='lucide-arrow-left'], svg[class*='lucide-arrow-right']")) {
        if (!visible(svg)) continue;
        let flipped = false;
        for (let el: Element | null = svg; el && el !== document.body; el = el.parentElement) {
          // Tailwind v4's rtl:-scale-x-100 sets the `scale` property, not `transform`.
          const cs = getComputedStyle(el);
          if (cs.transform?.startsWith("matrix(-1") || /^-1(\s|$)/.test(cs.scale ?? "")) flipped = true;
        }
        if (!flipped) unmirrored.push(`${svg.getAttribute("class")?.match(/lucide-[a-z-]+/)?.[0]} in ${label(svg.closest("a,button") ?? svg.parentElement!)}`);
      }
    }
    return { overflow, latinDigits: [...new Set(latinDigits)].slice(0, 12), small: [...new Set(small)].slice(0, 15), unmirrored: [...new Set(unmirrored)] };
  }, locale);
}

test("design QA: every 1.1.6 surface × widths × locales × themes", async ({ browser }) => {
  fs.mkdirSync(OUT, { recursive: true });
  await login(browser, "buyer@hatiwal.test", STATE("buyer"));
  await login(browser, "empty@hatiwal.test", STATE("empty"));
  const findings: Record<string, unknown> = {};
  for (const s of SURFACES) {
    if (ONLY && !ONLY.test(s.name)) continue;
    for (const l of s.locales ?? LOCALES) {
      for (const theme of THEMES) {
        for (const w of WIDTHS) {
          const ctx = await browser.newContext({
            storageState: s.persona === "guest" ? undefined : STATE(s.persona),
            viewport: { width: w, height: 900 },
            colorScheme: theme,
          });
          const page = await ctx.newPage();
          const key = `${s.name}-${l}-${theme}-${w}`;
          try {
            await page.addInitScript(() => window.localStorage.setItem("hatiwal.onboarded", "1"));
            await s.prepare?.(page, l);
            await page.goto(s.path(l));
            await s.ready(page);
            await s.act?.(page, l);
            await page.waitForTimeout(400);
            await page.screenshot({ path: path.join(OUT, `${key}.png`), fullPage: true });
            const m = await measure(page, l);
            if (m.overflow.length || m.latinDigits.length || m.unmirrored.length || (w === 390 && m.small.length)) {
              findings[key] = { ...m, small: w === 390 ? m.small : [] };
            }
          } catch (e) {
            findings[key] = { error: String(e).slice(0, 300) };
          } finally {
            await ctx.close();
          }
        }
      }
    }
  }
  fs.writeFileSync(path.join(OUT, "findings.json"), JSON.stringify(findings, null, 2));
});
