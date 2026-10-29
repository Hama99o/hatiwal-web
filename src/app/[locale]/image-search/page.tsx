import { Suspense } from "react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { NOINDEX } from "@/lib/seo";
import { RequireAuth } from "@/components/auth/require-auth";
import { ImageSearchView } from "@/components/image-search/image-search-view";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "imageSearch" });
  // A result page for one buyer's photo: nothing here for a search engine.
  return { title: t("pageTitle"), robots: NOINDEX };
}

export default async function ImageSearchPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    // Web: signed-in only (see image-search-button.tsx for why).
    <RequireAuth>
      <Suspense>
        <ImageSearchView />
      </Suspense>
    </RequireAuth>
  );
}
