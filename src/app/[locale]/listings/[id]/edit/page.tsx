import { setRequestLocale } from "next-intl/server";
import { RequireAuth } from "@/components/auth/require-auth";
import { EditListingLoader } from "@/components/listing/edit-listing-loader";
import { getCategories, flattenCategories } from "@/lib/api/categories";
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
      <EditListingLoader id={id} categories={flattenCategories(categories)} />
    </RequireAuth>
  );
}
