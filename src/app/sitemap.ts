import type { MetadataRoute } from "next";
import { getListings, EMPTY_LISTINGS } from "@/lib/api/listings";
import { getCategories, flattenCategories } from "@/lib/api/categories";
import { safe } from "@/lib/api/safe";
import { routing } from "@/i18n/routing";
import { SITE_URL as SITE } from "@/lib/env";
import { apiGet } from "@/lib/api/client";
import { localizedAlternates } from "@/lib/seo";

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
  // Only categories with stock: an empty one is noindexed (soft 404 otherwise),
  // and a sitemap must not list pages that ask not to be indexed. Subcategories
  // with stock are real landing pages too ("phones", "cars").
  const categories = flattenCategories(
    await safe(getCategories({ revalidate: 600, withCounts: true }), []),
  ).filter((c) => (c.activeListingsCount ?? 1) > 0);
  const shops = await safe(getVerifiedShops(), []);

  const entries: MetadataRoute.Sitemap = [];
  for (const locale of routing.locales) {
    // Each URL carries its hreflang set (en/ps/fa + x-default), the same one the
    // page itself declares, so the three languages read as one page.
    const add = (path: string, rest: Omit<MetadataRoute.Sitemap[number], "url">) =>
      entries.push({
        url: `${SITE}/${locale}${path}`,
        alternates: { languages: localizedAlternates(locale, path).languages as Record<string, string> },
        ...rest,
      });
    add("", { changeFrequency: "daily", priority: 1 });
    add("/bazaar", { changeFrequency: "hourly", priority: 0.9 });
    add("/categories", { changeFrequency: "weekly", priority: 0.6 });
    add("/download", { changeFrequency: "monthly", priority: 0.8 });
    add("/privacy", { changeFrequency: "monthly", priority: 0.3 });
    for (const c of categories) {
      add(`/categories/${c.slug}`, { changeFrequency: "daily", priority: 0.7 });
    }
    for (const s of shops) {
      add(`/shops/${s.id}`, {
        lastModified: s.updatedAt,
        changeFrequency: "weekly",
        priority: 0.7,
      });
    }
    for (const l of items) {
      add(`/listings/${l.id}`, {
        lastModified: l.updatedAt ?? l.createdAt,
        changeFrequency: "daily",
        priority: 0.8,
      });
    }
  }
  return entries;
}
