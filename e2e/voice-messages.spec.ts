import { test, expect, type Page } from "./fixtures";
import { BUYER_STATE } from "./auth-paths";
import en from "../messages/en.json";

/**
 * Voice messages (1.2.1, hatiwal-mobile docs/design/VOICE_MESSAGES.md).
 * Chromium's fake microphone (a steady tone) stands in for a voice; the mock
 * API answers a send like Rails does (3 s, a 64-bar waveform) and serves a
 * real 3-second clip at /media/voice-* (Opus: this Chromium has no AAC
 * decoder, see e2e/mock-api/server.mjs).
 */
const v = en.chat.voice;
const MOCK = `http://localhost:${process.env.E2E_MOCK_API_PORT || 4010}`;

test.use({
  storageState: BUYER_STATE,
  permissions: ["microphone"],
  launchOptions: { args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream", "--autoplay-policy=no-user-gesture-required"] },
});

const composer = (page: Page) => page.getByTestId("voice-composer");
const timer = (page: Page) => page.getByTestId("voice-timer");
const seconds = async (page: Page) => {
  const [m, s] = ((await timer(page).textContent()) ?? "0:00").split(" / ")[0].split(":").map(Number);
  return m * 60 + s;
};

/** An incoming voice message from Sara, prepended to conversation 1. */
async function withIncomingVoice(page: Page, extra: Array<Record<string, unknown>> = []) {
  const voice = (id: number, n: number) => ({
    id, body: "🎤 0:03", kind: "voice_message", read_at: null, created_at: "2026-06-21T16:10:00Z",
    responds_to_id: null, sender: { id: 2, name: "Sara Ahmadi", avatar_url: null },
    attachment_url: `${MOCK}/media/voice-in-${n}.m4a`,
    voice: { url: `${MOCK}/media/voice-in-${n}.m4a`, duration_ms: 3000, waveform: Array.from({ length: 64 }, (_, i) => 20 + ((i * 7) % 70)) },
  });
  await page.route("**/api/me/conversations/1/messages*", async (route) => {
    if (route.request().method() !== "GET") return route.fallback();
    const response = await route.fetch();
    const body = (await response.json()) as { messages: unknown[] };
    return route.fulfill({ response, json: { ...body, messages: [voice(7001, 1), ...extra, ...body.messages] } });
  });
  return voice;
}

test.describe("Voice messages: recording", () => {
  test("record → pause → resume → stop → preview → send; the bubble plays", async ({ page }) => {
    await page.goto("/en/conversations/1");
    await page.getByRole("button", { name: v.record }).click();

    await expect(composer(page)).toHaveAttribute("data-state", "recording");
    await expect(timer(page)).toContainText("/ 2:00");
    await expect.poll(() => seconds(page), { timeout: 5_000 }).toBeGreaterThanOrEqual(1);

    // Pause freezes the clock.
    await page.getByRole("button", { name: v.pause }).click();
    await expect(composer(page)).toHaveAttribute("data-state", "paused");
    const frozen = await timer(page).textContent();
    await page.waitForTimeout(1_200);
    await expect(timer(page)).toHaveText(frozen ?? "");

    // Resume runs it again.
    await page.getByRole("button", { name: v.resume }).click();
    await expect(composer(page)).toHaveAttribute("data-state", "recording");
    await expect.poll(() => seconds(page), { timeout: 5_000 }).toBeGreaterThanOrEqual(2);

    // Stop → the preview, which plays.
    await page.getByRole("button", { name: v.stop }).click();
    await expect(composer(page)).toHaveAttribute("data-state", "preview");
    const preview = composer(page).getByTestId("voice-player");
    await expect(preview).toHaveAttribute("aria-label", /^Voice message, 0:0[2-4]$/);
    await preview.getByRole("button", { name: v.play }).click();
    await expect(preview.getByRole("button", { name: v.pausePlayback })).toBeVisible();
    await expect(preview.getByRole("button", { name: v.play })).toBeVisible({ timeout: 8_000 }); // ended

    // Send: multipart, kind voice_message, the browser's own recording.
    // (Playwright does not capture a Blob body; the mock answers 201 only for
    // kind=voice_message WITH a voice.(m4a|webm|ogg) attachment, else 422.)
    const [response] = await Promise.all([
      page.waitForResponse((r) => r.request().method() === "POST" && /\/conversations\/1\/messages$/.test(r.url())),
      page.getByRole("button", { name: v.send }).click(),
    ]);
    expect(response.status()).toBe(201);
    expect((await response.json()).message.kind).toBe("voice_message");
    await expect(composer(page)).toHaveCount(0);

    // The server's copy is in the thread, and plays.
    const bubble = page.getByTestId("voice-player").filter({ hasNot: page.getByTestId("voice-composer") }).last();
    await expect(bubble).toHaveAttribute("aria-label", "Voice message, 0:03");
    await bubble.getByRole("button", { name: v.play }).click();
    await expect(bubble.getByRole("button", { name: v.pausePlayback })).toBeVisible();
    await expect.poll(async () => Number(await bubble.getByRole("slider").getAttribute("aria-valuenow"))).toBeGreaterThan(0);
    // 🎤 is back in the composer.
    await expect(page.getByRole("button", { name: v.record })).toBeVisible();
  });

  test("🗑 while recording throws it away: nothing is sent", async ({ page }) => {
    let posts = 0;
    page.on("request", (r) => {
      if (r.method() === "POST" && /\/messages$/.test(r.url())) posts++;
    });
    await page.goto("/en/conversations/1");
    await page.getByRole("button", { name: v.record }).click();
    await expect(composer(page)).toHaveAttribute("data-state", "recording");
    await page.getByRole("button", { name: v.delete }).click();
    await expect(composer(page)).toHaveCount(0);
    await expect(page.getByRole("button", { name: v.record })).toBeVisible();
    expect(posts).toBe(0);
  });

  test("➤ while recording stops and sends at once", async ({ page }) => {
    await page.goto("/en/conversations/1");
    await page.getByRole("button", { name: v.record }).click();
    await expect.poll(() => seconds(page), { timeout: 5_000 }).toBeGreaterThanOrEqual(1);
    await page.waitForTimeout(300);
    const [response] = await Promise.all([
      page.waitForResponse((r) => r.request().method() === "POST" && /\/conversations\/1\/messages$/.test(r.url())),
      page.getByRole("button", { name: v.send }).click(),
    ]);
    expect(response.status()).toBe(201);
    await expect(composer(page)).toHaveCount(0);
  });

  test("under 1 second is not sent: told to hold on longer", async ({ page }) => {
    let posts = 0;
    page.on("request", (r) => {
      if (r.method() === "POST" && /\/messages$/.test(r.url())) posts++;
    });
    await page.goto("/en/conversations/1");
    await page.getByRole("button", { name: v.record }).click();
    await expect(composer(page)).toHaveAttribute("data-state", "recording");
    await page.getByRole("button", { name: v.stop }).click();
    await expect(page.getByText(v.tooShort)).toBeVisible();
    await expect(composer(page)).toHaveCount(0);
    expect(posts).toBe(0);
  });

  test("a refusal from the server keeps the preview to send again", async ({ page }) => {
    await page.route("**/api/me/conversations/1/messages", (route) =>
      route.request().method() === "POST"
        ? route.fulfill({ status: 422, json: { error: "Voice messages are up to 2 minutes.", code: "voice_too_long" } })
        : route.fallback(),
    );
    await page.goto("/en/conversations/1");
    await page.getByRole("button", { name: v.record }).click();
    await expect.poll(() => seconds(page), { timeout: 5_000 }).toBeGreaterThanOrEqual(1);
    await page.getByRole("button", { name: v.stop }).click();
    await expect(composer(page)).toHaveAttribute("data-state", "preview");
    await page.getByRole("button", { name: v.send }).click();
    await expect(page.getByText(v.errors.voice_too_long)).toBeVisible();
    await expect(composer(page)).toHaveAttribute("data-state", "preview");
  });
});

test.describe("Voice messages: microphone refused", () => {
  test.use({ permissions: [] });

  test("says the microphone is off and how to allow it; nothing recorded", async ({ page }) => {
    await page.addInitScript(() => {
      navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException("denied", "NotAllowedError"));
    });
    await page.goto("/en/conversations/1");
    await page.getByRole("button", { name: v.record }).click();
    const alert = page.getByTestId("voice-permission");
    await expect(alert).toBeVisible();
    await expect(alert).toContainText(v.permissionTitle);
    await expect(alert).toContainText(v.permissionHowToWeb);
    await expect(alert.getByRole("button", { name: v.tryAgain })).toBeVisible();
    await alert.getByRole("button", { name: v.discard }).click();
    await expect(page.getByRole("button", { name: v.record })).toBeVisible();
  });
});

test.describe("Voice messages: in the thread", () => {
  test("draws from the JSON and downloads nothing until ▶︎ (2G)", async ({ page }) => {
    const audio: string[] = [];
    page.on("request", (r) => {
      if (/\/media\/voice-/.test(r.url())) audio.push(r.url());
    });
    await withIncomingVoice(page);
    await page.goto("/en/conversations/1");
    const bubble = page.getByRole("group", { name: "Voice message, 0:03" }).first();
    await expect(bubble).toBeVisible();
    await expect(bubble.getByTestId("voice-waveform").locator("span")).toHaveCount(64);
    await page.waitForTimeout(800);
    expect(audio).toEqual([]);

    await bubble.getByRole("button", { name: v.play }).click();
    await expect(bubble.getByRole("button", { name: v.pausePlayback })).toBeVisible();
    expect(audio.length).toBeGreaterThan(0);
    // The speed chip, once started: 1× → 1.5×.
    await bubble.getByTestId("voice-speed").click();
    await expect(bubble.getByTestId("voice-speed")).toHaveText("1.5×");
  });

  test("only one plays at a time", async ({ page }) => {
    const voice = await withIncomingVoice(page);
    await page.unroute("**/api/me/conversations/1/messages*");
    await withIncomingVoice(page, [voice(7002, 2)]);
    await page.goto("/en/conversations/1");
    const [first, second] = [page.getByTestId("voice-player").nth(0), page.getByTestId("voice-player").nth(1)];
    await first.getByRole("button", { name: v.play }).click();
    await expect(first.getByRole("button", { name: v.pausePlayback })).toBeVisible();
    await second.getByRole("button", { name: v.play }).click();
    await expect(second.getByRole("button", { name: v.pausePlayback })).toBeVisible();
    await expect(first.getByRole("button", { name: v.play })).toBeVisible();
  });

  test("seeking with the keyboard moves the position", async ({ page }) => {
    await withIncomingVoice(page);
    await page.goto("/en/conversations/1");
    const slider = page.getByTestId("voice-player").first().getByRole("slider", { name: v.seek });
    await slider.focus();
    await page.keyboard.press("End");
    await expect(slider).toHaveAttribute("aria-valuenow", "100");
    await page.keyboard.press("Home");
    await expect(slider).toHaveAttribute("aria-valuenow", "0");
  });

  test("the other side's voice message can be reported on its own", async ({ page }) => {
    await withIncomingVoice(page);
    await page.goto("/en/conversations/1");
    const report = page.getByRole("button", { name: v.report });
    await expect(report).toHaveCount(1); // never on my own messages
    await report.click();
    await page.getByRole("dialog").getByRole("button", { name: en.report.reasons.inappropriate }).click();
    const [request] = await Promise.all([
      page.waitForRequest((r) => r.method() === "POST" && /\/reports$/.test(r.url())),
      page.getByRole("dialog").getByRole("button", { name: en.report.submit }).click(),
    ]);
    expect(request.postDataJSON().report).toMatchObject({ reportable_type: "Message", reportable_id: 7001 });
  });
});

test.describe("Voice messages: RTL", () => {
  test("ps: the row mirrors, the clock stays 0:0x / 2:00", async ({ page }) => {
    await page.goto("/ps/conversations/1");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await page.getByRole("button", { name: "غږیز پیغام ثبت کړئ" }).click();
    await expect(composer(page)).toHaveAttribute("data-state", "recording");
    await expect(timer(page)).toHaveAttribute("dir", "ltr");
    await expect(timer(page)).toHaveText(/^0:0\d \/ 2:00$/);
    await page.getByRole("button", { name: "غږیز پیغام ړنګ کړئ" }).click();
  });
});

// 1.2.1 (device run 2026-10-30): a clip tapped 7 minutes after its thread loaded got a 404 — the JSON's URL was a
// 5-minute signed file. The API now sends a never-expiring, participant-only route instead; the browser cannot
// send the session to it, so the web goes through its own /api/me proxy, which answers with the fresh file.
test.describe("Voice messages and photos: the never-expiring link", () => {
  const ROUTE = (id: number) => `${MOCK}/api/v1/conversations/1/messages/${id}/attachment`;

  test("a voice clip whose url is the API route plays (through the session proxy)", async ({ page }) => {
    await page.route("**/api/me/conversations/1/messages*", async (route) => {
      if (route.request().method() !== "GET" || /\/attachment$/.test(route.request().url())) return route.fallback();
      const response = await route.fetch();
      const body = (await response.json()) as { messages: unknown[] };
      const voice = {
        id: 7001, body: "🎤 0:03", kind: "voice_message", read_at: null, created_at: "2026-06-21T16:10:00Z", responds_to_id: null,
        sender: { id: 2, name: "Sara Ahmadi", avatar_url: null }, attachment_url: null, attachment_stable_url: ROUTE(7001),
        voice: { url: ROUTE(7001), duration_ms: 3000, waveform: Array.from({ length: 64 }, (_, i) => 20 + ((i * 7) % 70)) },
      };
      return route.fulfill({ response, json: { ...body, messages: [voice, ...body.messages] } });
    });
    await page.goto("/en/conversations/1");
    const bubble = page.getByTestId("voice-player").first();
    await bubble.getByRole("button", { name: v.play }).click();
    await expect(bubble.getByRole("button", { name: v.pausePlayback })).toBeVisible();
    await expect.poll(async () => Number(await bubble.getByRole("slider").getAttribute("aria-valuenow")), { timeout: 8_000 }).toBeGreaterThan(0);
  });

  test("a photo with attachment_stable_url loads through the session proxy", async ({ page }) => {
    await page.route("**/api/me/conversations/1/messages*", async (route) => {
      if (route.request().method() !== "GET" || /\/attachment$/.test(route.request().url())) return route.fallback();
      const response = await route.fetch();
      const body = (await response.json()) as { messages: unknown[] };
      const photo = {
        id: 7002, body: "photo.png", kind: "image_message", read_at: null, created_at: "2026-06-21T16:11:00Z", responds_to_id: null,
        sender: { id: 2, name: "Sara Ahmadi", avatar_url: null },
        attachment_url: `${MOCK}/rails/active_storage/disk/expired/photo.png`, attachment_stable_url: ROUTE(7002), voice: null,
      };
      return route.fulfill({ response, json: { ...body, messages: [photo, ...body.messages] } });
    });
    await page.goto("/en/conversations/1");
    const img = page.locator('img[src="/api/me/conversations/1/messages/7002/attachment"]');
    await expect(img).toHaveCount(1);
    await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(0);
  });
});
