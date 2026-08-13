import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { Eye, Heart, MapPin } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getListing, getSimilarListings } from "@/lib/api/listings";
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
import { UnavailableActions } from "@/components/listing/unavailable-actions";
import { OwnerListingBar } from "@/components/listing/owner-listing-bar";
import { HideForOwner, ViewerIdProvider } from "@/components/auth/owner-gate";
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
  //
  // The viewer id rides in its own cookie next to the (httpOnly) devise tokens, so
  // reading it costs nothing — no Rails round-trip, and this route is already
  // `force-dynamic`. It's what lets the owner-gated controls below decide ownership
  // during SSR instead of after the browser's session probe: the seller of this
  // item gets their own panel in the FIRST paint, rather than watching "Message
  // Seller", the save heart and the buyer safety tips flash past first.
  const [listing, viewerId] = await Promise.all([
    safe(getListing(id), null),
    readViewerIdFromCookies(),
  ]);
  if (!listing) notFound();

  const sellerId = listing.seller?.id;
  const isActive = listing.status === "active";
  const isSold = listing.status === "sold";

  // Recovery-CTA gate. <UnavailableActions> must never promise stock that isn't
  // there — "See similar in Clothes & Fashion" landing on an empty Bazaar is the
  // very dead end this card removes — so it is handed the live stock its CTA
  // would show. That is exactly the `similar_to` set <CrossSellRails> renders
  // below, and both call sites issue the identical GET, so Next's per-render
  // fetch memoization makes this one request, not two. Only awaited for a
  // sold/reserved listing: an active one never renders the card, and the rail
  // keeps streaming behind its own <Suspense>.
  const similarStock = isActive
    ? []
    : await safe(getSimilarListings(listing.id), []);

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

  // The room the sticky <ListingActionBar> needs is reserved by the bar itself
  // (it renders its own spacer), not by padding here: only that component knows
  // whether a bar exists at all — it self-suppresses on desktop, on a
  // sold/reserved listing, and for the seller's own listing — and static padding
  // gave all three a strip of dead space above the footer.
  return (
    <ViewerIdProvider viewerId={viewerId}>
      <div className="mx-auto max-w-6xl px-4 py-6">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        {/* Records this open into Recently Viewed for logged-in users (no-op for
            guests) — the SSR fetch above is a guest, so Rails can't attribute it. */}
        <RecordListingView id={listing.id} />


        <div className="grid gap-8 lg:grid-cols-2">
          {/* Sold stock is dimmed, photo and price both (DESIGN_SYSTEM §2), so
              the page reads as an archive at a glance instead of looking like a
              live offer with a notice bolted on. Reserved keeps full strength —
              a reservation can fall through. */}
          <ListingGallery
            images={listing.images}
            title={listing.title}
            dimmed={isSold}
          />

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

            {/* `id="listing-price"` is the price anchor <ListingActionBar>
                watches: while this block is on screen the sticky bar shows no
                price of its own, so the same number never appears twice. */}
            <div id="listing-price" className="space-y-2">
              <PriceTag
                price={listing.price}
                currency={listing.currency}
                size="lg"
                tone={isSold ? "muted" : "default"}
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

            {/* Owner-only panel — renders null for buyers/guests.
                Every buyer control further down self-hides for the seller, so
                without this their own listing has no actions at all. It sits here,
                directly under the price/meta block, because the owner is also the
                one viewer <ListingActionBar> never pins a sticky CTA for: parked
                below the map and the seller card it would have been two screens
                down with nothing to bring it back into reach. */}
            <OwnerListingBar
              listingId={listing.id}
              sellerId={listing.seller?.id}
              status={listing.status}
              expiresAt={listing.expiresAt}
              expired={listing.expired}
              conversationsCount={listing.conversationsCount}
            />

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
                  <LocationMap
                    lat={listing.latitude}
                    lng={listing.longitude}
                    zoom={14}
                    className="h-48"
                  />
                )}
              </Card>
            )}

            {/* Seller */}
            {listing.seller && (
              <Card className="p-4">
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
                {/* "Seller is away until…" is buyer information — it sets an
                    expectation about reply speed. Told to the seller it reads as
                    the site describing them in the third person, so it is
                    owner-gated exactly like mobile (`!isOwnListing &&
                    sellerIsAway` in `ListingDetail.tsx`). The seller sees their
                    own away state where they set it: their profile, via
                    `profile.away.youAreAway`. */}
                <HideForOwner ownerId={listing.seller.id}>
                  <AwayBanner
                    awayUntil={listing.seller.sellerAwayUntil}
                    className="mt-3"
                  />
                </HideForOwner>
              </Card>
            )}

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
            <HideForOwner ownerId={listing.seller?.id}>
              <div id="listing-actions" className="space-y-5">
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
                  /* Sold / reserved is not a dead end: keep the status sentence
                     but offer the two recovery paths (same category + price band,
                     and the seller's other stock). The SaveButton below stays
                     visible — a reservation can still fall through.

                     Buyer recovery, which is one of the reasons the block is
                     owner-gated above: telling the seller of a sold item to "see
                     similar in Vehicles" and "shop more from Ahmad Karimi" would
                     be sending them shopping from themselves. The owner gets
                     <OwnerListingBar> instead, where Manage/Edit live. */
                  <UnavailableActions
                    status={listing.status}
                    category={listing.category}
                    price={listing.price}
                    currency={listing.currency}
                    similarPrices={similarStock.map((l) => l.price)}
                    sellerId={listing.seller?.id}
                    sellerName={listing.seller?.name}
                    locale={locale}
                  />
                )}
                <SaveButton
                  listingId={listing.id}
                  initialSaved={listing.isSaved}
                  ownerId={listing.seller?.id}
                  variant="detail"
                />
              </div>
            </HideForOwner>
            {/* No payment/delivery — deals happen in person, so surface meet-safely
                guidance right by the contact actions (mirrors mobile). "Not
                interested" hides the listing from the buyer's feed. Both are buyer
                affordances, so both take `ownerId` and hide on your own listing. */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1 empty:hidden empty:pt-0">
              <SafetyTips ownerId={listing.seller?.id} />
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
          {/* `-ms-2` cancels the trigger's own `px-2` so the flag lines up with
              the Description heading and the body copy at the column's start
              edge (and its mirror in ps/fa) instead of sitting 8px inside it —
              the padding stays, so the 40px hit box is untouched. */}
          <ReportButton
            reportableType="Listing"
            reportableId={listing.id}
            ownerId={listing.seller?.id}
            className="-ms-2"
          />
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
        <Suspense fallback={<CrossSellRailsSkeleton className="mt-12" />}>
          <CrossSellRails
            className="mt-12"
            listingId={listing.id}
            sellerId={sellerId}
            categorySlug={listing.category?.slug}
            isActive={isActive}
          />
        </Suspense>

        {/* Sticky buyer CTA for phones/tablets — reuses the very same
            StartConversationButton + SaveButton as the inline block above, so the
            conversation and the saved heart are never duplicated state. */}
        <ListingActionBar
          listingId={listing.id}
          sellerId={sellerId}
          status={listing.status}
          price={listing.price}
          currency={listing.currency}
          initialSaved={listing.isSaved}
          sentinelId="listing-actions"
          priceAnchorId="listing-price"
        />
      </div>
    </ViewerIdProvider>
  );
}
