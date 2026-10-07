import { Suspense } from "react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { RequireAuth } from "@/components/auth/require-auth";
import { SellerAnalyticsView } from "@/components/account/seller-analytics-view";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "seller.analytics" });
  return { title: t("title") };
}

/** Item 2: a seller's numbers, Me or one shop (`?shop=`). */
export default async function SellerAnalyticsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <RequireAuth>
      {/* The view reads ?shop (useSearchParams). */}
      <Suspense>
        <SellerAnalyticsView />
      </Suspense>
    </RequireAuth>
  );
}
