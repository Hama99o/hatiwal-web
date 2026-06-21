import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // Self-contained server build for a slim production Docker image: emits
  // .next/standalone/server.js with only the deps it needs (no full node_modules).
  output: "standalone",
  // Lets E2E run an isolated build (NEXT_DIST_DIR=.next-e2e) without clobbering a
  // concurrently-running `npm run dev` (.next). Defaults to the normal dir.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  images: {
    // Rails Active Storage serves short-lived SIGNED urls that expire, so optimizing
    // /caching them is pointless and error-prone. Serve as-is in dev. For production,
    // move images to a stable CDN (S3/Cloudflare) and switch this off + add remotePatterns.
    unoptimized: true,
  },
};

export default withNextIntl(nextConfig);
