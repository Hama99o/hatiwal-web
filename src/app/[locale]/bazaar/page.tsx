import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getListings } from "@/lib/api/listings";
import { localizedAlternates } from "@/lib/seo";
import { getCategories } from "@/lib/api/categories";
import { safe } from "@/lib/api/safe";
import type { ListingsResult } from "@/lib/types";
import { BrowseClient } from "@/components/browse/browse-client";
import { filtersFromParams, filtersToQuery } from "@/components/browse/filters";

// Search-driven + client data fetching → render on request (SSR), not prerendered.
export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function firstValues(
  sp: Record<string, string | string[] | undefined>,
): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(sp)) {
    out[k] = Array.isArray(v) ? v[0] : v;
  }
  return out;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "browse" });
  return {
    title: t("title"),
    alternates: localizedAlternates(locale, "/bazaar"),
  };
}

export default async function BrowsePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: SearchParams;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const sp = firstValues(await searchParams);
  const categories = await safe(getCategories({ revalidate: 600 }), []);
  const filters = filtersFromParams(sp);

  // Pass null (not empty) on failure so the client island can retry via the
  // proxy and surface a real error/loading state instead of a false "no results".
  // NOTE: no `revalidate` here — the payload contains short-lived signed Active
  // Storage image URLs. Caching them (even 60s) serves expired URLs → 404 broken
  // thumbnails. The page is force-dynamic, so fetch fresh every request.
  //
  // This seed is ANONYMOUS ON PURPOSE, even though the request carries the
  // viewer's cookies and Rails personalises this endpoint. devise rotates the
  // access token on every authed request and an RSC cannot write the rotated
  // cookie back to the browser, so fetching as the viewer here would leave the
  // browser holding a token Rails has already replaced — i.e. it manufactures
  // the 401 that signs a valid session out. BrowseClient reconciles instead: it
  // treats this payload as stale for an authed viewer and refetches through the
  // /api/me proxy on mount (see `getListingsAsViewer`).
  let initialResult: ListingsResult | null = null;
  try {
    initialResult = await getListings(filtersToQuery(filters, categories, 1));
  } catch {
    initialResult = null;
  }

  // BrowseClient already renders its own `mx-auto max-w-7xl px-4 py-6` wrapper —
  // no outer container here, or the page gets doubled padding/inset.
  return (
    <BrowseClient
      initialResult={initialResult}
      initialFilters={filters}
      categories={categories}
    />
  );
}
