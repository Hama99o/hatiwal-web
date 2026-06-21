import { setRequestLocale } from "next-intl/server";
import { RequireAuth } from "@/components/auth/require-auth";
import { ManageListingView } from "@/components/account/manage-listing-view";

export default async function ManageListingPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  return (
    <RequireAuth>
      <ManageListingView id={id} />
    </RequireAuth>
  );
}
