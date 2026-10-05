import type { MetadataRoute } from "next";
import { getListings, EMPTY_LISTINGS } from "@/lib/api/listings";
import { getCategories } from "@/lib/api/categories";
import { safe } from "@/lib/api/safe";
import { routing } from "@/i18n/routing";
import { SITE_URL as SITE } from "@/lib/env";
import { apiGet } from "@/lib/api/client";

/** SHOP-1: verified shops go in the sitemap (GET /shops?verified=true, guest). */
async function getVerifiedShops(): Promise<{ id: number; updatedAt?: string }[]> {
  const d = await apiGet<{ shops: { id: number; updatedAt?: string }[] }>("shops", {
    params: { verified: true, "page[size]": 100 },
    revalidate: 3600,
  });
  return d.shops ?? [];
}

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { items } = await safe(
    getListings({ pageSize: 200, sort: "newest" }),
    EMPTY_LISTINGS,
  );
  const categories = await safe(getCategories(), []);
  const shops = await safe(getVerifiedShops(), []);

  const entries: MetadataRoute.Sitemap = [];
  for (const locale of routing.locales) {
    entries.push({ url: `${SITE}/${locale}`, changeFrequency: "daily", priority: 1 });
    entries.push({
      url: `${SITE}/${locale}/bazaar`,
      changeFrequency: "hourly",
      priority: 0.9,
    });
    entries.push({
      url: `${SITE}/${locale}/categories`,
      changeFrequency: "weekly",
      priority: 0.6,
    });
    entries.push({
      url: `${SITE}/${locale}/download`,
      changeFrequency: "monthly",
      priority: 0.8,
    });
    for (const c of categories) {
      entries.push({
        url: `${SITE}/${locale}/categories/${c.slug}`,
        changeFrequency: "daily",
        priority: 0.7,
      });
    }
    for (const s of shops) {
      entries.push({
        url: `${SITE}/${locale}/shops/${s.id}`,
        lastModified: s.updatedAt,
        changeFrequency: "weekly",
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
