import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Clock } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getPublicSeller, type PublicSellerProfile } from "@/lib/api/users";
import { safe } from "@/lib/api/safe";
import { UserIdentity } from "@/components/shared/user-identity";
import { ResponseRateBadge } from "@/components/shared/response-rate-badge";
import { AwayBanner } from "@/components/shared/away-banner";
import { ReportButton } from "@/components/shared/report-button";
import { ShareButton } from "@/components/shared/share-button";
import { SellerListingsTabs } from "@/components/seller/seller-listings-tabs";

// Fresh per request so signed image URLs are valid on load (see home page note).
export const dynamic = "force-dynamic";

type Params = Promise<{ locale: string; id: string }>;

const EMPTY_SELLER: PublicSellerProfile = {
  seller: null,
  listings: [],
  totalCount: 0,
};

// Maps the privacy-safe `lastActiveLabel` recency bucket from Rails to a
// localized string key. Unknown/null buckets omit the label entirely (no raw
// timestamp is ever shown). Mirrors mobile's activeLabelUtil.
const ACTIVE_LABEL_KEYS: Record<string, string> = {
  today: "seller.activeRecently.today",
  this_week: "seller.activeRecently.thisWeek",
  this_month: "seller.activeRecently.thisMonth",
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
    getPublicSeller(id),
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
        <ResponseRateBadge
          responseRatePercent={seller.responseRatePercent}
          responseTimeLabel={seller.responseTimeLabel}
          className="mt-0 justify-center"
        />
        {ACTIVE_LABEL_KEYS[seller.lastActiveLabel ?? ""] && (
          <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="size-3.5 shrink-0" />
            <span>{t(ACTIVE_LABEL_KEYS[seller.lastActiveLabel!])}</span>
          </div>
        )}
        <div className="text-sm">
          <span className="block text-2xl font-bold text-foreground">
            {totalCount}
          </span>
          <span className="text-muted-foreground">
            {t("seller.activeListings")}
          </span>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-4">
          {/* Share / copy-link for the public profile (mirrors mobile). */}
          <ShareButton
            shareTitle={seller.name}
            text={t("seller.share.body", { name: seller.name })}
          />
          <ReportButton reportableType="User" reportableId={seller.id} />
        </div>
        <AwayBanner
          awayUntil={seller.sellerAwayUntil}
          className="w-full justify-center text-start"
        />
      </div>

      <SellerListingsTabs sellerId={seller.id} activeListings={listings} />
    </div>
  );
}
