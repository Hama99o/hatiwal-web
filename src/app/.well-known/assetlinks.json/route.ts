import { ANDROID_PACKAGE } from "@/lib/app-links";
// Android App Links: tells Android that https://hatiwal.com links (/l, /u, /s,
// /shops, /listings, /sellers, /join, and their locale-prefixed pages) belong
// to the Hatiwal app (app.json android.intentFilters, autoVerify). Android only
// trusts it with the app's SIGNING certificate fingerprint, which is the Play
// App Signing SHA-256 the owner reads in Play Console → App integrity. Until
// ANDROID_SHA256_CERT_FINGERPRINTS is set (comma-separated) this answers an
// empty list, so verification fails closed and links keep opening the website
// (today's behaviour) rather than trusting a wrong key.
// Must be JSON at this exact path with no redirect; the locale middleware skips dotted paths.

export const dynamic = "force-dynamic";

export function GET() {
  const fingerprints = (process.env.ANDROID_SHA256_CERT_FINGERPRINTS ?? "")
    .split(",")
    .map((f) => f.trim().toUpperCase())
    .filter((f) => /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/.test(f));
  if (fingerprints.length === 0) return Response.json([]);
  return Response.json([
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: { namespace: "android_app", package_name: ANDROID_PACKAGE, sha256_cert_fingerprints: fingerprints },
    },
  ]);
}
