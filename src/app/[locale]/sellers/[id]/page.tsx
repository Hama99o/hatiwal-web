import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PackageOpen } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getPublicSeller, type PublicSellerProfile } from "@/lib/api/users";
import { safe } from "@/lib/api/safe";
import { UserIdentity } from "@/components/shared/user-identity";
import { ListingGrid } from "@/components/shared/listing-grid";
import { EmptyState } from "@/components/shared/empty-state";
import { ReportButton } from "@/components/shared/report-button";

// Fresh per request so signed image URLs are valid on load (see home page note).
export const dynamic = "force-dynamic";

type Params = Promise<{ locale: string; id: string }>;

const EMPTY_SELLER: PublicSellerProfile = {
  seller: null,
  listings: [],
  totalCount: 0,
};

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { locale, id } = await params;
  const { seller } = await safe(getPublicSeller(id), EMPTY_SELLER);
  const t = await getTranslations({ locale, namespace: "seller" });
  return { title: seller?.name ?? t("title") };
}

export default async function SellerPage({ params }: { params: Params }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();

  const { seller, listings, totalCount } = await safe(
    getPublicSeller(id, { revalidate: 60 }),
    EMPTY_SELLER,
  );
  if (!seller) notFound();

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="flex flex-col items-center gap-4 rounded-xl border bg-card p-8 text-center">
        <UserIdentity
          name={seller.name}
          avatarUrl={seller.avatarUrl}
          verified={seller.verified}
          subtitle={seller.city ?? t("seller.memberOnHatiwal")}
          layout="stacked"
          size={88}
        />
        <div className="text-sm">
          <span className="block text-2xl font-bold text-foreground">
            {totalCount}
          </span>
          <span className="text-muted-foreground">
            {t("seller.activeListings")}
          </span>
        </div>
        <ReportButton reportableType="User" reportableId={seller.id} />
      </div>

      <h2 className="mb-4 mt-8 text-lg font-semibold">
        {t("seller.activeListings")}
      </h2>
      {listings.length > 0 ? (
        <ListingGrid listings={listings} priorityCount={5} />
      ) : (
        <EmptyState icon={PackageOpen} title={t("seller.noListings")} />
      )}
    </div>
  );
}
