import { setRequestLocale } from "next-intl/server";
import { RequireAuth } from "@/components/auth/require-auth";
import { ListingSalesView } from "@/components/account/listing-sales-view";

export default async function ListingSalesPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  return (
    <RequireAuth>
      <ListingSalesView id={id} />
    </RequireAuth>
  );
}
