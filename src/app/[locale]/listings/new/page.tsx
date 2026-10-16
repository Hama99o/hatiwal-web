import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { RequireAuth } from "@/components/auth/require-auth";
import { ListingForm } from "@/components/listing/listing-form";
import { getCategories } from "@/lib/api/categories";
import { safe } from "@/lib/api/safe";

// Rendered per request, never prerendered: a build that cannot reach the API
// baked `categories: []` into this page, and every seller got a form with no
// categories to pick until the 600 s revalidation (e2e on a prod build, 1.1.7).
// The categories fetch keeps its own 600 s data cache, which never stores a failure.
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "listing" });
  return { title: t("create") };
}

export default async function NewListingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const categories = await safe(getCategories({ revalidate: 600 }), []);
  return (
    <RequireAuth>
      <ListingForm categories={categories} />
    </RequireAuth>
  );
}
