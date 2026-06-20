import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  images: {
    // Rails Active Storage serves short-lived SIGNED urls that expire, so optimizing
    // /caching them is pointless and error-prone. Serve as-is in dev. For production,
    // move images to a stable CDN (S3/Cloudflare) and switch this off + add remotePatterns.
    unoptimized: true,
  },
};

export default withNextIntl(nextConfig);
