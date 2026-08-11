import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getPublicSeller, type PublicSellerProfile } from "@/lib/api/users";
import { localizedAlternates } from "@/lib/seo";
import { safe } from "@/lib/api/safe";
import { UserIdentity } from "@/components/shared/user-identity";
import { ResponseRateBadge } from "@/components/shared/response-rate-badge";
import { AwayBanner } from "@/components/shared/away-banner";
import { HideForOwner, ViewerIdProvider } from "@/components/auth/owner-gate";
import { ReportButton } from "@/components/shared/report-button";
import { ShareButton } from "@/components/shared/share-button";
import { RatingDisplay } from "@/components/shared/rating-display";
import { LastActiveLabel } from "@/components/shared/last-active-label";
import { SellerListingsTabs } from "@/components/seller/seller-listings-tabs";
import { ReviewsSection } from "@/components/seller/reviews-section";
import { readViewerIdFromCookies } from "@/lib/auth/cookies";

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
  return {
    title: seller?.name ?? t("title"),
    alternates: localizedAlternates(locale, `/sellers/${id}`),
  };
}

export default async function SellerPage({ params }: { params: Params }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();

  // Public payload, fetched anonymously — so who is looking comes from the viewer
  // cookie beside the devise tokens (free: no Rails call, and this route is
  // already force-dynamic). It lets the owner-gated blocks below resolve during
  // SSR, so a seller opening their own profile never sees a frame of the
  // buyer-facing version of it first.
  const [{ seller, listings, totalCount }, viewerId] = await Promise.all([
    safe(getPublicSeller(id), EMPTY_SELLER),
    readViewerIdFromCookies(),
  ]);
  if (!seller) notFound();

  return (
    <ViewerIdProvider viewerId={viewerId}>
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="flex flex-col items-center gap-4 rounded-xl border bg-card p-8 text-center">
          <UserIdentity
            name={seller.name}
            avatarUrl={seller.avatarUrl}
            verified={seller.verified}
            subtitle={seller.city ?? t("seller.memberOnHatiwal")}
            layout="stacked"
            size={88}
            nameAs="h1"
          />
          <ResponseRateBadge
            responseRatePercent={seller.responseRatePercent}
            responseTimeLabel={seller.responseTimeLabel}
            className="mt-0 justify-center"
          />
          {/* The one and only score on this page — hero size, right under who
              they are, because it's the trust signal a buyer decides on. The
              reviews list below intentionally doesn't repeat it. */}
          <RatingDisplay
            avgRating={seller.avgRating}
            reviewCount={seller.reviewCount}
            size="lg"
          />
          <LastActiveLabel label={seller.lastActiveLabel} className="justify-center" />
          <div className="text-sm">
            <span className="block text-2xl font-bold text-foreground">
              {totalCount}
            </span>
            <span className="text-muted-foreground">
              {t("seller.activeListings")}
            </span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-4">
            {/* Share / copy-link for the public profile (mirrors mobile) — its
                own default size matches the 40px Report beside it. */}
            <ShareButton
              shareTitle={seller.name}
              text={t("seller.share.body", { name: seller.name })}
            />
            <ReportButton reportableType="User" reportableId={seller.id} />
          </div>
          {/* "This seller is away until…" sets a buyer's reply-time expectation.
              Shown to the seller themselves it is the site describing them in the
              third person, so it is owner-gated here exactly as on the listing
              page; they see their own away state as `profile.away.youAreAway`. */}
          <HideForOwner ownerId={seller.id}>
            <AwayBanner
              awayUntil={seller.sellerAwayUntil}
              className="w-full justify-center text-start"
            />
          </HideForOwner>
        </div>

        <SellerListingsTabs sellerId={seller.id} activeListings={listings} />

        <ReviewsSection sellerId={seller.id} />
      </div>
    </ViewerIdProvider>
  );
}
