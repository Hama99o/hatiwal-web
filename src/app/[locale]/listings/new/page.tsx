import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { RequireAuth } from "@/components/auth/require-auth";
import { ListingForm } from "@/components/listing/listing-form";
import { getCategories, flattenCategories } from "@/lib/api/categories";
import { safe } from "@/lib/api/safe";

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
      <ListingForm categories={flattenCategories(categories)} />
    </RequireAuth>
  );
}
