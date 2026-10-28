import { test, expect } from "@playwright/test";
import { BUYER_STATE } from "./auth-paths";

// The chat's live connection (privacy review 2026-10-28): a browser cannot set
// WebSocket headers, so the socket URL must carry what authenticates it — and
// URLs end up in proxy access logs. It used to carry the devise session itself
// (access_token, client, uid = the email); it now carries a single-use ticket
// that /api/auth/cable gets from Rails server-side. The session never reaches
// page JS or a URL.
test.describe("Cable ticket", () => {
  test.describe("signed in", () => {
    test.use({ storageState: BUYER_STATE });

    test("POST /api/auth/cable returns a ticket, and nothing of the session", async ({ page }) => {
      await page.goto("/en");
      const res = await page.request.post("/api/auth/cable");
      expect(res.status()).toBe(200);
      expect(res.headers()["cache-control"]).toContain("no-store");
      const body = await res.json();
      expect(body.ticket).toMatch(/^mock-ticket-/);
      expect(Object.keys(body).sort()).toEqual(["expiresIn", "ticket"]);
      expect(JSON.stringify(body)).not.toMatch(/buyer@hatiwal\.test|access|mock-client/);
    });

    test("the thread's socket URL carries a ticket, never the session — and a reconnect a FRESH one", async ({ page }) => {
      // The e2e stack has no cable server: this stands in for it (and is the only
      // way to see the URL — a refused socket raises no "websocket" event).
      const urls: string[] = [];
      await page.routeWebSocket(/hatiwal-cable/, (ws) => {
        urls.push(ws.url());
        ws.send(JSON.stringify({ type: "welcome" }));
        // The first connection drops a moment later, as a flaky network would.
        if (urls.length === 1) setTimeout(() => ws.close(), 500);
      });
      await page.goto("/en/conversations/1");
      await expect.poll(() => urls.length, { timeout: 15_000 }).toBeGreaterThan(0);

      const first = new URL(urls[0]);
      expect(first.searchParams.get("ticket")).toMatch(/^mock-ticket-/);
      for (const u of urls) expect(u).not.toMatch(/access_token|[?&]client=|[?&]uid=|hatiwal\.test/);

      // ActionCable reopens by itself; a used ticket is refused, so the next URL
      // must carry a new one.
      await expect.poll(() => urls.length, { timeout: 30_000 }).toBeGreaterThan(1);
      const second = new URL(urls[urls.length - 1]).searchParams.get("ticket");
      expect(second).toMatch(/^mock-ticket-/);
      expect(second).not.toBe(first.searchParams.get("ticket"));
    });

    test("another site cannot ask for one: 403", async ({ page }) => {
      await page.goto("/en");
      const res = await page.request.post("/api/auth/cable", { headers: { Origin: "https://evil.example" } });
      expect(res.status()).toBe(403);
    });
  });

  test("signed out: 401, no ticket", async ({ request }) => {
    const res = await request.post("/api/auth/cable");
    expect(res.status()).toBe(401);
    expect(await res.text()).not.toContain("ticket\":\"");
  });

  test("GET no longer hands out anything (it used to return the session)", async ({ request }) => {
    const res = await request.get("/api/auth/cable");
    expect(res.status()).toBe(405);
  });
});
