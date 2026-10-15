import type { Metadata } from "next";
import { smartAppBanner } from "@/lib/app-links";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { Eye, Heart, MapPin } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getListing, getSimilarListings } from "@/lib/api/listings";
import { jsonLdHtml, localizedAlternates } from "@/lib/seo";
import { SITE_URL } from "@/lib/env";
import type { ListingCondition } from "@/lib/types";
import { categoryName } from "@/lib/api/categories";
import { safe, unlessNotFound } from "@/lib/api/safe";
import { formatPrice, formatRelativeDate } from "@/lib/format";
import { PriceTag } from "@/components/shared/price-tag";
import { StatusBadge } from "@/components/shared/status-badge";
import { ConditionBadge } from "@/components/shared/condition-badge";
import { StayFacts } from "@/components/listing/stay-facts";
import { isStayCategory } from "@/lib/stays";
import { PriceDropBadge } from "@/components/shared/price-drop-badge";
import { FirmPriceBadge } from "@/components/shared/firm-price-badge";
import { StockBadge } from "@/components/shared/stock-badge";
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
import { UnavailableActions } from "@/components/listing/unavailable-actions";
import { OwnerListingBar } from "@/components/listing/owner-listing-bar";
import { HideForOwner, OwnerShopScope, ViewerIdProvider } from "@/components/auth/owner-gate";
import { HideListingButton } from "@/components/listing/hide-listing-button";
import { ListingActionBar } from "@/components/listing/listing-action-bar";
import { ListingGallery } from "@/components/listing/listing-gallery";
import { RecordListingView } from "@/components/listing/record-listing-view";
import {
  CrossSellRails,
  CrossSellRailsSkeleton,
} from "@/components/listing/cross-sell-rails";
import { LocationMap } from "@/components/map/location-map";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { readViewerIdFromCookies } from "@/lib/auth/cookies";
import { availableUnitsOf, hasStockToShow, isLive } from "@/lib/stock";
import { userTextProps } from "@/lib/text-direction";
import { profileHrefFor } from "@/lib/identity";

// Fresh per request so signed image URLs are valid on load (see home page note).
export const dynamic = "force-dynamic";

type Params = Promise<{ locale: string; id: string }>;

/** schema.org's item conditions. Only brand_new is new; the rest are used. */
const CONDITION_SCHEMA: Record<ListingCondition, string> = {
  brand_new: "https://schema.org/NewCondition",
  like_new: "https://schema.org/UsedCondition",
  good: "https://schema.org/UsedCondition",
  fair: "https://schema.org/UsedCondition",
};

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
    // iPhone: Safari's Smart App Banner — "Open" when Hatiwal is installed
    // (lands on this listing), "Get" when it is not. See lib/app-links.ts.
    itunes: smartAppBanner({ kind: "listing", id }),
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
  //
  // The viewer id rides in its own cookie next to the (httpOnly) devise tokens, so
  // reading it costs nothing — no Rails round-trip, and this route is already
  // `force-dynamic`. It's what lets the owner-gated controls below decide ownership
  // during SSR instead of after the browser's session probe: the seller of this
  // item gets their own panel in the FIRST paint, rather than watching "Message
  // Seller", the save heart and the buyer safety tips flash past first.
  // 404 → the "no longer available" page; a 500 / Rails down → the error
  // boundary with Retry, never "404".
  const [listing, viewerId] = await Promise.all([
    unlessNotFound(getListing(id), null),
    readViewerIdFromCookies(),
  ]);
  if (!listing) notFound();

  /**
   * privacy-b: a SHOP listing's seller is the shop's face — `id: null` for anyone
   * outside the team, and this SSR fetch is anonymous, so it is null for the shop
   * owner too. Ownership of a shop listing is therefore membership of its shop
   * (`ownerShopId`, resolved against the signed-in user's `shops`); every
   * owner-gated control below takes both.
   */
  const sellerId = listing.seller?.id ?? undefined;
  const sellerShopId =
    listing.shop?.id ?? listing.seller?.shopId ?? listing.shopId ?? null;
  /**
   * LIVE, not "active" — the single most important line on this page.
   *
   * `active` and `reserved` are both on the market: browsable, searchable and
   * message-able. Only `sold` is terminal. This page used to gate its whole buyer
   * CTA block on `status === "active"`, so a reserved listing — which the feed and
   * search still hand out — showed the "see similar" recovery card and NO way to
   * contact the seller. A buyer found the item, opened it, and hit a wall.
   *
   * That is the thing no marketplace does: with no payment holding a deal
   * together, reservations fall through constantly, and the second interested
   * buyer is the seller's recovery path. So a held listing keeps its Message
   * button and shows a "Reserved" ribbon (the <StatusBadge> below) instead of
   * disappearing behind a dead end.
   */
  const isLiveListing = isLive(listing);
  const isSold = listing.status === "sold";
  /**
   * Offers, unlike messaging, DO pause while a hold is in place — a deliberate
   * split of two signals that used to be one boolean. Anyone may still ask "is
   * this still available?", but starting a fresh price negotiation against a
   * hold the seller has already agreed in principle sets two buyers bidding over
   * an item that is spoken for. Vinted behaves the same way.
   */
  const offersPaused = listing.status === "reserved";

  // Recovery-CTA gate. <UnavailableActions> must never promise stock that isn't
  // there — "See similar in Clothes & Fashion" landing on an empty Bazaar is the
  // very dead end this card removes — so it is handed the live stock its CTA
  // would show. That is exactly the `similar_to` set <CrossSellRails> renders
  // below, and both call sites issue the identical GET, so Next's per-render
  // fetch memoization makes this one request, not two. Only awaited for a
  // sold/reserved listing: an active one never renders the card, and the rail
  // keeps streaming behind its own <Suspense>.
  const similarStock = isLiveListing
    ? []
    : await safe(getSimilarListings(listing.id), []);

  // Product + Offer structured data. Google reads it twice: "Product snippets"
  // (price/availability under the result) and "Merchant listings" (Shopping).
  // Merchant listings REQUIRE `image`, and 41 of 54 live listings had no photo
  // (Search Console, 2026-10-12: 31 merchant listings "invalid"), so a listing
  // without a photo emits no Product at all rather than an invalid one — a
  // placeholder picture would be a false image of the item. Shipping and
  // returns are declared as what they are, which clears Google's two
  // "missing field" warnings without inventing a policy: the item does not
  // ship (buyers meet the seller) and it cannot be returned. See docs/SEO.md.
  const pageUrl = `${SITE_URL}/${locale}/listings/${listing.id}`;
  // The country the listing is sold in, from its currency (USD listings are
  // Afghan: the dollar circulates there).
  const saleCountry = listing.currency === "PKR" ? "PK" : "AF";
  const jsonLd =
    listing.images.length > 0 && Number(listing.price) > 0
      ? {
          "@context": "https://schema.org",
          "@type": "Product",
          name: listing.title,
          description: listing.description || listing.title,
          image: listing.images,
          url: pageUrl,
          category: listing.category ? categoryName(listing.category, "en") : undefined,
          offers: {
            "@type": "Offer",
            url: pageUrl,
            price: Number(listing.price),
            priceCurrency: listing.currency,
            availability: isSold
              ? "https://schema.org/SoldOut"
              : "https://schema.org/InStock",
            itemCondition: listing.condition
              ? CONDITION_SCHEMA[listing.condition]
              : undefined,
            shippingDetails: {
              "@type": "OfferShippingDetails",
              doesNotShip: true,
              shippingDestination: { "@type": "DefinedRegion", addressCountry: saleCountry },
            },
            hasMerchantReturnPolicy: {
              "@type": "MerchantReturnPolicy",
              applicableCountry: saleCountry,
              returnPolicyCategory: "https://schema.org/MerchantReturnNotPermitted",
            },
            // A shop is a public business; a private seller is not named here.
            seller: listing.shop
              ? { "@type": "Organization", name: listing.shop.name }
              : undefined,
          },
        }
      : null;
  // Stays (api STAYS_DESIGN §2.7): the same Offer, multi-typed as the room it
  // is, priced per night/month, with only what is known — guests and
  // amenities. No condition and no shipping fields: a room is neither.
  const isStay = isStayCategory(listing.category);
  const details = listing.details ?? {};
  const structuredData =
    jsonLd && isStay
      ? {
          "@context": "https://schema.org",
          "@type": ["Product", listing.category?.slug === "hotel-rooms" ? "HotelRoom" : "Accommodation"],
          name: listing.title,
          description: listing.description || listing.title,
          image: listing.images,
          url: pageUrl,
          category: listing.category ? categoryName(listing.category, "en") : undefined,
          occupancy: details.guests
            ? { "@type": "QuantitativeValue", maxValue: details.guests, unitText: "guests" }
            : undefined,
          amenityFeature: (details.amenities ?? []).map((a) => ({
            "@type": "LocationFeatureSpecification",
            name: a.replace(/_/g, " "),
            value: true,
          })),
          offers: {
            "@type": "Offer",
            url: pageUrl,
            price: Number(listing.price),
            priceCurrency: listing.currency,
            priceSpecification: {
              "@type": "UnitPriceSpecification",
              price: Number(listing.price),
              priceCurrency: listing.currency,
              unitText: listing.priceUnit ?? "night",
            },
            seller: listing.shop ? { "@type": "Organization", name: listing.shop.name } : undefined,
          },
        }
      : jsonLd;

  // The room the sticky <ListingActionBar> needs is reserved by the bar itself
  // (it renders its own spacer), not by padding here: only that component knows
  // whether a bar exists at all — it self-suppresses on desktop, on a
  // sold/reserved listing, and for the seller's own listing — and static padding
  // gave all three a strip of dead space above the footer.
  return (
    <ViewerIdProvider
      viewerId={viewerId}
      ownerShop={listing.shop ? { ownerId: listing.seller?.id, shopId: listing.shop.id } : null}
    >
      <div className="mx-auto max-w-6xl px-4 py-6">
        {structuredData && (
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: jsonLdHtml(structuredData) }}
          />
        )}
        {/* Records this open into Recently Viewed for logged-in users (no-op for
            guests) — the SSR fetch above is a guest, so Rails can't attribute it. */}
        <RecordListingView id={listing.id} />


        {/* Desktop: gallery + description on the left, the buy box then seller and
            location on the right, spanning both rows. Phones (one column, `order`):
            gallery → buy box → description → seller/location. */}
        <div className="grid gap-8 lg:grid-cols-2 lg:grid-rows-[auto_1fr]">
          {/* Sold stock is dimmed, photo and price both (DESIGN_SYSTEM §2), so
              the page reads as an archive at a glance instead of looking like a
              live offer with a notice bolted on. Reserved keeps full strength —
              a reservation can fall through. */}
          <div className="order-1 min-w-0 lg:order-none lg:col-start-1 lg:row-start-1">
            <ListingGallery
              images={listing.images}
              mediums={listing.imageMediums}
              thumbs={listing.imageThumbs}
              title={listing.title}
              dimmed={isSold}
            />
          </div>

          {/* `contents` on phones: its two halves become items of the one-column
              grid so they can be ordered around the description (buy box →
              description → seller/location). From lg it is the right column. */}
          <div className="contents lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:block lg:min-w-0 lg:space-y-5">
          <div className="order-2 min-w-0 space-y-5 lg:order-none">
            {/* `empty:hidden`: with no badge to show this row used to hold only the
                share button — a whole phone row for "Copy link". */}
            <div className="flex flex-wrap items-center gap-2 empty:hidden">
              {/* The RIBBON. Kept for `reserved` as well as `sold`/`draft` —
                  under the three-state model this badge IS how a hold is shown:
                  the listing stays live and simply says "Reserved". */}
              {!isLiveListing || offersPaused ? (
                <StatusBadge status={listing.status} />
              ) : null}
              {listing.priceDropPercent ? (
                <PriceDropBadge percent={listing.priceDropPercent} />
              ) : null}
              {listing.condition && (
                <ConditionBadge condition={listing.condition} />
              )}
            </div>

            {/* `id="listing-price"` is the price anchor <ListingActionBar>
                watches: while this block is on screen the sticky bar shows no
                price of its own, so the same number never appears twice. */}
            <div id="listing-price" className="space-y-2">
              <div className="flex items-start justify-between gap-3">
                <PriceTag
                  price={listing.price}
                  unit={listing.priceUnit}
                  currency={listing.currency}
                  size="lg"
                  tone={isSold ? "muted" : "default"}
                  perUnit={hasStockToShow(listing)}
                />
                {/* Share / copy-link — shown for every status (mirrors mobile),
                    beside the price instead of on a row of its own. */}
                <ShareButton
                  shareTitle={listing.title}
                  text={t("listing.share.body", {
                    title: listing.title,
                    price: formatPrice(listing.price, listing.currency, locale),
                  })}
                />
              </div>
              {/* Firm-price badge — quiet trust signal when negotiable is false */}
              <FirmPriceBadge negotiable={listing.negotiable} />
              {/* Stock — the buyer who assumed "1" learns otherwise BEFORE they
                  message, which is the moment the spike identifies as where the
                  harm currently happens. Nothing renders for a single-item
                  listing. Detail only, never the feed card: same reasoning as
                  mobile (a reserved chip slot would grow every card in the grid,
                  including the single-item majority). */}
              <StockBadge listing={listing} />
              <h1 className="text-pretty text-xl font-bold sm:text-2xl" {...userTextProps(listing.title)} data-testid="listing-title">
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

            {/* Owner-only panel — renders null for buyers/guests.
                Every buyer control further down self-hides for the seller, so
                without this their own listing has no actions at all. It sits here,
                directly under the price/meta block, because the owner is also the
                one viewer <ListingActionBar> never pins a sticky CTA for: parked
                below the map and the seller card it would have been two screens
                down with nothing to bring it back into reach. */}
            <OwnerListingBar
              listingId={listing.id}
              sellerId={sellerId}
              ownerShopId={sellerShopId}
              status={listing.status}
              expiresAt={listing.expiresAt}
              expired={listing.expired}
              conversationsCount={listing.conversationsCount}
              category={listing.category}
            />

            {/* Actions — primary CTA (message seller) first, Save below it.
                `id="listing-actions"` is the sentinel <ListingActionBar> watches:
                while this block is on screen the sticky mobile bar stays hidden.

                BUYER-ONLY, gated as a whole. Every control inside self-hides for
                the seller of the item (`StartConversationButton`,
                `SellerPhoneReveal`, `UnavailableActions`, `SaveButton`), so for
                an owner the block used to render as an empty wrapper around an
                empty inner div — two real boxes, i.e. the column's `space-y-5`
                paying 20px on each side of nothing: ~40px of dead space between
                the seller card and the description. Gating the wrapper itself
                removes the boxes with the content (the same treatment the
                safety-tips row below gets from `empty:hidden`). Dropping the
                sentinel with them is safe: it is only read for intersection, and
                <ListingActionBar> self-suppresses for the owner anyway.

                HideForOwner keeps the gate client-side, so the children — most
                importantly <UnavailableActions> — stay Server Components on this
                SEO landing page, and the SSR viewer hint means the owner never
                gets a frame of buyer UI. */}
            <HideForOwner ownerId={sellerId} ownerShopId={sellerShopId}>
              <div id="listing-actions" className="space-y-5">
                {isLiveListing ? (
                  <div className="space-y-2">
                    <StartConversationButton
                      isShop={!!listing.shop}
                      listingId={listing.id}
                      sellerId={sellerId}
                      ownerShopId={sellerShopId}
                      price={listing.price}
                      perUnit={hasStockToShow(listing)}
                      currency={listing.currency}
                      negotiable={listing.negotiable}
                      offersPaused={offersPaused}
                      availableUnits={availableUnitsOf(listing)}
                    />
                    {/* Why a listing marked "Reserved" still has a Message
                        button. Without this the badge and the live CTA read as a
                        contradiction; with it the buyer knows exactly what they
                        are doing — getting in line in case the deal falls
                        through, which is common enough to be worth their time. */}
                    {offersPaused && (
                      <p className="text-xs text-muted-foreground">
                        {t("listing.detail.reservedStillAvailableNote")}
                      </p>
                    )}
                    <SellerPhoneReveal
                      phone={listing.seller?.phone}
                      whatsappNumber={listing.seller?.whatsappNumber}
                      location={listing.location}
                      sellerId={sellerId}
                      ownerShopId={sellerShopId}
                    />
                  </div>
                ) : (
                  /* SOLD (or an unpublished draft) — the only real dead ends
                     left. Keep the status sentence but offer the two recovery
                     paths (same category + price band, and the seller's other
                     stock). A RESERVED listing never reaches this branch any
                     more: it is live, and takes the CTA row above.

                     Buyer recovery, which is one of the reasons the block is
                     owner-gated above: telling the seller of a sold item to "see
                     similar in Vehicles" and "shop more from Ahmad Karimi" would
                     be sending them shopping from themselves. The owner gets
                     <OwnerListingBar> instead, where Manage/Edit live. */
                  <div data-testid="listing-unavailable">
                  <UnavailableActions
                    status={listing.status}
                    category={listing.category}
                    price={listing.price}
                    currency={listing.currency}
                    similarPrices={similarStock.map((l) => l.price)}
                    sellerId={sellerId}
                    sellerShopId={sellerShopId}
                    sellerName={listing.shop?.name ?? listing.seller?.name}
                    locale={locale}
                  />
                  </div>
                )}
                <SaveButton
                  listingId={listing.id}
                  initialSaved={listing.isSaved}
                  ownerId={sellerId}
                  ownerShopId={sellerShopId}
                  variant="detail"
                />
              </div>
            </HideForOwner>
            {/* No payment/delivery — deals happen in person, so surface meet-safely
                guidance right by the contact actions (mirrors mobile). "Not
                interested" hides the listing from the buyer's feed. Both are buyer
                affordances, so both take `ownerId` and hide on your own listing. */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1 empty:hidden empty:pt-0">
              <SafetyTips ownerId={sellerId} ownerShopId={sellerShopId} />
              <HideListingButton
                listingId={listing.id}
                ownerId={sellerId}
                ownerShopId={sellerShopId}
              />
            </div>

          </div>
          <div className="order-4 min-w-0 space-y-5 lg:order-none">
            {/* Who and where come AFTER the buy box (Depop / Etsy item pages):
                the map and the seller card used to sit between the price and the
                Contact button, pushing it to ~640px on desktop
                (docs/design/listing-detail.md). */}
            {/* Seller */}
            {listing.seller && (
              <Card className="p-4">
                <p className="mb-3 text-sm font-medium text-muted-foreground">
                  {t("listing.detail.seller")}
                </p>
                {/* SHOP-1: posted as a shop → "🏪 Safi Cosmetics · Shop" → the shop page. */}
                {listing.shop ? (
                  <span data-testid="listing-shop-link">
                    <UserIdentity
                      variant="shop"
                      name={listing.shop.name}
                      avatarUrl={listing.shop.logoUrl} avatarFallbackUrl={listing.shop.logoOriginalUrl}
                      verified={listing.shop.verified}
                      subtitle={listing.shop.city ?? listing.shop.province}
                      href={`/shops/${listing.shop.id}`}
                      size={48}
                    />
                  </span>
                ) : (
                  <UserIdentity
                    name={listing.seller.name}
                    avatarUrl={listing.seller.avatarUrl} avatarFallbackUrl={listing.seller.avatarOriginalUrl}
                    verified={listing.seller.verified}
                    subtitle={listing.seller.city}
                    href={profileHrefFor(listing.seller)}
                    size={48}
                  />
                )}
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
                {/* "Seller is away until…" is buyer information — it sets an
                    expectation about reply speed. Told to the seller it reads as
                    the site describing them in the third person, so it is
                    owner-gated exactly like mobile (`!isOwnListing &&
                    sellerIsAway` in `ListingDetail.tsx`). The seller sees their
                    own away state where they set it: their profile, via
                    `profile.away.youAreAway`. */}
                <HideForOwner ownerId={sellerId} ownerShopId={sellerShopId}>
                  <AwayBanner
                    awayUntil={listing.seller.sellerAwayUntil}
                    className="mt-3"
                  />
                </HideForOwner>
              </Card>
            )}

            {listing.location && (
              /* The shared card surface, not another inline
                 `rounded-lg border bg-card` — see `ui/card.tsx`. */
              <Card className="space-y-2 p-3">
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
                <>
                  <LocationMap
                    lat={listing.latitude}
                    lng={listing.longitude}
                    // Zoom 13, not 14, BECAUSE of the approximate-area circle: a 500m radius
                    // at z14 in an h-48 frame fills nearly the whole map, so the circle reads
                    // as a solid blob and the streets around it — the context a buyer
                    // actually needs to judge "which part of town" — are pushed out of view.
                    // One step out keeps the area obvious while leaving surrounding
                    // neighbourhoods visible. An exact point (owner view) keeps z14.
                    zoom={listing.locationPrecision === "exact" ? 14 : 13}
                    className="h-48"
                    // SAFETY-1: an AREA, not a pin. A MISSING precision is read as
                    // approximate (the safe default), so an older payload can never
                    // re-expose an exact point — only an explicit "exact", which the API
                    // sends on the owner's own view alone, keeps the precise marker.
                    // Metres on the wire, kilometres in the map component.
                    radiusKm={
                      listing.locationPrecision === "exact"
                        ? undefined
                        : (listing.locationRadiusM ?? 500) / 1000
                    }
                  />
                  {listing.locationPrecision !== "exact" && (
                    <p
                      className="mt-2 text-xs text-muted-foreground"
                      data-testid="listing-location-approximate"
                    >
                      {t("listing.detail.approximateLocation")}
                    </p>
                  )}
                </>
                )}
              </Card>
            )}

          </div>
          </div>

          <div className="order-3 min-w-0 lg:order-none lg:col-start-1 lg:row-start-2">
            {isStay && (
              <div className="mb-6">
                <StayFacts details={listing.details} />
              </div>
            )}
            {listing.description && (
              <section>
                <h2 className="text-lg font-semibold">
                  {t("listing.detail.description")}
                </h2>
                <Separator className="my-3" />
                <p className="whitespace-pre-line text-pretty text-sm leading-relaxed text-foreground" {...userTextProps(listing.description)} data-testid="listing-description">
                  {listing.description}
                </p>
              </section>
            )}
            <div className="mt-6">
              {/* `-ms-2` cancels the trigger's own `px-2` so the flag lines up with
                  the Description heading and the body copy at the column's start
                  edge (and its mirror in ps/fa) instead of sitting 8px inside it —
                  the padding stays, so the 40px hit box is untouched. */}
              <ReportButton
                reportableType="Listing"
                reportableId={listing.id}
                ownerId={sellerId}
                ownerShopId={sellerShopId}
                className="-ms-2"
              />
            </div>
          </div>
        </div>

        {/* Cross-sell rails ("More from this Seller" + "Similar Listings"). They
            own their own two requests, so they stream in behind a skeleton instead
            of holding back the photo, the price and the seller card above.

            KNOWN GAP: listings the buyer dismissed with "Not interested" can still
            appear here. Rails filters them out for the caller it can identify, but
            every public payload on this site is fetched anonymously (see
            lib/api/client.ts — devise tokens live in httpOnly cookies and are only
            attached by the /api/me proxy, which is what re-persists the rotated
            ones). The browse feed and the category hubs have exactly the same gap;
            closing it belongs in the fetch layer, once, for all of them — not in
            this rail at the cost of an authed round-trip per page view. */}
        {/* OTHER listings: the shop context of this one does not apply there. */}
        <OwnerShopScope ownerShop={null}>
          <Suspense fallback={<CrossSellRailsSkeleton className="mt-12" />}>
            <CrossSellRails
              className="mt-12"
              listingId={listing.id}
              sellerId={sellerId}
              shopId={sellerShopId}
              categorySlug={listing.category?.slug}
              isLive={isLiveListing}
            />
          </Suspense>
        </OwnerShopScope>

        {/* Sticky buyer CTA for phones/tablets — reuses the very same
            StartConversationButton + SaveButton as the inline block above, so the
            conversation and the saved heart are never duplicated state. */}
        <ListingActionBar
          listingId={listing.id}
          sellerId={sellerId}
          ownerShopId={sellerShopId}
          status={listing.status}
          price={listing.price}
          priceUnit={listing.priceUnit}
          currency={listing.currency}
          initialSaved={listing.isSaved}
          sentinelId="listing-actions"
          priceAnchorId="listing-price"
          isShop={!!listing.shop}
        />
      </div>
    </ViewerIdProvider>
  );
}
