import { Suspense } from "react";
import { setRequestLocale } from "next-intl/server";
import { RequireAuth } from "@/components/auth/require-auth";
import { EditListingLoader } from "@/components/listing/edit-listing-loader";
import { getCategories } from "@/lib/api/categories";
import { safe } from "@/lib/api/safe";

export default async function EditListingPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const categories = await safe(getCategories({ revalidate: 600 }), []);
  return (
    <RequireAuth>
      {/* The loader reads ?relaunch (useSearchParams). */}
      <Suspense>
        <EditListingLoader id={id} categories={categories} />
      </Suspense>
    </RequireAuth>
  );
}
