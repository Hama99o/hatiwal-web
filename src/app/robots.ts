import type { MetadataRoute } from "next";
import { SITE_URL as SITE } from "@/lib/env";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/"],
    },
    sitemap: `${SITE}/sitemap.xml`,
  };
}
