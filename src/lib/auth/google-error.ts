/**
 * Google sign-in errors (1.1.7; API docs/GOOGLE_SIGN_IN.md). The API answers a
 * refused token with a `code`; the /api/auth/google proxy passes on only the
 * ones the form has a sentence for, everything else stays "google_failed".
 * Same mapping as mobile's googleSignInError.
 */
const SENTENCES: Record<string, string> = {
  google_email_unverified: "auth.google.emailUnverified",
};

/** The `error` the proxy returns for the API's `code`. */
export function googleUpstreamError(code: unknown): string {
  return typeof code === "string" && code in SENTENCES ? code : "google_failed";
}

/** The message key for the proxy's `error` (after authFailureKey's shared ones). */
export function googleFailureKey(error: string | undefined): string {
  return (error && SENTENCES[error]) || "auth.googleSignInFailed";
}
