import { test, expect } from "@playwright/test";
import { googleFailureKey, googleUpstreamError } from "../src/lib/auth/google-error";
import en from "../messages/en.json";
import ps from "../messages/ps.json";
import fa from "../messages/fa.json";
import ur from "../messages/ur.json";

/*
 * Google sign-in errors (1.1.7, API docs/GOOGLE_SIGN_IN.md): the API's codes
 * pass the /api/auth/google proxy only when the reader has a sentence for
 * them; everything else stays "google_failed". Pure logic: no browser, no server.
 */
test("the proxy passes on only the codes the form can say", () => {
  expect(googleUpstreamError("google_email_unverified")).toBe("google_email_unverified");
  expect(googleUpstreamError("google_token_invalid")).toBe("google_failed");
  expect(googleUpstreamError(undefined)).toBe("google_failed");
  expect(googleUpstreamError({ evil: 1 })).toBe("google_failed");
});

test("an unverified Google address has its own sentence; the rest is the Google copy", () => {
  expect(googleFailureKey("google_email_unverified")).toBe("auth.google.emailUnverified");
  expect(googleFailureKey("google_failed")).toBe("auth.googleSignInFailed");
  expect(googleFailureKey(undefined)).toBe("auth.googleSignInFailed");
});

test("the sentence exists in all four locales", () => {
  for (const m of [en, ps, fa, ur] as Array<{ auth: { google?: { emailUnverified?: string } } }>) {
    expect(m.auth.google?.emailUnverified ?? "").not.toBe("");
  }
});
