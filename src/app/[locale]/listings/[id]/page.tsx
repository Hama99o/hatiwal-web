import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Eye, Heart, MapPin } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getListing, getListings, EMPTY_LISTINGS } from "@/lib/api/listings";
import { localizedAlternates } from "@/lib/seo";
import { categoryName } from "@/lib/api/categories";
import { safe } from "@/lib/api/safe";
import { formatPrice, formatRelativeDate } from "@/lib/format";
import { PriceTag } from "@/components/shared/price-tag";
import { StatusBadge } from "@/components/shared/status-badge";
import { ConditionBadge } from "@/components/shared/condition-badge";
import { PriceDropBadge } from "@/components/shared/price-drop-badge";
import { FirmPriceBadge } from "@/components/shared/firm-price-badge";
import { CategoryBadge } from "@/components/shared/category-badge";
import { UserIdentity } from "@/components/shared/user-identity";
import { RatingDisplay } from "@/components/shared/rating-display";
import { LastActiveLabel } from "@/components/shared/last-active-label";
import { ResponseRateBadge } from "@/components/shared/response-rate-badge";
import { AwayBanner } from "@/components/shared/away-banner";
import { StartConversationButton } from "@/components/chat/start-conversation-button";
import { SaveButton } from "@/components/shared/save-button";
import { ReportButton } from "@/components/shared/report-button";
import { ShareButton } from "@/components/shared/share-button";
import { SafetyTips } from "@/components/shared/safety-tips";
import { SellerPhoneReveal } from "@/components/listing/seller-phone-reveal";
import { HideListingButton } from "@/components/listing/hide-listing-button";
import { ListingGallery } from "@/components/listing/listing-gallery";
import { RecordListingView } from "@/components/listing/record-listing-view";
import { ListingGrid } from "@/components/shared/listing-grid";
import { LocationMap } from "@/components/map/location-map";
import { Separator } from "@/components/ui/separator";

// Fresh per request so signed image URLs are valid on load (see home page note).
export const dynamic = "force-dynamic";

type Params = Promise<{ locale: string; id: string }>;

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { locale, id } = await params;
  const alternates = localizedAlternates(locale, `/listings/${id}`);
  const listing = await safe(getListing(id), null);
  if (!listing) return { title: "Hatiwal", alternates };

  const description =
    listing.description?.slice(0, 200) || listing.title;
  return {
    title: listing.title,
    description,
    alternates,
    openGraph: {
      title: listing.title,
      description,
      images: listing.images.slice(0, 1),
      type: "website",
    },
  };
}

export default async function ListingDetailPage({
  params,
}: {
  params: Params;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();

  // No revalidate: these payloads carry short-lived signed Active Storage image
  // URLs; caching them serves expired URLs → 404 broken photos. Page is dynamic.
  const listing = await safe(getListing(id), null);
  if (!listing) notFound();

  const similar = listing.categoryId
    ? (
        await safe(
          getListings({
            categoryId: listing.categoryId,
            status: "active",
            pageSize: 12,
          }),
          EMPTY_LISTINGS,
        )
      ).items
        .filter((l) => l.id !== listing.id)
        .slice(0, 5)
    : [];

  const isActive = listing.status === "active";

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: listing.title,
    description: listing.description ?? undefined,
    image: listing.images,
    category: listing.category ? categoryName(listing.category, "en") : undefined,
    offers: {
      "@type": "Offer",
      price: listing.price,
      priceCurrency: listing.currency,
      availability:
        listing.status === "sold"
          ? "https://schema.org/SoldOut"
          : "https://schema.org/InStock",
    },
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {/* Records this open into Recently Viewed for logged-in users (no-op for
          guests) — the SSR fetch above is a guest, so Rails can't attribute it. */}
      <RecordListingView id={listing.id} />


      <div className="grid gap-8 lg:grid-cols-2">
        <ListingGallery images={listing.images} title={listing.title} />

        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            {!isActive && <StatusBadge status={listing.status} />}
            {listing.priceDropPercent ? (
              <PriceDropBadge percent={listing.priceDropPercent} />
            ) : null}
            {listing.condition && (
              <ConditionBadge condition={listing.condition} />
            )}
            {/* Share / copy-link — shown for every status (mirrors mobile). */}
            <ShareButton
              shareTitle={listing.title}
              text={t("listing.share.body", {
                title: listing.title,
                price: formatPrice(listing.price, listing.currency, locale),
              })}
              className="ms-auto"
            />
          </div>

          <div className="space-y-2">
            <PriceTag
              price={listing.price}
              currency={listing.currency}
              size="lg"
            />
            {/* Firm-price badge — quiet trust signal when negotiable is false */}
            <FirmPriceBadge negotiable={listing.negotiable} />
            <h1 className="text-pretty text-xl font-bold sm:text-2xl">
              {listing.title}
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            {listing.category && (
              <CategoryBadge category={listing.category} asLink />
            )}
            <span className="inline-flex items-center gap-1">
              <Eye className="size-4" />
              {t("listing.viewsCount", { count: listing.viewsCount })}
            </span>
            {listing.savesCount != null && listing.savesCount > 0 && (
              <span className="inline-flex items-center gap-1">
                <Heart className="size-4" />
                {t("listing.savesCount", { count: listing.savesCount })}
              </span>
            )}
            <span>
              {t("listing.postedAgo", {
                date: formatRelativeDate(listing.createdAt, locale),
              })}
            </span>
          </div>

          {listing.location && (
            <div className="space-y-2 rounded-lg border bg-card p-3">
              <div className="flex items-start gap-2 text-sm">
                <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{t("listing.detail.location")}</p>
                  <p className="text-muted-foreground">{listing.location}</p>
                  {/* Specific meetup address, when the seller gave one. */}
                  {listing.address && (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {listing.address}
                    </p>
                  )}
                </div>
              </div>
              {listing.latitude != null && listing.longitude != null && (
                <LocationMap
                  lat={listing.latitude}
                  lng={listing.longitude}
                  zoom={14}
                  className="h-48"
                />
              )}
            </div>
          )}

          {/* Seller */}
          {listing.seller && (
            <div className="rounded-lg border bg-card p-4">
              <p className="mb-3 text-sm font-medium text-muted-foreground">
                {t("listing.detail.seller")}
              </p>
              <UserIdentity
                name={listing.seller.name}
                avatarUrl={listing.seller.avatarUrl}
                verified={listing.seller.verified}
                subtitle={listing.seller.city}
                href={`/sellers/${listing.seller.id}`}
                size={48}
              />
              <RatingDisplay
                avgRating={listing.seller.avgRating}
                reviewCount={listing.seller.reviewCount}
                className="mt-3"
              />
              <ResponseRateBadge
                responseRatePercent={listing.seller.responseRatePercent}
                responseTimeLabel={listing.seller.responseTimeLabel}
              />
              <LastActiveLabel
                label={listing.seller.lastActiveLabel}
                className="mt-2"
              />
              <AwayBanner
                awayUntil={listing.seller.sellerAwayUntil}
                className="mt-3"
              />
            </div>
          )}

          {/* Actions — primary CTA (message seller) first, Save below it. */}
          {isActive ? (
            <div className="space-y-2">
              <StartConversationButton
                listingId={listing.id}
                sellerId={listing.seller?.id}
                price={listing.price}
                currency={listing.currency}
                negotiable={listing.negotiable}
              />
              <SellerPhoneReveal
                phone={listing.seller?.phone}
                sellerId={listing.seller?.id}
              />
            </div>
          ) : (
            <div className="rounded-lg border bg-muted/50 p-4 text-center text-sm font-medium text-muted-foreground">
              {listing.status === "sold"
                ? t("listing.detail.soldNotice")
                : t("listing.detail.reservedNotice")}
            </div>
          )}
          <SaveButton
            listingId={listing.id}
            initialSaved={listing.isSaved}
            ownerId={listing.seller?.id}
            variant="detail"
          />
          {/* No payment/delivery — deals happen in person, so surface meet-safely
              guidance right by the contact actions (mirrors mobile). "Not
              interested" hides the listing from the buyer's feed. */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <SafetyTips />
            <HideListingButton
              listingId={listing.id}
              ownerId={listing.seller?.id}
            />
          </div>

        </div>
      </div>

      {listing.description && (
        <section className="mt-10 max-w-3xl">
          <h2 className="text-lg font-semibold">
            {t("listing.detail.description")}
          </h2>
          <Separator className="my-3" />
          <p className="whitespace-pre-line text-pretty text-sm leading-relaxed text-foreground">
            {listing.description}
          </p>
        </section>
      )}

      <div className="mt-8 max-w-3xl">
        <ReportButton
          reportableType="Listing"
          reportableId={listing.id}
          ownerId={listing.seller?.id}
        />
      </div>

      {similar.length > 0 && (
        <section className="mt-12">
          <h2 className="mb-4 text-lg font-semibold">{t("home.recent")}</h2>
          <ListingGrid listings={similar} />
        </section>
      )}
    </div>
  );
}
