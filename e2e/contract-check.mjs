/**
 * Mock ↔ live API contract check — run before a release.
 *
 * Why: the web mock (e2e/mock-api/server.mjs) is a second source of truth for
 * the API's JSON shape. When it drifts from the real Rails serializers, the E2E
 * suite stays green while production breaks — exactly how BUG-1 shipped
 * (GET /blocks sends `full_name`; the mock sent `name`; the web read `.name`).
 *
 * What: boots the mock, fetches the main GET endpoints from BOTH the mock and a
 * LIVE API with the same auth, and diffs the key-set of each response's sample
 * object (one level of nesting on the known sub-objects). Both the mock and the
 * real API emit snake_case, so this is an apples-to-apples key diff — no case
 * conversion. It flags:
 *   - LIVE-ONLY keys  → the mock omits something the real API sends (the BUG-1
 *     direction: the web may read it and crash in prod while tests pass).
 *   - MOCK-ONLY keys  → the mock invents a key the real API does not send
 *     (a spec can lean on it and never catch the real shape).
 *
 * Usage:
 *   # mock-only (no live API): just prints each endpoint's mock key-set
 *   node e2e/contract-check.mjs --mock-only
 *
 *   # full diff against a live API (e.g. qa117). Auth via env:
 *   LIVE_API=http://localhost:3047/api/v1 \
 *   LIVE_ACCESS_TOKEN=... LIVE_CLIENT=... LIVE_UID=... \
 *   node e2e/contract-check.mjs
 *
 * Exit code: non-zero if any drift is found (CI-friendly), 0 if clean.
 */
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const MOCK_PORT = Number(process.env.CONTRACT_MOCK_PORT || 4099);
const MOCK_BASE = `http://localhost:${MOCK_PORT}/api/v1`;
const MOCK_TOKEN = "mock-access-token"; // the FULL-data persona (server.mjs:58)

const LIVE_BASE = process.env.LIVE_API || "http://localhost:3047/api/v1";
const MOCK_ONLY = process.argv.includes("--mock-only");

/**
 * The main GETs. `pick` extracts the sample object whose keys we compare;
 * `nest` names sub-objects to also diff one level down. `auth` = send a token.
 */
const ENDPOINTS = [
  { path: "/listings", pick: (b) => b.listings?.[0], nest: ["seller", "shop"], auth: false },
  { path: "/categories", pick: (b) => b.categories?.[0], auth: false },
  { path: "/users/me", pick: (b) => b.user, auth: true },
  { path: "/blocks", pick: (b) => b.users?.[0], auth: true },
  { path: "/conversations", pick: (b) => b.conversations?.[0], nest: ["listing", "otherParticipant", "buyer", "seller", "sale"], auth: true },
  { path: "/my/listings", pick: (b) => b.listings?.[0], nest: ["sale", "posted_by"], auth: true },
  { path: "/my/saved_listings", pick: (b) => b.listings?.[0], auth: true },
  { path: "/my/hidden_listings", pick: (b) => b.listings?.[0], auth: true },
  { path: "/my/transactions", pick: (b) => b.transactions?.[0], nest: ["buyer", "seller", "listing"], auth: true },
  { path: "/my/reviews/pending", pick: (b) => (b.transactions ?? b.items)?.[0], nest: ["buyer", "seller", "listing"], auth: true },
  { path: "/users/saved_searches", pick: (b) => b.saved_searches?.[0], auth: true },
  { path: "/users/warnings", pick: (b) => b.warnings?.[0], auth: true },
  { path: "/my/shops", pick: (b) => b.shops?.[0], auth: true },
  { path: "/verification_requests/current", pick: (b) => b.verification_status ?? b.user, auth: true },
];

function headersFor(target, auth) {
  const h = { Accept: "application/json" };
  if (!auth) return h;
  if (target === "mock") {
    h["access-token"] = MOCK_TOKEN;
    return h;
  }
  if (process.env.LIVE_ACCESS_TOKEN) h["access-token"] = process.env.LIVE_ACCESS_TOKEN;
  if (process.env.LIVE_CLIENT) h["client"] = process.env.LIVE_CLIENT;
  if (process.env.LIVE_UID) h["uid"] = process.env.LIVE_UID;
  return h;
}

async function fetchKeys(base, target, ep) {
  const res = await fetch(`${base}${ep.path}`, { headers: headersFor(target, ep.auth) });
  if (!res.ok) return { error: `HTTP ${res.status}` };
  let body;
  try {
    body = await res.json();
  } catch {
    return { error: "not JSON" };
  }
  const sample = ep.pick(body);
  if (sample == null) return { empty: true };
  const top = Object.keys(sample).sort();
  const nested = {};
  for (const n of ep.nest ?? []) {
    if (sample[n] && typeof sample[n] === "object") nested[n] = Object.keys(sample[n]).sort();
  }
  return { top, nested };
}

function diff(aKeys = [], bKeys = []) {
  const a = new Set(aKeys);
  const b = new Set(bKeys);
  return {
    liveOnly: [...b].filter((k) => !a.has(k)),
    mockOnly: [...a].filter((k) => !b.has(k)),
  };
}

async function waitForMock() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`${MOCK_BASE}/categories`);
      if (r.ok) return;
    } catch {
      /* not up yet */
    }
    await sleep(250);
  }
  throw new Error("mock server did not come up");
}

async function main() {
  const mock = spawn("node", [join(HERE, "mock-api", "server.mjs")], {
    env: { ...process.env, MOCK_API_PORT: String(MOCK_PORT) },
    stdio: ["ignore", "ignore", "inherit"],
  });
  let drift = 0;
  try {
    await waitForMock();
    for (const ep of ENDPOINTS) {
      const m = await fetchKeys(MOCK_BASE, "mock", ep);
      if (MOCK_ONLY) {
        console.log(`\n${ep.path}`);
        if (m.error) console.log(`  mock: ${m.error}`);
        else if (m.empty) console.log("  mock: (empty — no sample row)");
        else {
          console.log(`  top: ${m.top.join(", ")}`);
          for (const [n, ks] of Object.entries(m.nested)) console.log(`  ${n}: ${ks.join(", ")}`);
        }
        continue;
      }
      const l = await fetchKeys(LIVE_BASE, "live", ep);
      console.log(`\n${ep.path}`);
      if (m.error || l.error) {
        console.log(`  SKIP — mock:${m.error ?? "ok"} live:${l.error ?? "ok"}`);
        continue;
      }
      if (m.empty || l.empty) {
        console.log(`  SKIP — no sample row (mock:${m.empty ? "empty" : "ok"} live:${l.empty ? "empty" : "ok"})`);
        continue;
      }
      const top = diff(m.top, l.top);
      if (top.liveOnly.length) { drift++; console.log(`  ⚠ LIVE-ONLY (mock omits, web may crash): ${top.liveOnly.join(", ")}`); }
      if (top.mockOnly.length) { drift++; console.log(`  ⚠ MOCK-ONLY (mock invents): ${top.mockOnly.join(", ")}`); }
      for (const n of Object.keys({ ...m.nested, ...l.nested })) {
        const nd = diff(m.nested[n], l.nested[n]);
        if (nd.liveOnly.length) { drift++; console.log(`  ⚠ ${n}.* LIVE-ONLY: ${nd.liveOnly.join(", ")}`); }
        if (nd.mockOnly.length) { drift++; console.log(`  ⚠ ${n}.* MOCK-ONLY: ${nd.mockOnly.join(", ")}`); }
      }
      if (!top.liveOnly.length && !top.mockOnly.length) console.log("  ✓ top-level keys match");
    }
  } finally {
    mock.kill("SIGTERM");
  }
  if (!MOCK_ONLY) {
    console.log(drift ? `\n${drift} drift(s) found.` : "\nNo drift.");
    process.exit(drift ? 1 : 0);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
