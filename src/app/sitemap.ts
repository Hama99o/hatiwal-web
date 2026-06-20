import type { MetadataRoute } from "next";
import { getListings, EMPTY_LISTINGS } from "@/lib/api/listings";
import { getCategories } from "@/lib/api/categories";
import { safe } from "@/lib/api/safe";
import { routing } from "@/i18n/routing";
import { SITE_URL as SITE } from "@/lib/env";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { items } = await safe(
    getListings({ status: "active", pageSize: 200, sort: "newest" }),
    EMPTY_LISTINGS,
  );
  const categories = await safe(getCategories(), []);

  const entries: MetadataRoute.Sitemap = [];
  for (const locale of routing.locales) {
    entries.push({ url: `${SITE}/${locale}`, changeFrequency: "daily", priority: 1 });
    entries.push({
      url: `${SITE}/${locale}/browse`,
      changeFrequency: "hourly",
      priority: 0.9,
    });
    entries.push({
      url: `${SITE}/${locale}/categories`,
      changeFrequency: "weekly",
      priority: 0.6,
    });
    for (const c of categories) {
      entries.push({
        url: `${SITE}/${locale}/categories/${c.slug}`,
        changeFrequency: "daily",
        priority: 0.7,
      });
    }
    for (const l of items) {
      entries.push({
        url: `${SITE}/${locale}/listings/${l.id}`,
        lastModified: l.updatedAt ?? l.createdAt,
        changeFrequency: "daily",
        priority: 0.8,
      });
    }
  }
  return entries;
}
